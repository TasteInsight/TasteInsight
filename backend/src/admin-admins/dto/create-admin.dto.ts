import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ArrayMinSize,
} from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/,
    {
      message: '密码必须包含大小写字母、数字和特殊符号，且不能包含空格',
    },
  )
  password: string;

  @IsString()
  @IsOptional()
  canteenId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: '权限列表不能为空' })
  permissions: string[];
}
