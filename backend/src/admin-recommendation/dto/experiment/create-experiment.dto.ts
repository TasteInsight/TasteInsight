import 'reflect-metadata';
import {
  IsString,
  IsIn,
  IsInt,
  ArrayMinSize,
  IsNumber,
  IsOptional,
  IsArray,
  IsNotEmpty,
  IsObject,
  Min,
  Max,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建实验分组配置
 */
export class CreateExperimentGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  strategyRevisionId?: string;
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  ratio: number;

  /**
   * 实验配置，可以包含：
   * - weights: 权重配置 { preferenceMatch, favoriteSimilarity, ... }
   * - recallQuota: 召回策略配额 { vectorQuota, ruleQuota, collaborativeQuota }
   */
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

/**
 * 更新实验分组配置
 */
export class UpdateExperimentGroupDto {
  @IsOptional()
  @IsString()
  strategyRevisionId?: string | null;
  /**
   * 分组ID（更新现有分组时必传，新增分组时不传）
   */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  ratio: number;

  /**
   * 实验配置
   */
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class CreateExperimentDto {
  @IsOptional()
  @IsIn(['home', 'search', 'similar', 'guess_like', 'today'])
  scene?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  trafficRatio: number;

  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => CreateExperimentGroupDto)
  @ValidateNested({ each: true })
  groups: CreateExperimentGroupDto[];
}

export class UpdateExperimentDto {
  @IsOptional()
  @IsIn(['home', 'search', 'similar', 'guess_like', 'today'])
  scene?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  trafficRatio?: number;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  @IsIn(['running', 'paused', 'completed'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => UpdateExperimentGroupDto)
  @ValidateNested({ each: true })
  groups?: UpdateExperimentGroupDto[];
}
