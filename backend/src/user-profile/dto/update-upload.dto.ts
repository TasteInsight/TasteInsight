import { IsInt, Min } from 'class-validator';
import { UploadDishDto } from '@/dishes/dto/upload-dish.dto';

export class UpdateUploadDto extends UploadDishDto {
  @IsInt()
  @Min(1)
  revision: number;
}

export class UploadRevisionDto {
  @IsInt()
  @Min(1)
  revision: number;
}
