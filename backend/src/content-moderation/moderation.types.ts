import type { DishUpload } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const PROVIDERS = ['aliyun', 'wechat'] as const;
export const MODES = ['manual', 'machine', 'machine_and_manual'] as const;
export type ModerationProvider = (typeof PROVIDERS)[number];
export type ModerationMode = (typeof MODES)[number];
export type ModerationTarget =
  | 'post'
  | 'postComment'
  | 'review'
  | 'comment'
  | 'profile'
  | 'dishUpload';
export interface ModerationPolicy {
  enabled: boolean;
  provider: ModerationProvider;
  mode: ModerationMode;
}
export interface Submission {
  targetType: ModerationTarget;
  targetId: string;
  userId: string;
  version: string;
  text: string;
  images?: string[];
  profilePatch?: Record<string, string | null>;
}
export class UpdateModerationSettingsDto {
  @IsBoolean()
  enabled: boolean;
  @IsIn(PROVIDERS)
  provider: ModerationProvider;
  @IsIn(MODES)
  mode: ModerationMode;
}
export class ModerationDecisionDto {
  @IsBoolean()
  approved: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export function contributionModerationText(
  upload: Pick<
    DishUpload,
    'name' | 'description' | 'priceUnit' | 'tags' | 'ingredients' | 'allergens'
  > &
    Partial<Pick<DishUpload, 'nameEn' | 'descriptionEn'>>,
): string {
  return [
    upload.name,
    upload.nameEn,
    upload.descriptionEn,
    upload.description,
    upload.priceUnit,
    ...upload.tags,
    ...upload.ingredients,
    ...upload.allergens,
  ]
    .filter(Boolean)
    .join('\n');
}
