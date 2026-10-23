<template>
  <section class="border border-gray-200 rounded-lg p-6 space-y-4">
    <h3 class="text-lg font-semibold">实际曝光效果</h3>
    <label class="admin-label"
      >统计时间窗<select v-model.number="days" class="admin-input ml-2" @change="load">
        <option :value="7">近 7 天</option>
        <option :value="14">近 14 天</option>
        <option :value="30">近 30 天</option>
      </select></label
    >
    <p class="text-sm text-gray-600">
      口径 v2：生产流量按下发、菜品、事件类型去重；CTR = 曝光集合内点击 / 实际曝光，曝光收藏率 =
      曝光集合内收藏 / 实际曝光。点击收藏比 = 曝光集合内收藏 / 曝光集合内点击。下发与预览单独计量。
    </p>
    <p v-if="loading" role="status">正在加载指标…</p>
    <p v-else-if="error" role="alert" class="admin-field-error">
      {{ error }} <button class="admin-button admin-button-secondary" @click="load">重试</button>
    </p>
    <div v-else-if="metrics" class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr>
            <th>分组</th>
            <th>下发请求</th>
            <th>实际曝光</th>
            <th>点击 / 收藏</th>
            <th>CTR</th>
            <th>曝光收藏率</th>
            <th>点击收藏比</th>
            <th>降级 / 请求</th>
            <th>平均延迟</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in metrics.groups" :key="group.groupItemId">
            <td>
              {{ groups.find((item) => item.id === group.groupItemId)?.name || group.groupItemId }}
            </td>
            <td>{{ group.deliveries }}</td>
            <td>{{ group.impressions }}</td>
            <td>{{ group.clicks }} / {{ group.favorites }}</td>
            <td>{{ percent(group.ctr, group.impressions) }}</td>
            <td>{{ percent(group.favoriteRate, group.impressions) }}</td>
            <td>{{ percent(group.favorites / group.clicks, group.clicks) }}</td>
            <td>
              {{ group.fallbacks }} / {{ group.deliveries }} ({{
                percent(group.fallbacks / group.deliveries, group.deliveries)
              }})
            </td>
            <td>{{ group.deliveries ? `${group.avgLatencyMs.toFixed(0)} ms` : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!metrics.groups.length" class="admin-state">当前时间窗暂无样本。</p>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { experimentApi } from '@/api/modules/experiment'
import type { ExperimentGroup } from '@/types/api'
import type { ExperimentMetrics } from '@/api/modules/recommendation'
const props = defineProps<{ experimentId: string; groups: ExperimentGroup[] }>()
const days = ref(7),
  loading = ref(false),
  error = ref(''),
  metrics = ref<ExperimentMetrics | null>(null)
let generation = 0
const percent = (value: number, denominator: number) =>
  denominator ? `${(value * 100).toFixed(2)}%` : '—'
async function load() {
  const run = ++generation
  loading.value = true
  error.value = ''
  metrics.value = null
  try {
    const response = await experimentApi.getMetrics(props.experimentId, days.value)
    if (run !== generation) return
    if (response.code !== 200) throw new Error(response.message)
    metrics.value = response.data
  } catch (reason) {
    if (run === generation) error.value = reason instanceof Error ? reason.message : '指标加载失败'
  } finally {
    if (run === generation) loading.value = false
  }
}
watch(() => props.experimentId, load, { immediate: true })
onScopeDispose(() => {
  generation += 1
})
</script>
