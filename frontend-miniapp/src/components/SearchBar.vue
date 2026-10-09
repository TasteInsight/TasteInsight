<template>
  <view
    v-if="editable"
    class="discovery-search discovery-search--editable"
    :class="{ 'discovery-search--focused': fieldFocused }"
  >
    <uni-icons type="search" size="20" color="#667085" aria-hidden="true" />
    <!-- #ifdef H5 -->
    <component
      :is="'input'"
      v-if="isH5"
      ref="inputRef"
      :value="modelValue"
      class="discovery-search__input"
      type="search"
      :placeholder="placeholder"
      :aria-label="placeholder"
      enterkeyhint="search"
      @input="handleNativeInput"
      @keydown="handleInputKeydown"
      @keyup="handleInputKeyup"
      @compositionstart="
        composing = true;
        inputPressed = false;
      "
      @compositionend="handleCompositionEnd"
      @focus="fieldFocused = true"
      @blur="handleInputBlur"
    />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <input
      v-if="!isH5"
      :value="modelValue"
      :focus="focus"
      class="discovery-search__input discovery-search__uni-input"
      type="text"
      :placeholder="placeholder"
      placeholder-style="color: #667085"
      :aria-label="placeholder"
      confirm-type="search"
      @input="handleUniInput"
      @confirm="handleUniConfirm"
      @focus="fieldFocused = true"
      @blur="handleInputBlur"
    />
    <!-- #endif -->
    <button
      v-if="modelValue"
      class="discovery-search__button discovery-search__clear"
      :role="isH5 ? 'button' : undefined"
      :tabindex="isH5 ? 0 : undefined"
      aria-label="清空搜索"
      @click="clearInput"
      @keydown="handleActionKeydown"
      @keyup="handleActionKeyup($event, clearInput)"
      @blur="actionPressed = false"
    >
      <uni-icons type="clear" size="18" color="#667085" aria-hidden="true" />
    </button>
    <button
      class="discovery-search__button discovery-search__submit"
      :role="isH5 ? 'button' : undefined"
      :tabindex="isH5 ? 0 : undefined"
      @click="submitSearch"
      @keydown="handleActionKeydown"
      @keyup="handleActionKeyup($event, submitSearch)"
      @blur="actionPressed = false"
    >
      <text class="discovery-search__action">搜索</text>
    </button>
  </view>
  <button
    v-else
    class="discovery-search discovery-search--entry"
    hover-class="discovery-search--pressed"
    :role="isH5 ? 'button' : undefined"
    :tabindex="isH5 ? 0 : undefined"
    :aria-label="placeholder"
    @click="openSearch"
    @keydown="handleActionKeydown"
    @keyup="handleActionKeyup($event, openSearch)"
    @blur="actionPressed = false"
  >
    <uni-icons type="search" size="20" color="#667085" aria-hidden="true" />
    <text class="discovery-search__label">{{ placeholder }}</text>
    <text class="discovery-search__action" aria-hidden="true">搜索</text>
  </button>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    editable?: boolean;
    focus?: boolean;
    searchUrl?: string;
  }>(),
  {
    modelValue: '',
    placeholder: '搜索菜品或食堂',
    editable: false,
    focus: false,
    searchUrl: '/pages/search/index',
  }
);
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'submit'): void;
  (event: 'clear'): void;
  (event: 'blur'): void;
}>();

let isH5 = false;
// #ifdef H5
isH5 = true;
// #endif
const inputRef = ref<HTMLInputElement | null>(null);
const fieldFocused = ref(false);
const composing = ref(false);
const inputPressed = ref(false);
const actionPressed = ref(false);

const syncNativeFocus = () => {
  const field = inputRef.value;
  if (!field) return;
  if (props.focus) field.focus();
  else field.blur();
};
watch(() => props.focus, syncNativeFocus, { flush: 'post' });
onMounted(syncNativeFocus);

const handleNativeInput = (event: Event) =>
  emit('update:modelValue', (event.target as HTMLInputElement).value);
const handleUniInput = (event: Event) =>
  emit('update:modelValue', (event as CustomEvent<{ value: string }>).detail.value);
const handleUniConfirm = (event: Event) => {
  handleUniInput(event);
  emit('submit');
};
const submitSearch = () => {
  if (inputRef.value) emit('update:modelValue', inputRef.value.value);
  emit('submit');
};
const clearInput = () => {
  inputPressed.value = false;
  if (inputRef.value) inputRef.value.value = '';
  emit('update:modelValue', '');
  emit('clear');
};
const handleInputBlur = () => {
  inputPressed.value = false;
  fieldFocused.value = false;
  emit('blur');
};
const handleCompositionEnd = (event: CompositionEvent) => {
  composing.value = false;
  handleNativeInput(event);
};
const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return;
  if (event.isComposing || composing.value) {
    inputPressed.value = false;
    return;
  }
  event.preventDefault();
  inputPressed.value = true;
};
const handleInputKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.isComposing || composing.value || !inputPressed.value) return;
  event.preventDefault();
  inputPressed.value = false;
  submitSearch();
};
const handleActionKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  actionPressed.value = true;
};
const handleActionKeyup = (event: KeyboardEvent, activate: () => void) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (!actionPressed.value) return;
  actionPressed.value = false;
  activate();
};

const openSearch = () =>
  uni.navigateTo({
    url: props.searchUrl,
    // #ifdef APP-PLUS
    animationType: 'fade-in',
    animationDuration: 180,
    // #endif
  });
</script>

<style scoped>
.discovery-search {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 50px;
  margin: 0;
  padding: 0 4px 0 14px;
  border: 1px solid #dce1e7;
  border-radius: 14px;
  background: #fff;
  color: #667085;
  font-family: inherit;
  line-height: 1.4;
  text-align: left;
  box-sizing: border-box;
}
.discovery-search::after,
.discovery-search__button::after {
  border: 0;
}
.discovery-search--entry:active,
.discovery-search--pressed {
  background: #f5f6f7;
}
.discovery-search--entry:focus-visible,
.discovery-search--focused {
  border-color: #660874;
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.discovery-search__button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.discovery-search__label {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.discovery-search__input {
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #1f2937;
  font-family: inherit;
  font-size: 16px;
  caret-color: #660874;
}
.discovery-search__input::placeholder {
  color: #667085;
  opacity: 1;
}
.discovery-search__input::-webkit-search-cancel-button,
.discovery-search__input::-webkit-search-decoration {
  -webkit-appearance: none;
}
.discovery-search__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-height: 44px;
  margin: 0;
  padding: 0 3px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  line-height: 1.4;
}
.discovery-search__button:active {
  opacity: 0.72;
}
.discovery-search__clear {
  width: 44px;
  padding: 0;
}
.discovery-search__submit {
  margin-left: -6px;
}
.discovery-search__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  background: #660874;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}
</style>
