import { PartialType } from '@nestjs/swagger';
import { CreateCanteenDto, WindowDto, FloorDto, OpeningHours } from './create-canteen.dto';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWindowDto extends WindowDto {
  @IsString()
  @IsOptional()
  id?: string;
}

export class UpdateFloorDto extends FloorDto {
  @IsString()
  @IsOptional()
  id?: string;
}

export class UpdateCanteenDto extends PartialType(CreateCanteenDto) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWindowDto)
  @IsOptional()
  windows?: UpdateWindowDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFloorDto)
  @IsOptional()
  floors?: UpdateFloorDto[];
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHours)
  @IsOptional()
  openingHours?: OpeningHours[];
}
