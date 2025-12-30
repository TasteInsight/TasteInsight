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

// 将 markdown 转换为 HTML，并添加样式
const htmlContent = computed(() => {
  if (!props.content) return '';
  try {
    let html = md.render(props.content);
    
    // 添加样式类以确保正确渲染
    html = `<div class="markdown-body">${html}</div>`;
    
    return html;
  } catch (error) {
    console.error('Markdown 解析失败:', error);
    return `<p>${props.content}</p>`; // 失败时返回原始文本包裹在 p 标签中
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

:deep(.markdown-body p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  font-weight: bold;
  margin: 0.8em 0 0.4em;
}

:deep(.markdown-body h1) { font-size: 1.5em; }
:deep(.markdown-body h2) { font-size: 1.3em; }
:deep(.markdown-body h3) { font-size: 1.2em; }
:deep(.markdown-body h4) { font-size: 1.1em; }

:deep(.markdown-body code) {
  background: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

:deep(.markdown-body pre) {
  background: #f5f5f5;
  padding: 0.8em;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5em 0;
}

:deep(.markdown-body blockquote) {
  border-left: 3px solid #ddd;
  padding-left: 1em;
  margin: 0.5em 0;
  color: #666;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

:deep(.markdown-body li) {
  margin: 0.3em 0;
}

:deep(.markdown-body table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  border: 1px solid #ddd;
  padding: 0.5em;
}

:deep(.markdown-body th) {
  background: #f5f5f5;
  font-weight: bold;
}

:deep(.markdown-body a) {
  color: #1890ff;
  text-decoration: none;
}

:deep(.markdown-body strong) {
  font-weight: bold;
}

:deep(.markdown-body em) {
  font-style: italic;
}

:deep(.markdown-body del) {
  text-decoration: line-through;
}

:deep(.markdown-body img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0.5em 0;
}
</style>
