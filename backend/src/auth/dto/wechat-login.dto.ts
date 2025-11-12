import { IsNotEmpty, IsString } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}