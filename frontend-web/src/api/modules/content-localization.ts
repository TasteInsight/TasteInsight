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
export const contentLocalizationApi = {
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
