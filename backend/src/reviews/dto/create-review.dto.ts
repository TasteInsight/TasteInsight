import { IsString, IsInt, Min, Max, IsOptional, IsArray } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  dishId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
