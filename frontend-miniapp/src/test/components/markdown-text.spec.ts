import { mount } from '@vue/test-utils';
import MarkdownText from '@/pages/ai-chat/components/MarkdownText.vue';

function render(content: string): HTMLElement {
  const wrapper = mount(MarkdownText, {
    props: { content },
    global: {
      stubs: {
        'rich-text': {
          props: ['nodes'],
          template: '<div v-html="nodes"></div>',
        },
      },
    },
  });
  const element = wrapper.element.cloneNode(true) as HTMLElement;
  wrapper.unmount();
  return element;
}

test.each([
  ['paragraph', '第一段', 'p'],
  ['heading', '# 标题', 'h1'],
  ['unordered list', '- 一\n- 二', 'ul'],
  ['ordered list', '3. 三\n4. 四', 'ol'],
  ['blockquote', '> 引用', 'blockquote'],
  ['table', '| A | B |\n| --- | --- |\n| 一 | 二 |', 'table'],
  ['fenced code', '```js\nconst n = 1;\n```', 'pre'],
  ['indented code', '    const n = 1;', 'pre'],
  ['horizontal rule', '---', 'hr'],
])('marks a root %s block for native-compatible edge spacing', (_, content, tag) => {
  const root = render(content).querySelector('.markdown-body')!;
  expect(root.children).toHaveLength(1);
  expect(root.firstElementChild!.tagName.toLowerCase()).toBe(tag);
  expect(root.querySelector(':scope > .md-block:first-child')).toBe(root.firstElementChild);
  expect(root.querySelector(':scope > .md-block:last-child')).toBe(root.lastElementChild);
});

test('keeps all root blocks and nested list items independently styled', () => {
  const root = render('# 标题\n\n正文\n\n- 外层\n  - 内层\n\n> 引用').querySelector(
    '.markdown-body'
  )!;
  expect(root.children).toHaveLength(4);
  expect(Array.from(root.children).every(element => element.classList.contains('md-block'))).toBe(
    true
  );
  expect(root.querySelectorAll('li.md-li')).toHaveLength(2);
  expect(root.querySelector('ul ul')).not.toBeNull();
});

test('keeps tight lists compact and preserves paragraphs in loose lists', () => {
  const tight = render('- 一\n- 二');
  expect(tight.querySelectorAll('li > p')).toHaveLength(0);
  const loose = render('- 一\n\n- 二');
  expect(loose.querySelectorAll('li > p.md-p')).toHaveLength(2);
});

test('retains ordered-list numbering and table alignment from markdown-it', () => {
  const root = render('3. 三\n4. 四\n\n| A | B |\n| :--- | ---: |\n| 一 | 二 |');
  expect(root.querySelector('ol')!.getAttribute('start')).toBe('3');
  expect((root.querySelector('th') as HTMLElement).style.textAlign).toBe('left');
  expect((root.querySelector('td:last-child') as HTMLElement).style.textAlign).toBe('right');
});

test('keeps inline classes and escapes raw HTML and code', () => {
  const root = render(
    '**粗体** *斜体* ~~删除~~ [链接](https://example.invalid) `a < b`\n\n<script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(1)>\n```'
  );
  expect(root.querySelector('strong.md-strong')!.textContent).toBe('粗体');
  expect(root.querySelector('em.md-em')!.textContent).toBe('斜体');
  expect(root.querySelector('s.md-s')!.textContent).toBe('删除');
  expect(root.querySelector('a.md-a')!.getAttribute('href')).toBe('https://example.invalid');
  expect(root.querySelector('code.md-code-inline')!.textContent).toBe('a < b');
  expect(root.querySelector('pre.md-pre code.md-code')!.textContent).toContain(
    '<img src=x onerror=alert(1)>'
  );
  expect(root.querySelector('script, [onerror]')).toBeNull();
});

test('preserves image text and rejects unsafe image URLs', () => {
  const root = render(
    '![**示意**](https://example.invalid/image.png "图片")\n\n![错误](javascript:alert(1))'
  );
  const image = root.querySelector('img.md-img')!;
  expect(image.getAttribute('alt')).toBe('示意');
  expect(image.getAttribute('title')).toBe('图片');
  expect(root.querySelectorAll('img')).toHaveLength(1);
});

test('reacts to new content without reusing earlier blocks', async () => {
  const wrapper = mount(MarkdownText, { props: { content: '# 旧标题' } });
  expect(wrapper.findComponent({ name: 'rich-text' }).attributes('nodes')).toContain('旧标题');
  await wrapper.setProps({ content: '新正文' });
  const nodes = wrapper.findComponent({ name: 'rich-text' }).attributes('nodes');
  expect(nodes).toContain('新正文');
  expect(nodes).not.toContain('旧标题');
  wrapper.unmount();
});
