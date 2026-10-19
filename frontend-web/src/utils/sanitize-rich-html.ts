import DOMPurify from 'dompurify'

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
const ALLOWED_TAGS = new Set([
  'section',
  'figure',
  'figcaption',
  'p',
  'div',
  'span',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'a',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'colgroup',
  'col',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'hr',
])
const ALLOWED_STYLES = [
  'text-align',
  'text-indent',
  'line-height',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'color',
  'background-color',
  'text-decoration',
]

const safeUrl = (value: string, image: boolean): string | null => {
  try {
    const url = new URL(value, document.baseURI)
    const protocols = image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:']
    return protocols.includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

/** Keep the editor's display HTML without executable elements or attributes. */
export function sanitizeRichHtml(html: string, preserveLayout = false): string {
  const source = document.createElement('template')
  source.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['svg', 'math'],
  })
  const output = document.createElement('div')

  const appendSafeNodes = (parent: Node, destination: Node): void => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        destination.appendChild(document.createTextNode(node.textContent || ''))
        continue
      }
      if (!(node instanceof Element)) continue
      const tag = node.localName
      if (node.namespaceURI !== HTML_NAMESPACE || !ALLOWED_TAGS.has(tag)) continue

      const element = document.createElement(tag)
      for (const name of ['title', ...(tag === 'img' ? ['alt'] : [])]) {
        if (node.hasAttribute(name)) element.setAttribute(name, node.getAttribute(name) || '')
      }

      if (tag === 'a' || tag === 'img') {
        const attribute = tag === 'img' ? 'src' : 'href'
        const value = node.getAttribute(attribute)
        const url = value ? safeUrl(value, tag === 'img') : null
        if (url) element.setAttribute(attribute, url)
        if (tag === 'a') {
          if (node.getAttribute('target') === '_blank') element.setAttribute('target', '_blank')
          element.setAttribute('rel', 'noopener noreferrer')
        } else {
          element.setAttribute('referrerpolicy', 'no-referrer')
        }
      }

      const numberAttributes =
        tag === 'img'
          ? ['width', 'height']
          : tag === 'td' || tag === 'th'
            ? ['colspan', 'rowspan']
            : tag === 'ol'
              ? ['start']
              : []
      for (const attribute of numberAttributes) {
        const value = node.getAttribute(attribute)
        if (value && /^\d+$/.test(value)) element.setAttribute(attribute, value)
      }

      const originalStyle = (node as HTMLElement).style
      for (const property of ALLOWED_STYLES) {
        const value = originalStyle.getPropertyValue(property)
        if (value) element.style.setProperty(property, value)
      }
      if (preserveLayout) {
        for (const property of [
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
          'height',
          'white-space',
          'word-break',
          'width',
          'max-width',
          'min-width',
          'border-radius',
          'border-width',
          'border-style',
          'border-color',
          'display',
          'box-sizing',
          'letter-spacing',
          'vertical-align',
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
        ]) {
          const value = originalStyle.getPropertyValue(property)
          if (value && /^[\w\s#.,()%\-'\u4e00-\u9fff]+$/.test(value))
            element.style.setProperty(property, value)
        }
      }
      if (preserveLayout) {
        const aspectRatio = originalStyle.getPropertyValue('aspect-ratio')
        if (/^(?:auto|\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)$/.test(aspectRatio))
          element.style.setProperty('aspect-ratio', aspectRatio)
      }
      if (tag === 'img') {
        for (const property of ['width', 'height']) {
          const value = originalStyle.getPropertyValue(property)
          // The editor serializes image sizes as percentages, pixels or auto.
          if (/^(?:auto|(?:\d+(?:\.\d+)?|\.\d+)(?:px|%))$/.test(value)) {
            element.style.setProperty(property, value)
          }
        }
      }
      appendSafeNodes(node, element)
      destination.appendChild(element)
    }
  }

  appendSafeNodes(source.content, output)
  return output.innerHTML
}
