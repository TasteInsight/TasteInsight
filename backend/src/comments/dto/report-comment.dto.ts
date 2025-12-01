import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReportType } from '@/common/enums';

export class ReportCommentDto {
  @IsNotEmpty()
  @IsEnum(ReportType)
  type: ReportType;

  @IsNotEmpty()
  @IsString()
  reason: string;
}
