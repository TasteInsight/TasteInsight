import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdatePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissions: string[];
}
