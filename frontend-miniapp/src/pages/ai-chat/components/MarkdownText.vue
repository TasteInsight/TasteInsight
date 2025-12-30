<template>
  <!-- 使用 rich-text 渲染 HTML，markdown-it 负责转换 markdown -->
  <rich-text :nodes="htmlContent" class="markdown-content" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
// @ts-ignore - markdown-it 缺少类型定义，但功能正常
import MarkdownIt from 'markdown-it';

const props = defineProps<{
  content: string;
}>();

// 初始化 markdown-it 解析器
const md = new MarkdownIt({
  html: false,        // 不允许 HTML 标签（安全考虑）
  linkify: true,      // 自动将 URL 转换为链接
  breaks: true,       // 将换行符转换为 <br>
  typographer: true   // 启用一些语言中立的替换和引号美化
});

// 为输出的 HTML 元素添加 class，避免在小程序端使用标签选择器导致兼容性问题
md.renderer.rules.paragraph_open = () => '<p class="md-p">';
md.renderer.rules.paragraph_close = () => '</p>';
md.renderer.rules.heading_open = (tokens: any[], idx: number) => {
  const tag = tokens[idx].tag; // e.g., h1
  return `<${tag} class="md-${tag}">`;
};
md.renderer.rules.heading_close = (tokens: any[], idx: number) => `</${tokens[idx].tag}>`;
md.renderer.rules.bullet_list_open = () => '<ul class="md-ul">';
md.renderer.rules.ordered_list_open = () => '<ol class="md-ol">';
md.renderer.rules.list_item_open = () => '<li class="md-li">';
md.renderer.rules.blockquote_open = () => '<blockquote class="md-blockquote">';
md.renderer.rules.table_open = () => '<table class="md-table">';
md.renderer.rules.th_open = () => '<th class="md-th">';
md.renderer.rules.td_open = () => '<td class="md-td">';

md.renderer.rules.fence = (tokens: any[], idx: number) => {
  const token: any = tokens[idx];
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
  const lang = info.split(/\s+/g)[0];
  const code = md.utils.escapeHtml(token.content);
  const langClass = lang ? ` language-${md.utils.escapeHtml(lang)}` : '';
  return `<pre class="md-pre"><code class="md-code${langClass}">${code}</code></pre>`;
};

md.renderer.rules.code_inline = (tokens: any[], idx: number) => `<code class="md-code-inline">${md.utils.escapeHtml(tokens[idx].content)}</code>`;

md.renderer.rules.image = (tokens: any[], idx: number) => {
  const token: any = tokens[idx];
  const src = token.attrGet ? token.attrGet('src') : (token.attrs && token.attrs.find((a: any) => a[0] === 'src')?.[1] || '');
  const alt = md.utils.escapeHtml(token.content || '');
  const title = token.attrGet && token.attrGet('title') ? ` title="${md.utils.escapeHtml(token.attrGet('title'))}"` : '';
  return `<img class="md-img" src="${md.utils.escapeHtml(src)}" alt="${alt}"${title} />`;
};

// 将 markdown 转换为 HTML，并添加样式类包装
const htmlContent = computed(() => {
  if (!props.content) return '';
  try {
    let html = md.render(props.content);
    html = `<div class="markdown-body">${html}</div>`;
    return html;
  } catch (error) {
    console.error('Markdown 解析失败:', error);
    return `<div class="markdown-body"><p class="md-p">${props.content}</p></div>`; // 失败时返回原始文本包裹在 p 标签中
  }
});
</script>

<style scoped>
/* markdown 内容样式 */
:deep(.markdown-content) {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  word-break: break-word;
}

:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;
}

:deep(.markdown-body .md-p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

:deep(.markdown-body .md-h1),
:deep(.markdown-body .md-h2),
:deep(.markdown-body .md-h3),
:deep(.markdown-body .md-h4),
:deep(.markdown-body .md-h5),
:deep(.markdown-body .md-h6) {
  font-weight: bold;
  margin: 0.8em 0 0.4em;
}

:deep(.markdown-body .md-h1) { font-size: 1.5em; }
:deep(.markdown-body .md-h2) { font-size: 1.3em; }
:deep(.markdown-body .md-h3) { font-size: 1.2em; }
:deep(.markdown-body .md-h4) { font-size: 1.1em; }

:deep(.markdown-body .md-code-inline) {
  background: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

:deep(.markdown-body .md-pre) {
  background: #f5f5f5;
  padding: 0.8em;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5em 0;
}

:deep(.markdown-body .md-blockquote) {
  border-left: 3px solid #ddd;
  padding-left: 1em;
  margin: 0.5em 0;
  color: #666;
}

:deep(.markdown-body .md-ul),
:deep(.markdown-body .md-ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

:deep(.markdown-body .md-li) {
  margin: 0.3em 0;
}

:deep(.markdown-body .md-table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
}

:deep(.markdown-body .md-th),
:deep(.markdown-body .md-td) {
  border: 1px solid #ddd;
  padding: 0.5em;
}

:deep(.markdown-body .md-th) {
  background: #f5f5f5;
  font-weight: bold;
}

:deep(.markdown-body .md-a) {
  color: #1890ff;
  text-decoration: none;
}

:deep(.markdown-body .md-strong) {
  font-weight: bold;
}

:deep(.markdown-body .md-em) {
  font-style: italic;
}

:deep(.markdown-body .md-del) {
  text-decoration: line-through;
}

:deep(.markdown-body .md-img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0.5em 0;
}
</style>
