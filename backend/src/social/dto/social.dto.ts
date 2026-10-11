import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReportType } from '@/common/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SocialQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsOptional() @IsString() @IsNotEmpty() authorId?: string;
}

export class AdminSocialQueryDto extends SocialQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

export class CreatePostDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) content: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { each: true },
  )
  images?: string[];
}

export class UpdatePostDto extends CreatePostDto {
  @IsDateString() @IsNotEmpty() expectedUpdatedAt: string;
}

export class CreatePostCommentDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(500) content: string;
  @IsOptional() @IsString() @IsNotEmpty() parentCommentId?: string;
}

export class ModeratePostDto {
  @IsDateString() @IsNotEmpty() expectedUpdatedAt: string;
}

export class RejectPostDto extends ModeratePostDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}

export class ReportPostDto {
  @IsEnum(ReportType) type: ReportType;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}
