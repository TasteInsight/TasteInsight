import { createHash } from 'node:crypto';
import Ajv from 'ajv';
import {
  RecommendationWeights,
  RecallQuotaConfig,
} from '../interfaces/recommendation-config.interface';
import {
  RecommendationScene,
  RECOMMENDATION_WEIGHTS,
  SEARCH_SCENE_WEIGHTS,
} from '../constants/recommendation.constants';

export interface RecommendationGroupConfig {
  weights?: Partial<RecommendationWeights>;
  recallQuota?: RecallQuotaConfig;
}

export interface ResolvedRecommendationConfig {
  weights: RecommendationWeights;
  recallQuota: RecallQuotaConfig;
  configDigest: string;
}

const weightKeys = [
  'preferenceMatch',
  'favoriteSimilarity',
  'browseRelevance',
  'dishQuality',
  'diversity',
  'searchRelevance',
] as const;
const quotaKeys = ['vectorQuota', 'ruleQuota', 'collaborativeQuota'] as const;
const validator = new Ajv({ allErrors: true, strictNumbers: true });
const validate = validator.compile({
  type: 'object',
  additionalProperties: false,
  properties: {
    weights: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        weightKeys.map((key) => [key, { type: 'number', minimum: 0 }]),
      ),
    },
    recallQuota: {
      type: 'object',
      additionalProperties: false,
      required: [...quotaKeys],
      properties: Object.fromEntries(
        quotaKeys.map((key) => [
          key,
          { type: 'number', minimum: 0, maximum: 1 },
        ]),
      ),
    },
  },
});

export function defaultRecommendationWeights(
  scene = RecommendationScene.HOME,
): RecommendationWeights {
  const source =
    scene === RecommendationScene.SEARCH
      ? SEARCH_SCENE_WEIGHTS
      : RECOMMENDATION_WEIGHTS;
  return {
    preferenceMatch: source.PREFERENCE_MATCH,
    favoriteSimilarity: source.FAVORITE_SIMILARITY,
    browseRelevance: source.BROWSE_RELEVANCE,
    dishQuality: source.DISH_QUALITY,
    diversity: source.DIVERSITY,
    searchRelevance: source.SEARCH_RELEVANCE,
  };
}

export function parseRecommendationConfig(
  value: unknown,
): RecommendationGroupConfig {
  const config = value ?? {};
  if (!validate(config)) {
    throw new Error(`推荐配置无效：${validator.errorsText(validate.errors)}`);
  }
  const parsed = config as RecommendationGroupConfig;
  const weights = { ...defaultRecommendationWeights(), ...parsed.weights };
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('推荐权重总和必须为有限正数');
  }
  if (parsed.recallQuota) {
    const sum = quotaKeys.reduce(
      (total, key) => total + parsed.recallQuota![key],
      0,
    );
    if (Math.abs(sum - 1) > 1e-6) throw new Error('召回配额总和必须为 1');
  }
  return parsed;
}

export function resolveRecommendationConfig(
  value: unknown,
  scene = RecommendationScene.HOME,
): ResolvedRecommendationConfig {
  const config = parseRecommendationConfig(value);
  const defaults = defaultRecommendationWeights(scene);
  const weights = Object.fromEntries(
    weightKeys.map((key) => [key, config.weights?.[key] ?? defaults[key]]),
  ) as unknown as RecommendationWeights;
  const source = config.recallQuota ?? {
    vectorQuota: 0.6,
    ruleQuota: 0.3,
    collaborativeQuota: 0.1,
  };
  const recallQuota = Object.fromEntries(
    quotaKeys.map((key) => [key, source[key]]),
  ) as unknown as RecallQuotaConfig;
  const configDigest = createHash('sha256')
    .update(JSON.stringify({ schemaVersion: 1, scene, weights, recallQuota }))
    .digest('hex');
  return { weights, recallQuota, configDigest };
}
