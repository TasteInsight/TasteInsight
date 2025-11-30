import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { BaseResponseDto } from '@/common/dto/response.dto';
import { ReportType } from '@/common/enums';

export class ReportReviewDto {
  @IsNotEmpty()
  @IsEnum(ReportType)
  type: ReportType;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ReportReviewResponseDto extends BaseResponseDto<string> {}
