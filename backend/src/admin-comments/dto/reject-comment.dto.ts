import { IsNotEmpty, IsString } from 'class-validator';

export class RejectCommentDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
