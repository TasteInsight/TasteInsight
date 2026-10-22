import { unicodeCaseFold } from './unicode-case-fold';

export interface AllergenEntry {
  value: string;
  nameZh: string;
  nameEn?: string | null;
  aliases: string[];
}

export function normalizeAllergenText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function allergenComparisonKey(value: string): string {
  return unicodeCaseFold(normalizeAllergenText(value));
}

export function normalizeAllergenValues(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const raw of values) {
    const value = normalizeAllergenText(raw);
    const key = allergenComparisonKey(value);
    if (value && !unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()];
}

export function expandAllergenValues(
  values: string[],
  catalog: AllergenEntry[],
): string[] {
  const index = new Map<string, AllergenEntry>();
  for (const entry of catalog)
    for (const name of [
      entry.value,
      entry.nameZh,
      entry.nameEn,
      ...entry.aliases,
    ])
      if (name) index.set(allergenComparisonKey(name), entry);
  return normalizeAllergenValues(
    normalizeAllergenValues(values).flatMap((value) => {
      const entry = index.get(allergenComparisonKey(value));
      return entry
        ? [entry.value, entry.nameEn, entry.nameZh, ...entry.aliases].filter(
            (name): name is string => !!name,
          )
        : [value];
    }),
  );
}

export function parseAllergenValues(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，;；、\n\r]+/)
      : typeof value === 'number'
        ? [value]
        : [];
  return normalizeAllergenValues(values.map((item) => String(item)));
}
