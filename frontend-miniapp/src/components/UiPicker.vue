<template>
  <picker
    :mode="mode"
    :range="range"
    :range-key="rangeKey"
    :value="value"
    :disabled="disabled"
    :fields="fields"
    :start="start"
    :end="end"
    :selector-type="selectorType"
    @change="emit('change', $event)"
    @cancel="emit('cancel', $event)"
    @columnchange="emit('columnchange', $event)"
  >
    <slot />
  </picker>
</template>

<script setup lang="ts">
// 日期默认保留完整年月日。Uni 3.0.0-5020620260917001 的 H5 原生日期分支存在
// 无 key 节点复用缺陷，显式 day 精度使 date 使用其稳定的自定义选择分支。
withDefaults(
  defineProps<{
    mode?: 'selector' | 'multiSelector' | 'date' | 'time';
    range?: unknown[];
    rangeKey?: string;
    value?: number | string | number[];
    disabled?: boolean | string;
    fields?: 'year' | 'month' | 'day';
    start?: string;
    end?: string;
    selectorType?: '' | 'picker' | 'select';
  }>(),
  {
    mode: 'selector',
    range: () => [],
    rangeKey: '',
    value: 0,
    disabled: false,
    fields: 'day',
    selectorType: '',
  }
);

const emit = defineEmits(['change', 'cancel', 'columnchange']);
</script>
