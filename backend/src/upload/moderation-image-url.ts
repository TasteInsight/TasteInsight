/** Keep an asset's identity stable across expiring preview signatures. */
export function canonicalModerationImageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      /\/content-moderation\/images\/[a-zA-Z0-9_-]{15,80}$/.test(url.pathname)
    )
      return url.origin + url.pathname;
  } catch {
    /* Legacy storage URLs retain their original identity. */
  }
  return value;
}

export function canonicalModerationImageUrls(values: string[]): string[] {
  return [...new Set(values.map(canonicalModerationImageUrl))];
}
