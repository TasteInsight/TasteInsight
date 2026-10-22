import { Transform } from 'class-transformer';
import { IsBoolean, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateTranslationSettingsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  @Transform(({ obj, key }) => obj[key])
  enabled?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  @Transform(({ obj, key }) => {
    const value: unknown = obj[key];
    return typeof value === 'string' ? value.trim() : value;
  })
  model?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  @Transform(({ obj, key }) => {
    const value: unknown = obj[key];
    return typeof value === 'string' ? value.trim() : value;
  })
  baseUrl?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(4096)
  @Transform(({ obj, key }) => {
    const value: unknown = obj[key];
    return typeof value === 'string' ? value.trim() : value;
  })
  apiKey?: string | null;
}
