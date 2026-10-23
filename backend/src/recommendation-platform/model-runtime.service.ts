import {
  EMPTY_PARAMETER_SCHEMA,
  ModelParameterSchema,
  ModelParameters,
  parseParameterSchema,
  resolveModelParameters,
  sameParameters,
} from './model-parameters';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecommendationModel } from '@prisma/client';
import { createHash } from 'crypto';
import { UserFeatures } from '../recommendation/interfaces';
import { FeatureEncoderService } from '../recommendation/services/feature-encoder.service';
import { EmbeddingService } from '../recommendation/services/embedding.service';
import { RecommendationCacheService } from '../recommendation/services/cache.service';

@Injectable()
export class ModelRuntimeService {
  constructor(
    private readonly config: ConfigService,
    private readonly encoder: FeatureEncoderService,
    private readonly embedding: EmbeddingService,
    private readonly cache: RecommendationCacheService,
  ) {}

  async verify(model: RecommendationModel): Promise<ModelParameterSchema> {
    if (model.provider === 'local') {
      this.assertLocal(model);
      return structuredClone(EMPTY_PARAMETER_SCHEMA);
    }
    const info = await this.request(
      model,
      `/model-info/${encodeURIComponent(model.serviceVersion)}`,
    );
    this.assertIdentity(model, info, model.status === 'ready');
    if (
      info.ready !== true ||
      info.kind !== model.kind ||
      (model.kind === 'embedding' && info.dimension !== model.dimension)
    ) {
      throw new Error(
        'Model is not ready or has an incompatible output contract',
      );
    }
    return parseParameterSchema(info.parameterSchema);
  }

  async generateDish(
    model: RecommendationModel,
    payload: Record<string, unknown>,
    suppliedParameters?: unknown,
  ): Promise<number[]> {
    this.assertEmbedding(model);
    const parameters = resolveModelParameters(
      model.parameterSchema,
      suppliedParameters,
    );
    const features = this.embedding.mapToDishFeatures(payload);
    if (model.provider === 'local') {
      this.assertLocal(model);
      return this.vector(model, this.encoder.encodeDishFeatures(features));
    }
    return this.embed(
      model,
      {
        text: this.embedding.buildDishFeatureText(features),
        features: this.embedding.extractDishNumericFeatures(features),
      },
      parameters,
    );
  }

  async generateUser(
    model: RecommendationModel,
    features: UserFeatures,
    suppliedParameters?: unknown,
  ): Promise<number[]> {
    this.assertEmbedding(model);
    const parameters = resolveModelParameters(
      model.parameterSchema,
      suppliedParameters,
    );
    if (model.provider === 'local') this.assertLocal(model);
    const input =
      model.provider === 'local'
        ? features
        : {
            text: this.embedding.buildUserFeatureText(features),
            features: this.embedding.extractUserNumericFeatures(features),
          };
    const digest = createHash('sha256')
      .update(
        JSON.stringify({ input, parameters }, (_key, value) => {
          if (value instanceof Map) return [...value.entries()];
          if (value instanceof Set) return [...value];
          return value;
        }),
      )
      .digest('hex');
    const key = `model:${model.id}:${model.artifactDigest}:${model.featureSchemaVersion}:${model.dimension}:${digest}`;
    const cached = await this.cache.getUserEmbedding(key);
    if (cached && cached.version === model.serviceVersion)
      return this.vector(model, cached.embedding);
    const vector =
      model.provider === 'local'
        ? this.vector(model, this.encoder.encodeUserFeatures(features))
        : await this.embed(model, input, parameters);
    await this.cache.setUserEmbedding(key, vector, model.serviceVersion);
    return vector;
  }

  async rank(
    model: RecommendationModel,
    features: UserFeatures,
    dishes: any[],
    timeoutMs: number,
    suppliedParameters?: unknown,
  ): Promise<Map<string, number>> {
    const parameters = resolveModelParameters(
      model.parameterSchema,
      suppliedParameters,
    );
    if (model.kind !== 'ranking' || model.provider !== 'http')
      throw new Error('Ranking requires an HTTP ranking model');
    const ids = new Set(dishes.map((dish) => dish.id));
    if (
      ids.size !== dishes.length ||
      [...ids].some((id) => typeof id !== 'string' || !id)
    ) {
      throw new Error('Ranking candidates must have distinct dish IDs');
    }
    const response = await this.request(
      model,
      '/rank',
      {
        ...this.identity(model),
        parameters,
        user: this.embedding.extractUserNumericFeatures(features),
        candidates: dishes.map((dish) => ({
          dishId: dish.id,
          ...this.embedding.extractDishNumericFeatures(
            this.embedding.mapToDishFeatures(dish),
          ),
        })),
      },
      timeoutMs,
    );
    this.assertIdentity(model, response);
    this.assertAppliedParameters(parameters, response);
    if (!Array.isArray(response.scores) || response.scores.length !== ids.size)
      throw new Error('Ranking response must cover every candidate');
    const scores = new Map<string, number>();
    for (const item of response.scores) {
      if (
        !item ||
        !ids.has(item.dishId) ||
        scores.has(item.dishId) ||
        typeof item.score !== 'number' ||
        !Number.isFinite(item.score)
      ) {
        throw new Error(
          'Ranking response contains invalid, duplicate or unknown scores',
        );
      }
      scores.set(item.dishId, item.score);
    }
    return scores;
  }

  private identity(model: RecommendationModel) {
    return {
      version: model.serviceVersion,
      artifactDigest: model.artifactDigest,
      featureSchemaVersion: model.featureSchemaVersion,
    };
  }

  private assertIdentity(
    model: RecommendationModel,
    value: any,
    checkParameters = true,
  ): void {
    if (
      !value ||
      Object.entries(this.identity(model)).some(
        ([key, expected]) => value[key] !== expected,
      )
    ) {
      throw new Error('Model response identity mismatch');
    }
    if (
      checkParameters &&
      !sameParameters(
        parseParameterSchema(model.parameterSchema),
        parseParameterSchema(value.parameterSchema),
      )
    )
      throw new Error('Model parameter schema mismatch');
  }

  private assertAppliedParameters(parameters: ModelParameters, response: any) {
    const applied =
      response.appliedParameters === undefined &&
      Object.keys(parameters).length === 0
        ? {}
        : response.appliedParameters;
    if (!sameParameters(parameters, applied))
      throw new Error('Model did not confirm applied parameters');
  }

  private assertLocal(model: RecommendationModel): void {
    if (
      model.kind !== 'embedding' ||
      model.serviceVersion !== 'local-v1' ||
      model.artifactDigest !== 'local-v1' ||
      model.featureSchemaVersion !== 'dish-user-v1' ||
      model.dimension !== 128 ||
      !sameParameters(
        parseParameterSchema(model.parameterSchema),
        EMPTY_PARAMETER_SCHEMA,
      )
    ) {
      throw new Error('Unsupported local model identity');
    }
  }

  private assertEmbedding(model: RecommendationModel): void {
    if (
      model.kind !== 'embedding' ||
      !Number.isInteger(model.dimension) ||
      model.dimension! <= 0
    )
      throw new Error('Invalid embedding model contract');
  }

  private vector(model: RecommendationModel, value: unknown): number[] {
    if (
      !Array.isArray(value) ||
      value.length !== model.dimension ||
      value.some((item) => typeof item !== 'number' || !Number.isFinite(item))
    ) {
      throw new Error('Invalid embedding dimension or values');
    }
    return value;
  }

  private async embed(
    model: RecommendationModel,
    input: unknown,
    parameters: ModelParameters,
  ): Promise<number[]> {
    const response = await this.request(model, '/embed', {
      ...(input as object),
      ...this.identity(model),
      parameters,
    });
    this.assertIdentity(model, response);
    this.assertAppliedParameters(parameters, response);
    if (response.dimension !== model.dimension)
      throw new Error('Embedding dimension mismatch');
    return this.vector(model, response.embedding);
  }

  private async request(
    model: RecommendationModel,
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<any> {
    if (model.provider !== 'http' || !model.deploymentId)
      throw new Error('HTTP model deployment is required');
    const deployments = JSON.parse(
      this.config.get<string>('RECOMMENDATION_MODEL_DEPLOYMENTS') || '{}',
    );
    const deployment = Object.hasOwn(deployments, model.deploymentId)
      ? deployments[model.deploymentId]
      : undefined;
    if (!deployment || typeof deployment.url !== 'string')
      throw new Error('Unknown model deployment');
    const url = new URL(deployment.url);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid model deployment URL');
    const configuredTimeout = deployment.timeoutMs ?? 5000;
    const effectiveTimeout =
      timeoutMs === undefined
        ? configuredTimeout
        : Math.min(timeoutMs, configuredTimeout);
    if (!Number.isInteger(effectiveTimeout) || effectiveTimeout <= 0)
      throw new Error('Invalid model timeout');
    const response = await fetch(
      `${deployment.url.replace(/\/$/, '')}${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deployment.token
            ? { Authorization: `Bearer ${deployment.token}` }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(effectiveTimeout),
        redirect: 'error',
      },
    );
    if (!response.ok)
      throw new Error(`Model service returned HTTP ${response.status}`);
    return response.json();
  }
}
