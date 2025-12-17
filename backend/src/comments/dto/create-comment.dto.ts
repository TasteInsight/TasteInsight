import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  reviewId: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;

  @IsNotEmpty()
  @IsString()
  content: string;
}
