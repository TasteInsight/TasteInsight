import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * 修改自己密码的 DTO
 */
export class ChangeOwnPasswordDto {
  @IsString()
  @IsNotEmpty({ message: '当前密码不能为空' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=[\]{}|;:,.<>?]+$/,
    {
      message: '密码必须包含大小写字母、数字和特殊符号，且不能包含空格',
    },
  )
  newPassword: string;
}

/**
 * 修改子管理员密码的 DTO
 */
export class ChangeSubAdminPasswordDto {
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=[\]{}|;:,.<>?]+$/,
    {
      message: '密码必须包含大小写字母、数字和特殊符号，且不能包含空格',
    },
  )
  newPassword: string;

  @IsString()
  @IsOptional()
  confirmPassword?: string;
}
