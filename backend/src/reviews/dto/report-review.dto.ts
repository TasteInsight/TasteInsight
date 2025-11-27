import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { BaseResponseDto } from '@/common/dto/response.dto';

export enum ReportType {
  INAPPROPRIATE = 'inappropriate',
  SPAM = 'spam',
  FALSE_INFO = 'false_info',
  OTHER = 'other',
}

export class ReportReviewDto {
  @IsNotEmpty()
  @IsEnum(ReportType)
  type: ReportType;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ReportReviewResponseDto extends BaseResponseDto<string>{}