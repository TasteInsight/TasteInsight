<template>
  <view class="space-y-6">
    <view class="flex items-center space-x-4">
        <view class="relative">
          <view class="h-20 w-20 rounded-2xl border-2 border-ts-purple/30 bg-white p-1">
            <image class="h-full w-full rounded-xl bg-gray-100" :src="avatarPreview" mode="aspectFill" />
          </view>
        </view>
        <view class="flex-1">
          <text class="text-sm font-semibold tracking-wide text-ts-purple ml-3">头像地址</text>
          <input
            class="mt-2 h-11 w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
            type="text"
            placeholder="输入图片链接"
            :value="props.form.avatar"
            @input="onInput('avatar', $event)"
          />
        </view>
      </view>

      <view>
        <text class="text-sm font-semibold tracking-wide text-ts-purple">昵称</text>
        <input
          class="mt-2 h-12 w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
          type="text"
          maxlength="20"
          placeholder="请输入昵称"
          :value="props.form.nickname"
          @input="onInput('nickname', $event)"
        />
      </view>

      <view>
        <text class="text-sm font-semibold tracking-wide text-ts-purple">过敏食材</text>
        <textarea
          class="mt-2 min-h-[80px] w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 py-3 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
          placeholder="例如：花生, 芒果, 海鲜"
          :value="props.form.allergensText"
          @input="onInput('allergensText', $event)"
        />
      </view>

      <view v-for="item in preferenceTextareas" :key="item.field">
        <text class="text-sm font-semibold tracking-wide text-ts-purple">{{ item.label }}</text>
        <textarea
          class="mt-2 min-h-[80px] w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 py-3 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
          :placeholder="item.placeholder"
          :value="props.form[item.field]"
          @input="onInput(item.field, $event)"
        />
      </view>

        <view class="space-y-5 rounded-2xl bg-purple-50/70 p-5">
          <view v-for="slider in tasteSliders" :key="slider.field" class="space-y-2">
            <view class="flex items-center justify-between">
              <text class="text-sm font-semibold tracking-wide text-ts-purple">{{ slider.label }}</text>
              <text class="text-sm font-medium text-ts-purple">
                {{ slider.steps ? slider.steps[props.form[slider.field] as number] : props.form[slider.field] }}
              </text>
            </view>
            <slider
              :min="0"
              :max="(slider.steps?.length ?? 6) - 1"
              :step="1"
              show-value="false"
              :value="props.form[slider.field] as number"
              active-color="#660874"
              background-color="#E9D5FF"
              block-size="16"
              @change="onSliderChange(slider.field, $event)"
            />
          </view>
        </view>


        <view class="rounded-2xl bg-purple-50/80 p-5">
          <text class="text-sm font-semibold tracking-wide text-ts-purple">价格区间 (元)</text>
          <view class="mt-3 flex items-center space-x-3">
            <input
              class="h-11 flex-1 rounded-xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
              type="number"
              placeholder="最低价格"
              :value="props.form.priceRangeMin"
              @input="onInput('priceRangeMin', $event)"
            />
            <text class="text-base font-medium text-purple-400">到</text>
            <input
              class="h-11 flex-1 rounded-xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
              type="number"
              placeholder="最高价格"
              :value="props.form.priceRangeMax"
              @input="onInput('priceRangeMax', $event)"
            />
          </view>
        </view>

        <view class="mt-4 rounded-2xl bg-purple-50/80 p-5 space-y-4">
          <view
            v-for="toggle in displayToggles"
            :key="toggle.field"
            class="flex items-center justify-between rounded-xl bg-white/70 px-4 py-3.5"
          >
            <text class="text-base font-medium text-ts-purple">{{ toggle.label }}</text>
            <switch :checked="props.form[toggle.field]" color="#660874" @change="onSwitchChange(toggle.field, $event)" />
          </view>
        </view>

    <view class="mt-4 rounded-2xl bg-purple-50/80 p-5 space-y-4">
      <view
        v-for="toggle in notificationToggles"
        :key="toggle.field"
        class="flex items-center justify-between rounded-xl bg-white/70 px-4 py-3.5"
      >
        <text class="text-base font-medium text-ts-purple">{{ toggle.label }}</text>
        <switch :checked="props.form[toggle.field]" color="#660874" @change="onSwitchChange(toggle.field, $event)" />
      </view>
    </view>

    <button
      class="flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-ts-purple to-purple-600 text-base font-bold text-black/90 shadow-lg shadow-ts-purple/40 transition-all duration-200 hover:translate-y-[-2px]"
      :class="{ 'opacity-50': !canSubmit }"
      :disabled="!canSubmit"
      hover-class=""
      @click="emit('save')"
    >
      <text class="tracking-wide text-black">{{ saving ? '保存中…' : '保存设置' }}</text>
    </button>

    <button
      class="flex h-14 w-full mb-12 items-center justify-center rounded-full border-2 border-purple-200 bg-white/90 text-base font-bold text-purple-500 shadow transition hover:border-purple-300 hover:bg-purple-50"
      hover-class=""
      @click="emit('logout')"
    >
      退出登录
    </button>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsField, SettingsFormState } from '../composables/use-settings';

interface Props {
  form: SettingsFormState;
  saving: boolean;
  canSubmit: boolean;
  avatarPreview: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update-field', payload: { field: SettingsField; value: unknown }): void;
  (e: 'save'): void;
  (e: 'logout'): void;
}>();

const preferenceTextareas = [
  { field: 'favoriteIngredientsText' as const, label: '喜欢的食材', placeholder: '用逗号分隔，例如：牛肉, 鸡肉' },
  { field: 'avoidIngredientsText' as const, label: '避开的食材', placeholder: '与过敏不同，可输入不喜欢吃的' },
  { field: 'canteenPreferencesText' as const, label: '常去食堂', placeholder: '输入食堂名称，如：一食堂, 二食堂' },
  { field: 'tagPreferencesText' as const, label: '偏好菜系', placeholder: '例如：川菜, 湘菜, 素食' },
];

const tasteSliders = [
  { field: 'spicyLevel' as const, label: '辣度偏好', steps: ['不辣', '微辣', '中辣', '偏辣', '很辣', '特辣'] },
  { field: 'sweetness' as const, label: '甜度' },
  { field: 'saltiness' as const, label: '咸度' },
  { field: 'oiliness' as const, label: '油腻度' },
];

const portionSizeOptions = [
  { label: '小份', value: 'small' as const },
  { label: '中份', value: 'medium' as const },
  { label: '大份', value: 'large' as const },
];

const displayToggles = [
  { field: 'showCalories' as const, label: '显示卡路里' },
  { field: 'showNutrition' as const, label: '显示营养信息' },
];

const notificationToggles = [
  { field: 'newDishAlert' as const, label: '新菜品提醒' },
  { field: 'priceChangeAlert' as const, label: '价格变动提醒' },
  { field: 'reviewReplyAlert' as const, label: '点评回复提醒' },
  { field: 'weeklyRecommendation' as const, label: '每周推荐' },
];

const sortByOptions = [
  { label: '综合排序', value: '' as const },
  { label: '评分优先', value: 'rating' as const },
  { label: '价格从低到高', value: 'price_low' as const },
  { label: '价格从高到低', value: 'price_high' as const },
  { label: '人气优先', value: 'popularity' as const },
  { label: '最新发布', value: 'newest' as const },
];

const sortByIndex = computed(() => {
  const found = sortByOptions.findIndex((option) => option.value === props.form.sortBy);
  return found >= 0 ? found : 0;
});

function onInput(field: SettingsField, event: any) {
  const value = typeof event === 'string'
    ? event
    : event?.detail?.value ?? event?.target?.value ?? '';
  emit('update-field', { field, value });
}

function onSliderChange(field: SettingsField, event: any) {
  const value = Number(event?.detail?.value ?? 0);
  emit('update-field', { field, value });
}

function onSwitchChange(field: SettingsField, event: any) {
  const value = Boolean(event?.detail?.value);
  emit('update-field', { field, value });
}

function onPickerChange(field: SettingsField, event: any) {
  const index = Number(event?.detail?.value ?? 0);
  const option = sortByOptions[index] ?? sortByOptions[0];
  emit('update-field', { field, value: option.value });
}
</script>
