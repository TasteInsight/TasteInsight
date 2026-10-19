import sanitizeHtml from 'sanitize-html';

export function wechatArticleUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'mp.weixin.qq.com' ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/s(?:\/|$)/.test(url.pathname)
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function cleanNewsContent(html: string): string {
  const length =
    /^(?:auto|0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%))(?:\s+(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%))){0,3}$/;
  const styles: Record<string, RegExp[]> = {};
  for (const name of [
    'width',
    'height',
    'max-width',
    'min-width',
    'padding',
    'padding-top',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'margin',
    'margin-top',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'font-size',
    'border-radius',
    'border-width',
    'letter-spacing',
    'text-indent',
  ])
    styles[name] = [length];
  for (const name of [
    'text-align',
    'line-height',
    'font-family',
    'font-weight',
    'font-style',
    'color',
    'background-color',
    'text-decoration',
    'border-color',
    'border-style',
    'display',
    'vertical-align',
    'white-space',
    'word-break',
    'box-sizing',
    'overflow',
    'align-self',
    'align-items',
    'justify-content',
    'flex-direction',
    'flex-wrap',
    'gap',
    'grid-template-columns',
    'grid-template-rows',
    'grid-column-start',
    'grid-column-end',
    'grid-row-start',
    'grid-row-end',
  ])
    styles[name] = [/^[\w\s#.,()%\-'\u4e00-\u9fff]+$/];
  styles['aspect-ratio'] = [
    /^(?:auto|\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)$/,
  ];
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'referrerpolicy'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      ol: ['start'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    allowedStyles: { '*': styles },
    transformTags: {
      img: (_tag, attrs) => ({
        tagName: 'img',
        attribs: {
          ...attrs,
          src: attrs['data-src'] || attrs.src || '',
          referrerpolicy: 'no-referrer',
          style: `${attrs.style || ''};max-width:100%;height:auto;`,
        },
      }),
      a: (_tag, attrs) => ({
        tagName: 'a',
        attribs: { ...attrs, rel: 'noopener noreferrer' },
      }),
    },
  });
}

export function newsSummary(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}
