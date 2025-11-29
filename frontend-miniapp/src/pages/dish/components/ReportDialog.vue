<template>
  <view class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @tap="close">
    <view class="bg-white rounded-lg w-80 p-4" @tap.stop>
      <view class="text-lg font-bold mb-4 text-center">举报</view>
      
      <view class="mb-4">
        <view class="text-sm text-gray-600 mb-2">举报类型</view>
        <picker :range="reportTypes" range-key="label" @change="handleTypeChange">
          <view class="border border-gray-300 rounded p-2 text-sm flex justify-between items-center">
            <text>{{ selectedTypeLabel || '请选择举报类型' }}</text>
            <text class="iconify" data-icon="mdi:chevron-down"></text>
          </view>
        </picker>
      </view>
      
      <view class="mb-4">
        <view class="text-sm text-gray-600 mb-2">详细理由</view>
        <textarea 
          v-model="reason" 
          class="border border-gray-300 rounded p-2 w-full h-24 text-sm" 
          placeholder="请填写详细理由..."
        />
      </view>
      
      <view class="flex justify-end gap-2">
        <button class="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm m-0" @tap="close">取消</button>
        <button class="bg-red-500 text-white px-4 py-1.5 rounded text-sm m-0" @tap="submit">提交</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const emit = defineEmits(['close', 'submit']);

const reportTypes = [
  { value: 'inappropriate', label: '内容不当' },
  { value: 'spam', label: '垃圾广告' },
  { value: 'false_info', label: '虚假信息' },
  { value: 'other', label: '其他' }
];

const selectedTypeIndex = ref(-1);
const reason = ref('');

const selectedTypeLabel = computed(() => {
  if (selectedTypeIndex.value === -1) return '';
  return reportTypes[selectedTypeIndex.value].label;
});

const handleTypeChange = (e: any) => {
  selectedTypeIndex.value = e.detail.value;
};

const close = () => {
  emit('close');
};

const submit = () => {
  if (selectedTypeIndex.value === -1) {
    uni.showToast({ title: '请选择举报类型', icon: 'none' });
    return;
  }
  if (!reason.value.trim()) {
    uni.showToast({ title: '请填写详细理由', icon: 'none' });
    return;
  }
  
  emit('submit', {
    type: reportTypes[selectedTypeIndex.value].value,
    reason: reason.value
  });
};
</script>
