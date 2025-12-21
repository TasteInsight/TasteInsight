/**
 * 实验分组配置
 */
export class CreateExperimentGroupDto {
  name: string;
  ratio: number;
  /** 
   * 实验配置，可以包含：
   * - weights: 权重配置 { preferenceMatch, favoriteSimilarity, ... }
   * - recallQuota: 召回策略配额 { vectorQuota, ruleQuota, collaborativeQuota }
   * 
   * @example
   * {
   *   "weights": {
   *     "preferenceMatch": 35,
   *     "favoriteSimilarity": 20,
   *     "browseRelevance": 15,
   *     "dishQuality": 15,
   *   "diversity": 10,
   *     "searchRelevance": 5
   *   },
   *   "recallQuota": {
   *     "vectorQuota": 0.7,
   *     "ruleQuota": 0.2,
   *     "collaborativeQuota": 0.1
   *   }
   */
  config?: Record<string, any>;
}

export class CreateExperimentDto {
  name: string;
  description?: string;
  trafficRatio: number;
  startTime: Date;
  endTime?: Date;
  groups: CreateExperimentGroupDto[];
}

export class UpdateExperimentDto {
  name?: string;
  description?: string;
  trafficRatio?: number;
  startTime?: Date;
  endTime?: Date;
  status?: string;
  groups?: CreateExperimentGroupDto[];
}
