import { unicodeCaseFold } from './unicode-case-fold'

export function normalizeAllergenText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

export function allergenComparisonKey(value: string): string {
  return unicodeCaseFold(normalizeAllergenText(value))
}

export function parseAllergenList(text: string): string[] {
  const values = new Map<string, string>()
  for (const raw of text.split(/[,，;；、\n\r]+/)) {
    const value = normalizeAllergenText(raw)
    const key = allergenComparisonKey(value)
    if (value && !values.has(key)) values.set(key, value)
  }
  return [...values.values()]
}
