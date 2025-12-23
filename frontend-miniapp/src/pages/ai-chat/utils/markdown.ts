function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseInlineMarkdown(text: string): string {
  // Escape first to avoid HTML injection, then add a tiny subset of markdown.
  let safe = escapeHtml(text);

  // Bold: **text**
  safe = safe.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');

  return safe;
}

/**
 * Very small markdown -> HTML converter for chat rendering.
 * Supported:
 * - Paragraphs + line breaks
 * - Ordered/unordered lists
 * - Bold (**text**)
 *
 * Output is safe HTML with a limited tag set suitable for mp-weixin rich-text.
 */
export function markdownToRichTextHtml(markdown: string): string {
  const md = (markdown || '').replace(/\r\n/g, '\n');
  const lines = md.split('\n');

  const parts: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ulMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*+]\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${parseInlineMarkdown(m[1])}</li>`);
        i++;
      }
      parts.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)\.\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${parseInlineMarkdown(m[2])}</li>`);
        i++;
      }
      parts.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph: consume until blank line or list start
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (!cur.trim()) break;
      if (/^\s*[-*+]\s+/.test(cur) || /^\s*\d+\.\s+/.test(cur)) break;
      paragraphLines.push(parseInlineMarkdown(cur));
      i++;
    }

    parts.push(`<p>${paragraphLines.join('<br/>')}</p>`);
  }

  return `<div>${parts.join('')}</div>`;
}
