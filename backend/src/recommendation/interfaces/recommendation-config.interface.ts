/**
 * 推荐算法权重配置
 */
export interface RecommendationWeights {
  /** 用户偏好匹配权重 */
  preferenceMatch: number;
  /** 收藏相似度权重 */
  favoriteSimilarity: number;
  /** 浏览相关性权重 */
  browseRelevance: number;
  /** 菜品质量权重 */
  dishQuality: number;
  /** 多样性权重 */
  diversity: number;
  /** 搜索相关性权重 */
  searchRelevance: number;
}

/**
 * 召回配额配置（用于 A/B 测试不同的召回策略）
 */
export interface RecallQuotaConfig {
  /** 向量召回配额比例 (0-1) */
  vectorQuota: number;
  /** 规则召回配额比例 (0-1) */
  ruleQuota: number;
  /** 协同召回配额比例 (0-1) */
  collaborativeQuota: number;
}

/**
 * A/B 测试实验配置
 */
export interface ExperimentConfig {
  /** 实验 ID */
  experimentId: string;
  /** 实验名称 */
  name: string;
  /** 实验分组项列表 */
  groupItems: ExperimentGroupItemConfig[];
  /** 流量分配比例 */
  trafficRatio: number;
  /** 实验开始时间 */
  startTime: Date;
  /** 实验结束时间 */
  endTime?: Date;
  /** 实验状态 */
  status: string;
}

/**
 * 实验分组项配置
 */
export interface ExperimentGroupItemConfig {
  /** 分组项 ID */
  groupItemId: string;
  /** 分组名称 */
  name: string;
  /** 组内流量比例 */
  ratio: number;
  /** 该分组使用的权重配置 */
  weights?: Partial<RecommendationWeights>;
  /** 该分组使用的召回配额配置（用于测试不同的召回策略） */
  recallQuota?: RecallQuotaConfig;
}

/**
 * 实验分组分配结果
 */
export type ExperimentAssignment = ExperimentGroupItemConfig & {
  /** 实验 ID */
  experimentId: string;
  /** 完整的权重配置（合并默认值后） */
  resolvedWeights: RecommendationWeights;
};

/**
 * 外部嵌入服务配置
 */
export interface EmbeddingServiceConfig {
  externalEnabled: boolean;
  externalServiceUrl: string;
  externalEmbeddingDim: number;
  embeddingDim: number;
  batchSize: number;
  externalVersion?: string;
}

/**
 * 带版本的嵌入向量
 */
export interface VersionedEmbedding {
  embedding: number[];
  version: string;
}
