import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class HandleReportDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['delete_content', 'warn_user', 'reject_report'])
  action: 'delete_content' | 'warn_user' | 'reject_report';

  @IsString()
  @IsOptional()
  result?: string;
}
