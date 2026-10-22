<template>
  <view class="page-content settings-page">
    <radio-group
      class="language-options"
      role="radiogroup"
      :aria-label="t('account.settings.language')"
      @change="changeLanguage"
    >
      <label
        v-for="option in options"
        :key="option.value"
        :for="'language-' + option.value"
        class="settings-choice-label"
      >
        <view
          class="settings-row settings-choice-row list-row-action"
          hover-class="list-row-pressed"
          :hover-stay-time="80"
        >
          <text class="settings-label">{{ t(option.label) }}</text>
          <view class="language-selection">
            <radio
              class="language-radio"
              :id="'language-' + option.value"
              :value="option.value"
              :checked="languagePreference === option.value"
              :aria-label="t(option.label)"
              :aria-checked="languagePreference === option.value"
              role="radio"
              tabindex="0"
              @keydown="option.action.handleKeydown"
              @keyup="option.action.handleKeyup"
              @blur="option.action.clearPress"
            />
            <view class="language-selection-mark" aria-hidden="true">
              <UiIcon
                v-if="languagePreference === option.value"
                name="check"
                :size="20"
                tone="primary"
              />
            </view>
          </view>
        </view>
      </label>
    </radio-group>
  </view>
</template>

<script setup lang="ts">
import { t, languagePreference, setLanguagePreference } from '@/i18n';
import type { LanguagePreference } from '@/i18n';
import { useButtonActivation } from '@/composables/use-button-activation';
import UiIcon from '@/components/UiIcon.vue';

const languageOptions = [
  { value: 'system', label: 'account.settings.followSystem' },
  { value: 'zh-Hans', label: 'account.settings.simplifiedChinese' },
  { value: 'en', label: 'account.settings.english' },
] as const;
const options = languageOptions.map(option => ({
  ...option,
  action: useButtonActivation(() => setLanguagePreference(option.value)),
}));

function changeLanguage(event: { detail: { value: LanguagePreference } }) {
  setLanguagePreference(event.detail.value);
}
</script>

<style scoped>
.language-options {
  display: block;
}
.language-selection,
.language-selection-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}
.language-selection {
  position: relative;
}
.language-selection-mark {
  border-radius: 6px;
  pointer-events: none;
}
.language-radio {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  opacity: 0;
  outline: none;
}
.language-radio:focus-visible + .language-selection-mark {
  outline: 2px solid rgb(102 8 116 / 35%);
  outline-offset: 3px;
}
</style>
