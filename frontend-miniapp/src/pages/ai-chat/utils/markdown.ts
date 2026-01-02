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
  // Escape first to avoid HTML injection, then add a modest subset of markdown.
  let safe = escapeHtml(text);

  // Inline code: `code`
  safe = safe.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

  // Strikethrough: ~~text~~
  safe = safe.replace(/~~([^~]+?)~~/g, '<del>$1</del>');

  // Bold: **text**
  safe = safe.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (conservative)
  safe = safe.replace(/(^|[^\w*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  safe = safe.replace(/(^|[^\w_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

  // Image: ![alt](url)
  safe = safe.replace(/!\[([^\]]*?)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const clean = sanitizeHref(url);
    if (!clean) return escapeHtml(alt);
    return `<img src="${escapeHtml(clean)}" alt="${escapeHtml(alt)}" />`;
  });

  // Link: [text](url)
  safe = safe.replace(/\[([^\]\n]+?)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const clean = sanitizeHref(href);
    if (!clean) return label;
    return `<a href="${escapeHtml(clean)}">${label}</a>`;
  });

  // Autolink plain URLs -> <a>
  safe = safe.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_m, pre, url) => `${pre}<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);

  // Hard line break (two spaces at EOL) -> <br/>
  safe = safe.replace(/ {2}\n/g, '<br/>');

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
  // Pre-process: split inline lists like "...教学楼 -紫荆园..." into separate lines before parsing.
  function splitInlineLists(text: string) {
    const lines = text.split('\n');
    let inFence = false;
    const out: string[] = [];
    for (let l of lines) {
      if (/^\s*```/.test(l)) {
        inFence = !inFence;
        out.push(l);
        continue;
      }
      if (!inFence && l.includes(' -')) {
        const parts = l.split(/\s-(?=[^\s-])/);
        if (parts.length > 1) {
          out.push(parts[0]);
          for (let j = 1; j < parts.length; j++) {
            out.push('-' + parts[j].trim());
          }
          continue;
        }
      }
      out.push(l);
    }
    return out.join('\n');
  }

  const md = splitInlineLists((markdown || '').replace(/\r\n/g, '\n'));
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

    // ATX Heading: #/##/... up to ###### — allow no space between # and text
    const headingMatch = line.match(/^\s*(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length);
      const text = parseInlineMarkdown(headingMatch[2].trim());
      parts.push(`<h${level} class="md-heading md-h${level}">${text}</h${level}>`);
      i++;
      continue;
    }

    // Setext-style heading (underlined with === or ---)
    const nextLine = (i + 1) < lines.length ? lines[i + 1].trim() : '';
    const setextH1 = /^={3,}\s*$/.test(nextLine);
    const setextH2 = /^-{3,}\s*$/.test(nextLine);
    if ((setextH1 || setextH2) && line.trim()) {
      const level = setextH1 ? 1 : 2;
      const text = parseInlineMarkdown(line.trim());
      parts.push(`<h${level} class="md-heading md-h${level}">${text}</h${level}>`);
      i += 2; // skip underline
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

    // Table: header with pipes + separator of dashes
    const tableHeaderMatch = line.match(/^\s*\|?(.+\|.+)\|?\s*$/);
    const nextIsSeparator = i + 1 < lines.length && /^\s*\|?\s*:?[-]+:?(\s*\|\s*:?[-]+:?)+\|?\s*$/.test(lines[i + 1]);
    if (tableHeaderMatch && nextIsSeparator) {
      const headers = tableHeaderMatch[1].split('|').map(s => s.trim());
      i += 2; // skip header and separator
      const rows: string[] = [];
      while (i < lines.length) {
        const r = lines[i].match(/^\s*\|?(.+\|.*)\|?\s*$/);
        if (!r) break;
        const cols = r[1].split('|').map(c => parseInlineMarkdown(c.trim()));
        rows.push(`<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`);
        i++;
      }
      parts.push(`<table><thead><tr>${headers.map(h => `<th>${parseInlineMarkdown(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`);
      continue;
    }

    // Unordered list (with optional task checkbox) — accept no space after '-' as well
    const ulMatch = line.match(/^\s*[-*+]\s*(.*)$/);
    if (ulMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*+]\s*(?:\[([ xX])\]\s*)?(.*)$/);
        if (!m) break;
        const checked = m[1];
        const content = parseInlineMarkdown(m[2]);
        const prefix = checked === 'x' || checked === 'X' ? '☑ ' : (checked === ' ' ? '☐ ' : '');
        items.push(`<li>${prefix}${content}</li>`);
        i++;
      }
      parts.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list — accept optional space after dot
    const olMatch = line.match(/^\s*(\d+)\.\s*(.*)$/);
    if (olMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)\.\s*(.*)$/);
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
      if (/^\s*(#{1,6})\s*/.test(cur)) break;
      if (/^\s*>\s?/.test(cur)) break;
      if (/^\s*[-*+]\s+/.test(cur) || /^\s*\d+\.\s+/.test(cur)) break;
      paragraphLines.push(parseInlineMarkdown(cur));
      i++;
    }

    parts.push(`<p>${paragraphLines.join('<br/>')}</p>`);
  }

  return `<div>${parts.join('')}</div>`;
}
