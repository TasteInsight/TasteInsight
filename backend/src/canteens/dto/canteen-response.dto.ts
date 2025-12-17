import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import { CanteenDto, WindowDto } from './canteen.dto';

export class CanteenResponseDto extends BaseResponseDto<CanteenDto> {}

export class CanteenListResponseDto extends BaseResponseDto<{
  items: CanteenDto[];
  meta: PaginationMeta;
}> {}

export class WindowResponseDto extends BaseResponseDto<WindowDto> {}

export class WindowListResponseDto extends BaseResponseDto<{
  items: WindowDto[];
  meta: PaginationMeta;
}> {}
