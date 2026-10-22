import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface AllergenEntry {
  value: string
  nameZh: string
  nameEn: string | null
  aliases: string[]
}
export interface TranslationDraft {
  nameEn: string
  descriptionEn: string
}
export interface TranslationStatus {
  enabled: boolean
  available: boolean
}
export interface TranslationSettings extends TranslationStatus {
  model: string
  baseUrl: string
  apiKeyConfigured: boolean
  invalidFields: ('enabled' | 'baseUrl')[]
  managedByEnv: Record<'enabled' | 'model' | 'baseUrl' | 'apiKey', boolean>
}
export interface TranslationSettingsUpdate {
  enabled?: boolean
  model?: string
  baseUrl?: string
  apiKey?: string | null
}
export const contentLocalizationApi = {
  translationStatus: (signal?: AbortSignal): Promise<ApiResponse<TranslationStatus>> =>
    request.get('/admin/content-translations/status', { signal }),
  translationSettings: (signal?: AbortSignal): Promise<ApiResponse<TranslationSettings>> =>
    request.get('/admin/content-translations/settings', { signal }),
  updateTranslationSettings: (
    input: TranslationSettingsUpdate,
    signal?: AbortSignal,
  ): Promise<ApiResponse<TranslationSettings>> =>
    request.put('/admin/content-translations/settings', input, { signal }),
  catalog: (): Promise<ApiResponse<AllergenEntry[]>> => request.get('/admin/allergens'),
  saveAllergen: (
    input: { nameZh: string; nameEn: string | null; aliases: string[] },
    value?: string,
  ): Promise<ApiResponse<AllergenEntry>> =>
    value
      ? request.put('/admin/allergens/' + encodeURIComponent(value), input)
      : request.post('/admin/allergens', input),
  draft: (
    input: { kind: 'dish' | 'allergen'; name: string; description?: string },
    signal: AbortSignal,
  ): Promise<ApiResponse<TranslationDraft>> =>
    request.post('/admin/content-translations', input, { signal }),
}
