import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';
import { ScoreBreakdown, RecommendationWeights } from '../interfaces';

/**
 * 推荐菜品项 - 只包含推荐相关的基本信息
 */
export class RecommendedDishItemDto {
  /** 菜品ID */
  id: string;
  /** 推荐分数（可选，调试用） */
  score?: number;
  /** 分数明细（可选，调试用） */
  scoreBreakdown?: ScoreBreakdown;
}

/**
 * 调试信息
 */
export class RecommendationDebugInfo {
  /** 处理耗时（毫秒） */
  processingTimeMs?: number;
  /** 候选菜品数量 */
  candidateCount?: number;
  /** 推荐场景 */
  scene?: string;
  /** 是否包含搜索 */
  hasSearch?: boolean;
  /** 使用的权重配置 */
  weightsUsed?: RecommendationWeights;
}

/**
 * 推荐结果数据
 */
export class RecommendationResultDataDto {
  items: RecommendedDishItemDto[];
  meta: PaginationMeta;
  /** 推荐请求 ID（用于事件追踪） */
  requestId?: string;
  /** 实验分组项 ID（A/B 测试） */
  groupItemId?: string;
  experimentId?: string;
  /** 实际场景、排序权重和召回配额的内容摘要 */
  configDigest?: string;
  deliveryId?: string;
  sessionReset?: boolean;
  evaluationTrace?: Record<string, unknown>;
  strategyRevisionId?: string;
  indexId?: string;
  modelVersionId?: string;
  rankerVersionId?: string;
  mode?: 'online' | 'evaluation' | 'preview';
  fallbackReason?: string;
  /** 调试信息（可选） */
  debug?: RecommendationDebugInfo;
}

/**
 * 推荐结果响应
 */
export class RecommendationResultDto extends BaseResponseDto<RecommendationResultDataDto> {}
