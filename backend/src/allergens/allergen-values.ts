export interface AllergenEntry {
  value: string;
  nameZh: string;
  nameEn?: string | null;
  aliases: string[];
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
      if (name) index.set(name.trim().toLowerCase(), entry);
  const expanded = new Map<string, string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const entry = index.get(value.toLowerCase());
    const names = entry
      ? [entry.value, entry.nameEn, entry.nameZh, ...entry.aliases]
      : [value];
    for (const name of names)
      if (name && !expanded.has(name.toLowerCase()))
        expanded.set(name.toLowerCase(), name);
  }
  return [...expanded.values()];
}

export function parseAllergenValues(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，;；、\n\r]+/)
      : typeof value === 'number'
        ? [value]
        : [];
  return values.map((item) => String(item).trim()).filter(Boolean);
}
