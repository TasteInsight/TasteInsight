<template>
  <AdminDialog
    :open="!!model"
    placement="right"
    labelledby="model-detail-title"
    @close="$emit('close')"
  >
    <section v-if="model" class="model-drawer admin-dialog-panel">
      <header class="admin-dialog-header flex items-start justify-between gap-4 shrink-0">
        <div class="min-w-0">
          <h2 id="model-detail-title" class="text-lg font-semibold break-words">
            {{ index?.name || model.name }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 break-words">
            <span v-if="index">{{ model.name }} · </span>{{ model.serviceVersion }} ·
            {{ model.kind === 'ranking' ? '排序模型' : '向量模型'
            }}<span v-if="model.dimension"> · {{ model.dimension }} 维</span>
          </p>
        </div>
        <button
          type="button"
          autofocus
          class="admin-icon-button text-gray-500 hover:bg-gray-100"
          :aria-label="index ? '关闭索引详情' : '关闭模型详情'"
          @click="$emit('close')"
        >
          <AppIcon icon="carbon:close" aria-hidden="true" />
        </button>
      </header>
      <div class="admin-dialog-body min-h-0 overflow-y-auto flex-1">
        <h3 class="font-semibold mb-3">{{ index ? '固定参数' : '参数声明' }}</h3>
        <p v-if="index" class="mb-3 text-sm text-gray-600">
          构建与查询共同使用以下参数。调整参数时创建新索引。
        </p>
        <table
          v-if="fields.length"
          class="parameter-table"
          :aria-label="index ? '索引固定参数' : '模型参数声明'"
        >
          <colgroup>
            <col style="width: 38%" />
            <col style="width: 17%" />
            <col style="width: 17%" />
            <col style="width: 28%" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">参数</th>
              <th scope="col">类型</th>
              <th scope="col">{{ index ? '固定值' : '默认值' }}</th>
              <th scope="col">范围 / 可选值</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="field in fields" :key="field.name">
              <tr class="parameter-values">
                <th scope="row">
                  {{ field.title
                  }}<code class="block text-xs font-normal text-gray-500">{{ field.name }}</code>
                </th>
                <td>{{ field.type }}</td>
                <td class="tabular-nums">{{ String(field.value) }}</td>
                <td>{{ field.range }}</td>
              </tr>
              <tr class="parameter-description">
                <td colspan="4">
                  <p v-if="field.description">{{ field.description }}</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <p v-else class="text-sm text-gray-500">
          {{
            index
              ? '此索引使用固定模型配置，参数为空。'
              : model.status === 'ready'
                ? '此模型使用固定配置，暂无可调整参数。'
                : '验证模型契约后显示参数声明。'
          }}
        </p>
        <details class="model-technical mt-6 border-t border-gray-200 pt-3">
          <summary class="cursor-pointer text-sm text-gray-600 py-2">技术信息</summary>
          <dl class="mt-3 space-y-3 text-sm">
            <div v-if="index">
              <dt class="text-gray-500">索引 ID</dt>
              <dd class="break-all">{{ index.id }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">部署</dt>
              <dd class="break-words">{{ model.deploymentId || '本地' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">特征版本</dt>
              <dd class="break-all">{{ model.featureSchemaVersion }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">制品摘要</dt>
              <dd class="font-mono text-xs break-all mt-1">{{ model.artifactDigest }}</dd>
            </div>
          </dl>
        </details>
      </div>
    </section>
  </AdminDialog>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import AppIcon from '@/components/Common/AppIcon.vue'
import type { RecommendationModel, RecommendationIndex } from '@/api/modules/recommendation'
const props = defineProps<{ model: RecommendationModel | null; index?: RecommendationIndex }>()
defineEmits<{ close: [] }>()
const typeLabels = { number: '数值', integer: '整数', boolean: '布尔值', string: '枚举' }
const fields = computed(() => {
  const declarations = props.model?.parameterSchema?.properties ?? {}
  const values =
    props.index?.parameters ??
    Object.fromEntries(Object.entries(declarations).map(([name, field]) => [name, field.default]))
  return Object.entries(values).map(([name, value]) => {
    const field = declarations[name]
    return {
      name,
      title: field?.title ?? name,
      value,
      description: field?.description,
      type: field
        ? typeLabels[field.type]
        : typeof value === 'number'
          ? '数值'
          : typeof value === 'boolean'
            ? '布尔值'
            : '文本',
      range: !field
        ? '—'
        : field.type === 'number' || field.type === 'integer'
          ? `${field.minimum}–${field.maximum}`
          : field.type === 'string'
            ? field.enum.join('、')
            : 'true / false',
    }
  })
})
</script>
<style scoped>
.model-drawer {
  display: flex;
  flex-direction: column;
  width: min(100%, 640px);
  height: 100%;
  border-radius: 0;
  margin: 0;
}
.parameter-table {
  width: 100%;
  table-layout: fixed;
  text-align: left;
  font-size: 14px;
  line-height: 1.5;
}
.parameter-table th,
.parameter-table td {
  overflow-wrap: anywhere;
  text-align: left;
  vertical-align: top;
}
.parameter-table thead th {
  padding: 8px 6px;
  font-weight: 500;
  color: #667085;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.parameter-values th,
.parameter-values td {
  padding: 12px 6px 4px;
}
.parameter-values th {
  font-weight: 500;
}
.parameter-description td {
  padding: 0 6px 12px;
  color: #4b5563;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}
.model-technical summary:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
@media (max-width: 639px) {
  .parameter-table {
    font-size: 13px;
  }
  .parameter-table thead th,
  .parameter-values th,
  .parameter-values td,
  .parameter-description td {
    padding-inline: 4px;
  }
}
</style>
