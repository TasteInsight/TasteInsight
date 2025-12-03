import { IsString, IsOptional } from 'class-validator';

export class UpdateNewsDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  canteenId?: string;
}
