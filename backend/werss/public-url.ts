/** Resolve WeRSS-owned resources against Vite's deployment base. */
export function publicUrl(value: string | null | undefined): string {
  if (!value) return ''
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (!value.startsWith('/') || value.startsWith('//') || value === base || value.startsWith(`${base}/`)) return value
  return `${base}${value}`
}
