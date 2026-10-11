import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateDiningInviteDto {
  @IsDateString()
  date: string;

  @IsDateString()
  startsAt: string;

  @IsString()
  @IsNotEmpty()
  canteenId: string;

  @IsInt()
  @Min(2)
  @Max(8)
  capacity: number;
}

export class DecideDiningApplicationDto {
  @IsEnum(['accept', 'reject'])
  action: 'accept' | 'reject';
}
