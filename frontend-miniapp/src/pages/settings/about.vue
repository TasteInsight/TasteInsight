<template>
  <view class="page-content settings-page about-page">
    <view class="about-identity">
      <button
        class="about-logo-button"
        aria-label="食鉴应用标志"
        role="button"
        tabindex="0"
        @tap="secretButton.activate"
        @keydown="secretButton.handleKeydown"
        @keyup="secretButton.handleKeyup"
        @blur="secretButton.clearPress"
      >
        <image src="/static/logo.png" class="about-logo" mode="aspectFit" aria-hidden="true" />
      </button>
      <text class="about-name">食鉴 TasteInsight</text>
      <text class="about-version">Version 1.0.0</text>
      <text class="about-description about-intro"
        >食鉴是一款面向校园的食堂菜品点评与推荐应用。浏览菜品与评价，记录用餐体验，管理自己的饮食偏好。</text
      >
    </view>

    <view class="about-section">
      <text class="about-section-title">协议与支持</text>
      <button
        class="settings-button settings-menu about-menu list-row-action"
        hover-class="list-row-pressed"
        role="button"
        tabindex="0"
        @click="agreementButton.activate"
        @keydown="agreementButton.handleKeydown"
        @keyup="agreementButton.handleKeyup"
        @blur="agreementButton.clearPress"
      >
        <UiIcon name="bookmark" :size="19" />
        <text class="about-menu-label">用户协议</text><UiIcon name="chevron-right" :size="16" />
      </button>
      <button
        class="settings-button settings-menu about-menu list-row-action"
        hover-class="list-row-pressed"
        role="button"
        tabindex="0"
        @click="privacyButton.activate"
        @keydown="privacyButton.handleKeydown"
        @keyup="privacyButton.handleKeyup"
        @blur="privacyButton.clearPress"
      >
        <UiIcon name="shield" :size="19" />
        <text class="about-menu-label">隐私政策</text><UiIcon name="chevron-right" :size="16" />
      </button>
      <button
        class="settings-button settings-menu about-menu about-contact list-row-action"
        hover-class="list-row-pressed"
        role="button"
        tabindex="0"
        @click="feedbackButton.activate"
        @keydown="feedbackButton.handleKeydown"
        @keyup="feedbackButton.handleKeyup"
        @blur="feedbackButton.clearPress"
      >
        <UiIcon name="chat" :size="19" />
        <view class="about-menu-label"
          ><text class="about-contact-label">项目反馈</text
          ><text class="settings-hint">GitHub Issues</text></view
        ><text class="about-action-label">复制链接</text>
      </button>
    </view>

    <view class="about-section">
      <button
        class="settings-button settings-menu about-menu list-row-action"
        hover-class="list-row-pressed"
        :aria-expanded="showFeatures"
        role="button"
        tabindex="0"
        @click="featuresButton.activate"
        @keydown="featuresButton.handleKeydown"
        @keyup="featuresButton.handleKeyup"
        @blur="featuresButton.clearPress"
      >
        <text class="about-menu-label">主要功能</text>
        <UiIcon :name="showFeatures ? 'chevron-down' : 'chevron-right'" :size="16" />
      </button>
      <view v-if="showFeatures" class="about-features">
        <text v-for="feature in features" :key="feature" class="about-feature">{{ feature }}</text>
      </view>
      <button
        class="settings-button settings-menu about-menu list-row-action"
        hover-class="list-row-pressed"
        :aria-expanded="showTechnicalDetails"
        role="button"
        tabindex="0"
        @click="technicalButton.activate"
        @keydown="technicalButton.handleKeydown"
        @keyup="technicalButton.handleKeyup"
        @blur="technicalButton.clearPress"
      >
        <text class="about-menu-label">技术与开源</text>
        <UiIcon :name="showTechnicalDetails ? 'chevron-down' : 'chevron-right'" :size="16" />
      </button>
      <view v-if="showTechnicalDetails" class="about-technical">
        <view v-for="item in technologies" :key="item.name" class="settings-row"
          ><text class="settings-label">{{ item.name }}</text
          ><text class="settings-hint">{{ item.detail }}</text></view
        >
        <text class="settings-hint about-thanks"
          >感谢开源项目贡献者为应用开发提供的工具与支持。</text
        >
      </view>
    </view>

    <view class="about-disclaimer">
      <text class="about-section-title">免责声明</text>
      <text class="about-description"
        >菜品评价信息仅供参考，实际菜品质量可能因季节、厨师等因素有所变化，请以实地情况为准。如有食物过敏或其他健康问题，请向窗口核对食材并咨询专业医生。</text
      >
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import UiIcon from '@/components/UiIcon.vue';
import { onHide, onShow, onUnload } from '@dcloudio/uni-app';
import { useButtonActivation } from '@/composables/use-button-activation';
import { copyProjectFeedbackLink } from '@/utils/project-feedback';

const showFeatures = ref(false);
const showTechnicalDetails = ref(false);
const featuresButton = useButtonActivation(() => {
  showFeatures.value = !showFeatures.value;
});
const feedbackButton = useButtonActivation(copyProjectFeedbackLink);
const agreementButton = useButtonActivation(() => {
  uni.navigateTo({ url: '/pages/settings/privacy?type=user' });
});
const privacyButton = useButtonActivation(openPrivacy);
const technicalButton = useButtonActivation(() => {
  showTechnicalDetails.value = !showTechnicalDetails.value;
});
const features = [
  '菜品星级、文字与图片评价',
  '基于饮食偏好的 AI 推荐与对话',
  '浏览食堂、窗口、菜品与价格',
  '按日、周、月查看饮食规划',
  '收藏菜品、查看历史与管理个人偏好',
];
const technologies = [
  { name: 'Vue 3', detail: 'MIT License' },
  { name: 'uni-app', detail: 'Apache-2.0' },
  { name: 'Tailwind CSS', detail: 'MIT License' },
  { name: 'Pinia', detail: 'MIT License' },
];
let secretTapCount = 0;
let lastTapAt = 0;
let isOpeningSecret = false;
const secretButton = useButtonActivation(handleSecretTap, () => isOpeningSecret);

function resetSecretSequence() {
  secretTapCount = 0;
  lastTapAt = 0;
  secretButton.clearPress();
}

function handleSecretTap() {
  const now = Date.now();
  if (now - lastTapAt > 800) secretTapCount = 0;
  lastTapAt = now;
  if (++secretTapCount < 5) return;
  resetSecretSequence();
  isOpeningSecret = true;
  uni.navigateTo({
    url: '/pages/easter-egg/index',
    success: () => {
      uni.showToast({ title: '彩蛋入口已解锁', icon: 'none', duration: 1200 });
      if (typeof uni.vibrateShort === 'function') uni.vibrateShort({ fail: () => undefined });
    },
    fail: () => {
      isOpeningSecret = false;
      uni.showToast({ title: '页面跳转失败，请重试', icon: 'none' });
    },
  });
}

onShow(() => {
  isOpeningSecret = false;
  resetSecretSequence();
});
onHide(resetSecretSequence);
onUnload(resetSecretSequence);

function openPrivacy() {
  uni.navigateTo({ url: '/pages/settings/privacy' });
}
</script>
<style scoped>
.about-page {
  padding-top: 24px;
  padding-bottom: 32px;
}
.about-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0 28px;
  text-align: center;
}
.about-logo-button {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
}
.about-logo-button::after {
  border: 0;
}
.about-logo-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}
.about-logo {
  width: 64px;
  height: 64px;
}
.about-name {
  display: block;
  color: #111827;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.5;
}
.about-version {
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}
.about-description {
  display: block;
  color: #475467;
  font-size: 14px;
  line-height: 1.75;
}
.about-intro {
  max-width: 480px;
  margin-top: 16px;
}
.about-section {
  margin-bottom: 24px;
}
.about-section-title {
  display: block;
  margin-bottom: 4px;
  color: #475467;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}
.about-menu {
  min-height: 56px;
  gap: 12px;
  font-size: 15px;
}
.about-menu-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.about-contact-label {
  display: block;
  font-size: 15px;
  line-height: 1.5;
}
.about-action-label {
  flex-shrink: 0;
  color: #660874;
  font-size: 13px;
}
.about-features,
.about-technical {
  padding: 8px 0 12px;
}
.about-feature {
  display: block;
  padding: 4px 0;
  color: #475467;
  font-size: 14px;
  line-height: 1.65;
}
.about-technical .settings-row {
  flex-wrap: wrap;
  min-height: 44px;
  padding: 8px 0;
}
.about-technical .settings-label {
  font-size: 14px;
}
.about-thanks {
  margin-top: 12px;
}
.about-disclaimer {
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
.about-disclaimer .about-description {
  color: #667085;
  font-size: 13px;
}
</style>
