import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FloorInputDto } from './create-window.dto';

export class UpdateWindowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  number: string;

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
