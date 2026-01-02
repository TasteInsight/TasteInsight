import 'reflect-metadata';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsNotEmpty,
  Min,
  Max,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 实验分组配置
 */
export class CreateExperimentGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
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
  config?: Record<string, any>;
}

export class CreateExperimentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  trafficRatio: number;

  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExperimentGroupDto)
  groups: CreateExperimentGroupDto[];
}

export class UpdateExperimentDto {
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
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExperimentGroupDto)
  groups?: CreateExperimentGroupDto[];
}
