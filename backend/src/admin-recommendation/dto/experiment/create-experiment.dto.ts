import 'reflect-metadata';
import {
  IsString,
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
 * 实验分组配置
 */
export class CreateExperimentGroupDto {
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

export class CreateExperimentDto {
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
  @Type(() => CreateExperimentGroupDto)
  @ValidateNested({ each: true })
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
  @Type(() => CreateExperimentGroupDto)
  @ValidateNested({ each: true })
  groups?: CreateExperimentGroupDto[];
}
