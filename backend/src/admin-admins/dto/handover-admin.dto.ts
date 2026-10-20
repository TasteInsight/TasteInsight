import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HandoverAdminDto {
  @IsString()
  @IsNotEmpty()
  newManagerId: string;

  @IsOptional()
  @IsBoolean()
  retireSource?: boolean;
}
