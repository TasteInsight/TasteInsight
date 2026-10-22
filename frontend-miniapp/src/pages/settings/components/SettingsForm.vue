<template>
  <view class="space-y-6">
    <view class="flex items-center space-x-4">
      <view class="relative">
        <view class="h-20 w-20 rounded-2xl border-2 border-ts-purple/30 bg-white p-1">
          <image
            class="h-full w-full rounded-xl bg-gray-100"
            :src="avatarPreview"
            mode="aspectFill"
          />
        </view>
      </view>
      <view class="flex-1">
        <text class="text-sm font-semibold tracking-wide text-ts-purple ml-3">{{
          t('account.settings.photoUrl')
        }}</text>
        <input
          class="mt-2 h-11 w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
          type="text"
          :placeholder="t('account.settings.enterImageUrl')"
          :value="props.form.avatar"
          @input="onInput('avatar', $event)"
        />
      </view>
    </view>

    <view>
      <text class="text-sm font-semibold tracking-wide text-ts-purple">{{
        t('account.settings.nickname')
      }}</text>
      <input
        class="mt-2 h-12 w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
        type="text"
        maxlength="20"
        :placeholder="t('account.settings.enterNickname')"
        :value="props.form.nickname"
        @input="onInput('nickname', $event)"
      />
    </view>

    <view>
      <text class="text-sm font-semibold tracking-wide text-ts-purple">{{
        t('account.settings.foodAllergies')
      }}</text>
      <textarea
        class="mt-2 min-h-[80px] w-full rounded-2xl border-2 border-ts-purple/40 bg-white px-4 py-3 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
        :placeholder="t('account.settings.eGPeanutsMangoSeafood')"
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
            {{
              slider.steps
                ? slider.steps[props.form[slider.field] as number]
                : props.form[slider.field]
            }}
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
      <text class="text-sm font-semibold tracking-wide text-ts-purple">{{
        t('account.settings.priceRangeCny')
      }}</text>
      <view class="mt-3 flex items-center space-x-3">
        <input
          class="h-11 flex-1 rounded-xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
          type="number"
          :placeholder="t('account.settings.minimumPrice')"
          :value="props.form.priceRangeMin"
          @input="onInput('priceRangeMin', $event)"
        />
        <text class="text-base font-medium text-purple-400">{{ t('account.settings.to') }}</text>
        <input
          class="h-11 flex-1 rounded-xl border-2 border-ts-purple/40 bg-white px-4 text-base text-ts-purple placeholder-purple-300 shadow-sm focus:border-ts-purple focus:shadow-md transition-all"
          type="number"
          :placeholder="t('account.settings.maximumPrice')"
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
        <switch
          :checked="props.form[toggle.field]"
          color="#660874"
          @change="onSwitchChange(toggle.field, $event)"
        />
      </view>
    </view>

    <view class="mt-4 rounded-2xl bg-purple-50/80 p-5 space-y-4">
      <view
        v-for="toggle in notificationToggles"
        :key="toggle.field"
        class="flex items-center justify-between rounded-xl bg-white/70 px-4 py-3.5"
      >
        <text class="text-base font-medium text-ts-purple">{{ toggle.label }}</text>
        <switch
          :checked="props.form[toggle.field]"
          color="#660874"
          @change="onSwitchChange(toggle.field, $event)"
        />
      </view>
    </view>

    <button
      class="flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-ts-purple to-purple-600 text-base font-bold text-black/90 shadow-lg shadow-ts-purple/40 transition-all duration-200 hover:translate-y-[-2px]"
      :class="{ 'opacity-50': !canSubmit }"
      :disabled="!canSubmit"
      hover-class=""
      @click="emit('save')"
    >
      <text class="tracking-wide text-black">{{
        saving ? t('account.profile.saving') : t('account.settings.saveSettings')
      }}</text>
    </button>

    <button
      class="flex h-14 w-full mb-12 items-center justify-center rounded-full border-2 border-purple-200 bg-white/90 text-base font-bold text-purple-500 shadow transition hover:border-purple-300 hover:bg-purple-50"
      hover-class=""
      @click="emit('logout')"
    >
      {{ t('account.profile.signOut') }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
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

const preferenceTextareas = computed(() => [
  {
    field: 'favoriteIngredientsText' as const,
    label: t('account.settings.favoriteIngredients'),
    placeholder: t('account.settings.separateWithCommasEG'),
  },
  {
    field: 'avoidIngredientsText' as const,
    label: t('account.settings.ingredientsToAvoid'),
    placeholder: t('account.settings.addFoodsYouDislikeSeparately'),
  },
  {
    field: 'canteenPreferencesText' as const,
    label: t('account.settings.frequentCanteens'),
    placeholder: t('account.settings.enterCanteenNamesEG'),
  },
  {
    field: 'tagPreferencesText' as const,
    label: t('account.settings.preferredCuisines'),
    placeholder: t('account.settings.eGSichuanHunanVegetarian'),
  },
]);

const tasteSliders = computed(() => [
  {
    field: 'spicyLevel' as const,
    label: t('account.settings.spicinessPreference'),
    steps: [
      t('account.settings.noSpice'),
      t('account.settings.mild'),
      t('account.settings.medium'),
      t('account.settings.hot'),
      t('account.settings.veryHot'),
      t('account.settings.extraHot'),
    ],
  },
  { field: 'sweetness' as const, label: t('account.settings.sweetness') },
  { field: 'saltiness' as const, label: t('account.settings.saltiness') },
  { field: 'oiliness' as const, label: t('account.settings.oiliness') },
]);

const portionSizeOptions = computed(() => [
  { label: t('account.settings.small'), value: 'small' as const },
  { label: t('account.settings.medium2'), value: 'medium' as const },
  { label: t('account.settings.large'), value: 'large' as const },
]);

const displayToggles = computed(() => [
  { field: 'showCalories' as const, label: t('account.settings.showCalories') },
  { field: 'showNutrition' as const, label: t('account.settings.showNutrition') },
]);

const notificationToggles = computed(() => [
  { field: 'newDishAlert' as const, label: t('account.settings.newDishAlerts') },
  { field: 'priceChangeAlert' as const, label: t('account.settings.priceChangeAlerts') },
  { field: 'reviewReplyAlert' as const, label: t('account.settings.reviewReplyAlerts') },
  { field: 'weeklyRecommendation' as const, label: t('account.settings.weeklyRecommendations') },
]);

const sortByOptions = computed(() => [
  { label: t('account.settings.recommendedOrder'), value: '' as const },
  { label: t('account.settings.highestRated'), value: 'rating' as const },
  { label: t('account.settings.priceLowToHigh'), value: 'price_low' as const },
  { label: t('account.settings.priceHighToLow'), value: 'price_high' as const },
  { label: t('account.settings.mostPopular'), value: 'popularity' as const },
  { label: t('account.settings.newestFirst'), value: 'newest' as const },
]);

const sortByIndex = computed(() => {
  const found = sortByOptions.value.findIndex(option => option.value === props.form.sortBy);
  return found >= 0 ? found : 0;
});

function onInput(field: SettingsField, event: any) {
  const value =
    typeof event === 'string' ? event : (event?.detail?.value ?? event?.target?.value ?? '');
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
  const option = sortByOptions.value[index] ?? sortByOptions.value[0];
  emit('update-field', { field, value: option.value });
}
</script>
