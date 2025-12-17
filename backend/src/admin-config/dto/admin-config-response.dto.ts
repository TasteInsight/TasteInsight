import {
  BaseResponseDto,
  PaginationMeta,
  SuccessResponseDto,
} from '@/common/dto/response.dto';

// 配置模板 DTO
export class ConfigTemplateDto {
  id: string;
  key: string;
  defaultValue: string;
  valueType: string;
  description: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

// 配置项 DTO
export class ConfigItemDto {
  id: string;
  adminConfigId: string;
  templateId: string | null;
  key: string;
  value: string;
  valueType: string;
  description: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

// 配置 DTO（包含配置项列表）
export class AdminConfigDto {
  id: string;
  canteenId: string | null;
  items: ConfigItemDto[];
  createdAt: Date;
  updatedAt: Date;
}

// 获取全局配置响应
export class GlobalConfigResponseDto extends BaseResponseDto<{
  config: AdminConfigDto | null;
  templates: ConfigTemplateDto[];
}> {}

// 获取食堂配置响应
export class CanteenConfigResponseDto extends BaseResponseDto<{
  config: AdminConfigDto | null;
  globalConfig: AdminConfigDto | null;
  templates: ConfigTemplateDto[];
}> {}

// 获取所有配置模板响应
export class ConfigTemplateListResponseDto extends BaseResponseDto<{
  items: ConfigTemplateDto[];
  meta: PaginationMeta;
}> {}

// 更新配置项响应
export class ConfigItemResponseDto extends BaseResponseDto<ConfigItemDto> {}

// 配置值（用于有效配置查询）
export class EffectiveConfigValueDto {
  key: string;
  value: string;
  valueType: string;
  source: 'canteen' | 'global' | 'default';
}

// 有效配置响应
export class EffectiveConfigListResponseDto extends BaseResponseDto<{
  items: EffectiveConfigValueDto[];
}> {}

// 成功响应
export class ConfigSuccessResponseDto extends SuccessResponseDto {}
