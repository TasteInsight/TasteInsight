import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DishTranslationFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  nameEn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  descriptionEn?: string | null;
}
