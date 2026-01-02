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

  test('parses headings without space and inline list items split from same line', () => {
    const md = '###3。食堂位置提醒\n-桃李园：位于校园东区，靠近教学楼 -紫荆园：位于校园中心区域\n-建议提前规划路线，避免排队时间过长\n###4。反馈与调整\n-在食鉴平台上为菜品评分\n-告诉我你的用餐体验，我会根据反馈优化后续推荐';
    const html = markdownToRichTextHtml(md);

    expect(html).toContain('<h3');
    expect(html).toContain('食堂位置提醒');
    // the inline '-桃李园' should be split into list items
    expect(html).toContain('<li>桃李园');
    expect(html).toContain('<h3');
    expect(html).toContain('反馈与调整');
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