import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectReviewDto {
  @ApiProperty({ description: '拒绝原因' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
