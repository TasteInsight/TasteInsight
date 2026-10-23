import { BadRequestException } from '@nestjs/common';
import Ajv from 'ajv';
import { createHash } from 'node:crypto';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';
import { resolveRecommendationConfig } from '@/recommendation/config/recommendation-config';
import type { StrategyConfig } from './contracts';

export const scenes = Object.values(RecommendationScene);
const ajv = new Ajv({ allErrors: true, strictNumbers: true });
const validate = ajv.compile({
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'recall', 'ranking', 'rerank'],
  properties: {
    schemaVersion: { const: 1 },
    recall: {
      type: 'object',
      additionalProperties: false,
      required: ['sources', 'candidateLimit'],
      properties: {
        sources: { type: 'object' },
        candidateLimit: { type: 'integer', minimum: 10, maximum: 1000 },
        indexId: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
    ranking: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'weights'],
          properties: {
            type: { const: 'weighted_rules' },
            weights: { type: 'object' },
          },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'modelVersionId', 'timeoutMs'],
          properties: {
            type: { const: 'model_endpoint' },
            modelVersionId: { type: 'string', minLength: 1, maxLength: 128 },
            timeoutMs: { type: 'integer', minimum: 50, maximum: 5000 },
            parameters: {
              type: 'object',
              additionalProperties: {
                anyOf: [
                  { type: 'number' },
                  { type: 'boolean' },
                  { type: 'string' },
                ],
              },
            },
          },
        },
      ],
    },
    rerank: {
      type: 'object',
      additionalProperties: false,
      required: ['diversityEnabled'],
      properties: { diversityEnabled: { type: 'boolean' } },
    },
    fallbackStrategyRevisionId: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
    },
  },
});

export function canonicalValue(value: unknown): any {
  if (value instanceof Map) return canonicalValue(Object.fromEntries(value));
  if (value instanceof Set) return [...value].map(canonicalValue).sort();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalValue(v)]),
    );
  return value;
}
export function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');
}
export function parseStrategy(value: unknown, scene: string): StrategyConfig {
  if (!scenes.includes(scene as RecommendationScene) || !validate(value))
    throw new BadRequestException(
      `推荐策略无效：${ajv.errorsText(validate.errors)}`,
    );
  const result = structuredClone(value) as StrategyConfig;
  try {
    const resolved = resolveRecommendationConfig(
      {
        weights:
          result.ranking.type === 'weighted_rules'
            ? result.ranking.weights
            : undefined,
        recallQuota: result.recall.sources,
      },
      scene as RecommendationScene,
    );
    if (result.ranking.type === 'weighted_rules')
      result.ranking.weights = resolved.weights;
    result.recall.sources = resolved.recallQuota;
  } catch (error) {
    throw new BadRequestException(error.message);
  }
  if (result.recall.sources.vectorQuota > 0 !== !!result.recall.indexId)
    throw new BadRequestException('向量召回配额与索引选择须同时配置');
  return result;
}
export function isRuleBaseline(config: StrategyConfig): boolean {
  return (
    !config.recall.indexId &&
    config.recall.sources.vectorQuota === 0 &&
    config.ranking.type === 'weighted_rules' &&
    !config.fallbackStrategyRevisionId
  );
}
export function builtInBaseline(scene: RecommendationScene): StrategyConfig {
  return {
    schemaVersion: 1,
    recall: {
      sources: { vectorQuota: 0, ruleQuota: 1, collaborativeQuota: 0 },
      candidateLimit: 100,
    },
    ranking: {
      type: 'weighted_rules',
      weights: resolveRecommendationConfig({}, scene).weights,
    },
    rerank: { diversityEnabled: true },
  };
}
