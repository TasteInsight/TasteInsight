import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  normalizeAllergenText,
  normalizeAllergenValues,
} from './allergen-values';

export class SaveAllergenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeAllergenText(value) : value,
  )
  nameZh: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeAllergenText(value) || null : value,
  )
  nameEn?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? normalizeAllergenValues(value)
      : value,
  )
  aliases?: string[];
}
