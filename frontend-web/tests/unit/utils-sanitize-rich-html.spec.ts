import { describe, expect, it } from 'vitest'
import { sanitizeRichHtml } from '../../src/utils/sanitize-rich-html'

const parseResult = (html: string): HTMLDivElement => {
  const root = document.createElement('div')
  root.innerHTML = sanitizeRichHtml(html)
  return root
}

describe('sanitizeRichHtml', () => {
  it('preserves editor text, safe formatting, tables, images and links', () => {
    const root = parseResult('<h2>标题</h2><p style="text-align:center;color:red"><strong>正文</strong><em>斜体</em></p><table><tbody><tr><td colspan="2">表格</td></tr></tbody></table><img src="/image.png" alt="图片" width="120"><a href="https://example.com/path" target="_blank" rel="opener">链接</a>')
    expect(root.querySelector('h2')?.textContent).toBe('标题')
    expect(root.querySelector('strong')?.textContent).toBe('正文')
    expect(root.querySelector('p')?.style.textAlign).toBe('center')
    expect(root.querySelector('p')?.style.color).toBe('red')
    expect(root.querySelector('td')?.getAttribute('colspan')).toBe('2')
    expect(root.querySelector('img')?.getAttribute('src')).toBe(new URL('/image.png', document.baseURI).href)
    expect(root.querySelector('img')?.getAttribute('width')).toBe('120')
    expect(root.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('drops executable elements, event attributes, arbitrary CSS and comments', () => {
    const root = parseResult('<script>alert(1)</script><iframe src="https://example.com"></iframe><object data="x"></object><p onclick="alert(1)" style="position:fixed;top:0;background-image:url(https://example.com);color:blue">安全正文</p><img src="/missing.png" onerror="window.__richHtmlExecuted=true"><!-- comment -->')
    expect(root.querySelector('script,iframe,object')).toBeNull()
    expect(root.querySelector('[onclick],[onerror]')).toBeNull()
    expect(root.querySelector('p')?.style.position).toBe('')
    expect(root.querySelector('p')?.style.backgroundImage).toBe('')
    expect(root.querySelector('p')?.style.color).toBe('blue')
    root.querySelector('img')?.dispatchEvent(new Event('error'))
    expect((window as any).__richHtmlExecuted).toBeUndefined()
    expect(root.innerHTML).not.toContain('<!--')
  })

  it.each([
    'javascript:alert(1)', '&#106;avascript&#58;alert(1)', 'ja&#x09;vascript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)',
  ])('rejects decoded dangerous link URL %s', (url) => {
    expect(parseResult(`<a href="${url}">文本</a>`).querySelector('a')?.hasAttribute('href')).toBe(false)
  })

  it('rejects image data URLs and preserves attribute text without creating attributes', () => {
    const root = parseResult('<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="&quot; onerror=&quot;alert(1)"><a href="mailto:test@example.com">邮箱</a>')
    expect(root.querySelector('img')?.hasAttribute('src')).toBe(false)
    expect(root.querySelector('img')?.hasAttribute('onerror')).toBe(false)
    expect(root.querySelector('img')?.getAttribute('alt')).toBe('" onerror="alert(1)')
    expect(root.querySelector('a')?.getAttribute('href')).toBe('mailto:test@example.com')
  })

  it('drops SVG and MathML subtrees even when they contain HTML namespaces', () => {
    const root = parseResult('<svg><foreignObject><div><img src="/x" onerror="alert(1)"></div></foreignObject></svg><math><annotation-xml encoding="text/html"><p onclick="alert(1)">foreign</p></annotation-xml></math><p>普通正文</p>')
    expect(root.querySelector('svg,math,foreignObject,annotation-xml,img')).toBeNull()
    expect(root.querySelector('[onclick],[onerror]')).toBeNull()
    expect(root.textContent).toBe('普通正文')
  })
})
