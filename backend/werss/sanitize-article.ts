import DOMPurify from 'dompurify'

export function sanitizeArticle(html: string | null | undefined): string {
  return DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'style'],
  })
}
