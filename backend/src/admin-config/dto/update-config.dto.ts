import { IsString, IsOptional } from 'class-validator';

export class UpdateConfigItemDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class UpdateGlobalConfigDto extends UpdateConfigItemDto {}

export class UpdateCanteenConfigDto extends UpdateConfigItemDto {}

export class QueryConfigDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  key?: string;
}
