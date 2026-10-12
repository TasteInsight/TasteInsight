import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  code: string;

  @IsOptional()
  @IsIn(['mp-weixin', 'app'])
  platform?: 'mp-weixin' | 'app';
}
