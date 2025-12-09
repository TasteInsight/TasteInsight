import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateConfigItemDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class UpdateGlobalConfigDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class UpdateCanteenConfigDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class QueryConfigDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  key?: string;
}
