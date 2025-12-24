import { markdownToRichTextHtml } from '@/pages/ai-chat/utils/markdown';

describe('pages/ai-chat/utils/markdown.ts', () => {
  test('parseInlineMarkdown escapes and formats inline elements', () => {
    const md = 'Hello <b>!!</b> `code` **bold** *italic* [link](javascript:alert(1)) [ok](https://ex.com)';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('&lt;b&gt;!!&lt;/b&gt;');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    // javascript: link should be sanitized away leaving label
    expect(html).toContain('link');
    expect(html).not.toContain('javascript:');
    // http link should be converted to anchor
    expect(html).toContain('<a href="https://ex.com">ok</a>');
  });

  test('handles ATX headings, paragraphs and line breaks', () => {
    const md = '# Title\n\nLine one\nLine two';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('<h1');
    expect(html).toContain('Title');
    expect(html).toContain('<p>Line one<br/>Line two</p>');
  });

  test('handles h3 ATX and setext-style headings', () => {
    const md = '### Subtitle\n\nSubhead\n---\n\nNext paragraph';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('<h3');
    expect(html).toContain('Subtitle');
    expect(html).toContain('<h2');
    expect(html).toContain('Subhead');
    expect(html).toContain('<p>Next paragraph');
  });

  test('handles blockquote and unordered lists', () => {
    const md = '> Quote line\n\n- item1\n- item2';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('<blockquote>');
    expect(html).toContain('Quote line');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item1</li>');
    expect(html).toContain('<li>item2</li>');
  });

  test('handles fenced code blocks and preserves spaces', () => {
    const md = '```\n  <tag>  \n```';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('<pre><code>');
    // spaces should be preserved as &nbsp;
    expect(html).toContain('&nbsp;&nbsp;&lt;tag&gt;&nbsp;&nbsp;');
  });

  test('handles ordered lists', () => {
    const md = '1. first\n2. second';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('<ol>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
  });
});