import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';

export class ExperimentDto {
  id: string;
  name: string;
  description?: string;
  trafficRatio: number;
  startTime: Date;
  endTime?: Date;
  status: string;
  groups: {
    id: string;
    name: string;
    ratio: number;
    config?: Record<string, any>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export class ExperimentResponseDto extends BaseResponseDto<ExperimentDto> {}
export class ExperimentListResponseDto extends BaseResponseDto<{
  items: ExperimentDto[];
  meta: PaginationMeta;
}> {}

export class SuccessResponseDto extends BaseResponseDto<string> {}
