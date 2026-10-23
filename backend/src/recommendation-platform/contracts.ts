import type { ModelParameters } from './model-parameters';
import type {
  RecommendationWeights,
  RecallQuotaConfig,
} from '@/recommendation/interfaces/recommendation-config.interface';

export interface StrategyConfig {
  schemaVersion: 1;
  recall: {
    sources: RecallQuotaConfig;
    candidateLimit: number;
    indexId?: string;
  };
  ranking:
    | { type: 'weighted_rules'; weights: RecommendationWeights }
    | {
        type: 'model_endpoint';
        modelVersionId: string;
        timeoutMs: number;
        parameters?: ModelParameters;
      };
  rerank: { diversityEnabled: boolean };
  fallbackStrategyRevisionId?: string;
}

export interface ModelDeployment {
  url: string;
  token?: string;
  timeoutMs?: number;
}
