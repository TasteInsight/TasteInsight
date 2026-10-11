import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export const BATCH_DELETE_MAX_IDS = 100;
export const BATCH_DELETE_MAX_ID_LENGTH = 128;

export class BatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BATCH_DELETE_MAX_IDS)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(BATCH_DELETE_MAX_ID_LENGTH, { each: true })
  ids: string[];
}
