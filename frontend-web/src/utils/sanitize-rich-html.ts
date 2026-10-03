const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr',
])
const ALLOWED_STYLES = [
  'text-align', 'text-indent', 'line-height', 'font-size', 'font-family',
  'font-weight', 'font-style', 'color', 'background-color', 'text-decoration',
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
export function sanitizeRichHtml(html: string): string {
  const source = document.createElement('template')
  source.innerHTML = html
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

      const numberAttributes = tag === 'img' ? ['width', 'height']
        : tag === 'td' || tag === 'th' ? ['colspan', 'rowspan']
        : tag === 'ol' ? ['start'] : []
      for (const attribute of numberAttributes) {
        const value = node.getAttribute(attribute)
        if (value && /^\d+$/.test(value)) element.setAttribute(attribute, value)
      }

      const originalStyle = (node as HTMLElement).style
      for (const property of ALLOWED_STYLES) {
        const value = originalStyle.getPropertyValue(property)
        if (value) element.style.setProperty(property, value)
      }
      appendSafeNodes(node, element)
      destination.appendChild(element)
    }
  }

  appendSafeNodes(source.content, output)
  return output.innerHTML
}
