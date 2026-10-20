import {
  IsIn,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdatePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsIn(['GLOBAL', 'CANTEENS'])
  scope: 'GLOBAL' | 'CANTEENS';

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  canteenIds: string[];
}
