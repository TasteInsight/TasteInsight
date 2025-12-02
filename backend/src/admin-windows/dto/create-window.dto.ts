import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FloorInputDto {
  @IsString()
  @IsNotEmpty()
  level: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateWindowDto {
  @IsString()
  @IsNotEmpty()
  canteenId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => FloorInputDto)
  @IsOptional()
  floor?: FloorInputDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
