import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class RatingDetailsDto {
  @IsInt()
  @Min(1)
  @Max(5)
  spicyLevel: number;

  @IsInt()
  @Min(1)
  @Max(5)
  sweetness: number;

  @IsInt()
  @Min(1)
  @Max(5)
  saltiness: number;

  @IsInt()
  @Min(1)
  @Max(5)
  oiliness: number;
}

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  dishId: string;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  ratingDetails?: RatingDetailsDto | null;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
