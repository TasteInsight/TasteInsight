<template>
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white p-4">
    <!-- 通知设置 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">通知设置</text>
      
      <!-- 新菜品提醒 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">新菜品提醒</text>
          <text class="text-xs text-gray-400 mt-1">当食堂上架新菜品时通知您</text>
        </view>
        <switch 
          :checked="form.newDishAlert" 
          color="#82318E"
          @change="(e: any) => updateField('newDishAlert', e)"
        />
      </view>

      <!-- 价格变动提醒 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">价格变动提醒</text>
          <text class="text-xs text-gray-400 mt-1">当收藏菜品价格变动时通知您</text>
        </view>
        <switch 
          :checked="form.priceChangeAlert" 
          color="#82318E"
          @change="(e: any) => updateField('priceChangeAlert', e)"
        />
      </view>

      <!-- 评价回复提醒 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">评价回复提醒</text>
          <text class="text-xs text-gray-400 mt-1">当您的评价收到回复时通知您</text>
        </view>
        <switch 
          :checked="form.reviewReplyAlert" 
          color="#82318E"
          @change="(e: any) => updateField('reviewReplyAlert', e)"
        />
      </view>

      <!-- 每周推荐 -->
      <view class="flex justify-between items-center py-3">
        <view>
          <text class="text-base text-gray-700 block">每周推荐</text>
          <text class="text-xs text-gray-400 mt-1">每周为您推荐本周热门菜品</text>
        </view>
        <switch 
          :checked="form.weeklyRecommendation" 
          color="#82318E"
          @change="(e: any) => updateField('weeklyRecommendation', e)"
        />
      </view>
    </view>

    <!-- 说明文字 -->
    <view class="bg-blue-50 rounded-xl p-4 mb-4">
      <text class="text-xs text-blue-800">💡 您可以随时在此处管理通知偏好设置</text>
    </view>

    <!-- 保存按钮 -->
    <button 
      class="w-full py-4 bg-gradient-to-r from-ts-purple to-purple-600 text-white rounded-full text-base font-bold shadow-lg mt-6"
      :class="{ 'opacity-50': saving }"
      :disabled="saving"
      @click="handleSave"
    >
      <text>{{ saving ? '保存中...' : '保存设置' }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { useNotifications } from '../composables/use-notifications';

const { form, saving, updateField, handleSave } = useNotifications();
</script>
