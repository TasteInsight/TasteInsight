import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
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
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message: '密码必须包含大小写字母、数字和特殊符号',
    },
  )
  password: string;

  @IsString()
  @IsOptional()
  canteenId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissions: string[];
}
