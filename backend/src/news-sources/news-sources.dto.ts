import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateNewsSourceDto {
  @IsString() @IsNotEmpty() @MaxLength(255) mpId: string;
  @IsOptional() @IsString() @IsNotEmpty() canteenId?: string | null;
  @IsBoolean() enabled: boolean = true;
  @IsBoolean() autoPublish: boolean = false;
  @IsInt() @Min(5) @Max(1440) intervalMinutes: number = 30;
  @IsString() @MaxLength(200) keyword: string = '';
}
export class UpdateNewsSourceDto {
  @IsOptional() @IsString() @IsNotEmpty() canteenId?: string | null;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() autoPublish?: boolean;
  @IsOptional() @IsInt() @Min(5) @Max(1440) intervalMinutes?: number;
  @IsOptional() @IsString() @MaxLength(200) keyword?: string;
}
