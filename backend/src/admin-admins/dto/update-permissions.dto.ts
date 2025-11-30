import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class UpdatePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: '权限列表不能为空' })
  permissions: string[];
}
