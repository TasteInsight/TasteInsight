import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export const recommendationScenes = ['home', 'search', 'similar', 'guess_like', 'today'] as const
export type RecommendationScene = (typeof recommendationScenes)[number]
export interface StrategyConfig {
  schemaVersion: 1
  recall: {
    sources: { vectorQuota: number; ruleQuota: number; collaborativeQuota: number }
    candidateLimit: number
    indexId?: string
  }
  ranking:
    | {
        type: 'weighted_rules'
        weights: {
          preferenceMatch: number
          favoriteSimilarity: number
          browseRelevance: number
          dishQuality: number
          diversity: number
          searchRelevance: number
        }
      }
    | { type: 'model_endpoint'; modelVersionId: string; timeoutMs: number }
  rerank: { diversityEnabled: boolean }
  fallbackStrategyRevisionId?: string
}
export interface RecommendationModel {
  id: string
  name: string
  kind: 'embedding' | 'ranking'
  provider: 'local' | 'http'
  serviceVersion: string
  artifactDigest: string
  featureSchemaVersion: string
  dimension?: number
  deploymentId?: string
  status: string
  verifiedAt?: string
}
export interface RecommendationIndex {
  id: string
  name: string
  modelVersionId: string
  status: string
  pending: number
  failed: number
  total: number
  applied: number
  lastError?: string
  lastSyncedAt?: string
}
export interface RecommendationStrategy {
  id: string
  name: string
  scene: RecommendationScene
  config: StrategyConfig
  status: string
  digest?: string
}
export interface RecommendationCatalog {
  models: RecommendationModel[]
  indexes: RecommendationIndex[]
  strategies: RecommendationStrategy[]
  defaults: { scene: RecommendationScene; strategyRevisionId: string }[]
  deployments: string[]
  storeConfigured: boolean
}
export interface RecommendationPreview {
  mode: string
  strategyRevisionId?: string
  indexId?: string
  modelVersionId?: string
  rankerVersionId?: string
  fallbackReason?: string
  items: {
    id: string
    score?: number
    scoreBreakdown?: Record<string, number>
    dish?: {
      id: string
      name: string
      canteenName: string
      windowName: string
      price: number
      priceUnit: string | null
    }
  }[]
}
export interface ExperimentMetrics {
  metricVersion: 2
  groups: {
    groupItemId: string
    deliveries: number
    impressions: number
    clicks: number
    favorites: number
    ctr: number
    favoriteRate: number
    fallbacks: number
    avgLatencyMs: number
  }[]
}
const base = '/admin/recommendation'
export const recommendationApi = {
  catalog: () => request.get<ApiResponse<RecommendationCatalog>>(`${base}/catalog`),
  registerModel: (data: Omit<RecommendationModel, 'id' | 'status' | 'verifiedAt'>) =>
    request.post<ApiResponse<RecommendationModel>>(`${base}/models`, data),
  verifyModel: (id: string) =>
    request.post<ApiResponse<RecommendationModel>>(`${base}/models/${id}/verify`),
  createIndex: (data: { name: string; modelVersionId: string }) =>
    request.post<ApiResponse<RecommendationIndex>>(`${base}/indexes`, data),
  buildIndex: (id: string) =>
    request.post<ApiResponse<RecommendationIndex>>(`${base}/indexes/${id}/build`),
  retireIndex: (id: string) =>
    request.post<ApiResponse<RecommendationIndex>>(`${base}/indexes/${id}/retire`),
  createStrategy: (data: { name: string; scene: RecommendationScene; config: StrategyConfig }) =>
    request.post<ApiResponse<RecommendationStrategy>>(`${base}/strategies`, data),
  updateStrategy: (id: string, data: { name: string; config: StrategyConfig }) =>
    request.put<ApiResponse<RecommendationStrategy>>(`${base}/strategies/${id}`, data),
  retireStrategy: (id: string) =>
    request.post<ApiResponse<RecommendationStrategy>>(`${base}/strategies/${id}/retire`),
  publishStrategy: (id: string) =>
    request.post<ApiResponse<RecommendationStrategy>>(`${base}/strategies/${id}/publish`),
  setDefault: (scene: RecommendationScene, strategyRevisionId: string) =>
    request.put<ApiResponse<unknown>>(`${base}/defaults/${scene}`, { strategyRevisionId }),
  preview: (data: { userId: string; strategyRevisionId: string; pageSize: number }) =>
    request.post<ApiResponse<RecommendationPreview>>(`${base}/preview`, data),
}
export const baselineConfig = (): StrategyConfig => ({
  schemaVersion: 1,
  recall: { sources: { vectorQuota: 0, ruleQuota: 1, collaborativeQuota: 0 }, candidateLimit: 200 },
  ranking: {
    type: 'weighted_rules',
    weights: {
      preferenceMatch: 25,
      favoriteSimilarity: 20,
      browseRelevance: 12,
      dishQuality: 18,
      diversity: 10,
      searchRelevance: 15,
    },
  },
  rerank: { diversityEnabled: true },
})
