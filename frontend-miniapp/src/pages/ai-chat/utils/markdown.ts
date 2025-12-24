function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlPreserveSpaces(input: string): string {
  // For <pre><code> blocks: preserve spaces/tabs visually.
  // WeChat rich-text generally respects whitespace in <pre>, but using &nbsp; is a safer fallback.
  return escapeHtml(input).replace(/\t/g, '    ').replace(/ /g, '&nbsp;');
}

function sanitizeHref(href: string): string {
  const trimmed = (href || '').trim();
  if (!trimmed) return '';
  // Only allow http(s) to avoid javascript: etc.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
}

function parseInlineMarkdown(text: string): string {
  // Escape first to avoid HTML injection, then add a tiny subset of markdown.
  let safe = escapeHtml(text);

  // Inline code: `code`
  safe = safe.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

  // Bold: **text**
  safe = safe.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (keep it conservative, avoid matching list markers)
  safe = safe.replace(/(^|[^\w*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  safe = safe.replace(/(^|[^\w_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

  // Link: [text](url)
  safe = safe.replace(/\[([^\]\n]+?)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const clean = sanitizeHref(href);
    if (!clean) return label;
    return `<a href="${escapeHtml(clean)}">${label}</a>`;
  });

  return safe;
}

/**
 * Very small markdown -> HTML converter for chat rendering.
 * Supported:
 * - Paragraphs + line breaks
 * - Ordered/unordered lists
 * - Headings (#/##/###) -> rendered as bold paragraphs
 * - Blockquote (>)
 * - Links [text](https://...)
 * - Inline code (`code`) and fenced code blocks (```)
 * - Bold/Italic
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

    // Fenced code block: ```lang? ... ```
    const fenceMatch = line.match(/^\s*```/);
    if (fenceMatch) {
      i++; // skip opening fence
      const codeLines: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence

      const code = escapeHtmlPreserveSpaces(codeLines.join('\n'));
      parts.push(`<pre><code>${code}</code></pre>`);
      continue;
    }

    // Heading: #/##/###
    const headingMatch = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const text = parseInlineMarkdown(headingMatch[2].trim());
      parts.push(`<p><strong>${text}</strong></p>`);
      i++;
      continue;
    }

    // Blockquote: >
    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*>\s?(.*)$/);
        if (!m) break;
        quoteLines.push(parseInlineMarkdown(m[1]));
        i++;
      }
      parts.push(`<blockquote>${quoteLines.join('<br/>')}</blockquote>`);
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
      if (/^\s*```/.test(cur)) break;
      if (/^\s*(#{1,3})\s+/.test(cur)) break;
      if (/^\s*>\s?/.test(cur)) break;
      if (/^\s*[-*+]\s+/.test(cur) || /^\s*\d+\.\s+/.test(cur)) break;
      paragraphLines.push(parseInlineMarkdown(cur));
      i++;
    }

    parts.push(`<p>${paragraphLines.join('<br/>')}</p>`);
  }

  return `<div>${parts.join('')}</div>`;
}
