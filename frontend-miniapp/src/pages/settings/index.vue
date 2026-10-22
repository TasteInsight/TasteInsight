<template>
  <view class="page-content settings-page">
    <view v-if="!isLoggedIn" class="settings-section">
      <button
        class="settings-button settings-menu list-row-action"
        hover-class="list-row-pressed"
        :hover-stay-time="80"
        @click="loginButton.activate"
        @keydown="loginButton.handleKeydown"
        @keyup="loginButton.handleKeyup"
        @blur="loginButton.clearPress"
        role="button"
        tabindex="0"
      >
        <UiIcon name="user" :size="19" /><text class="settings-menu-label">{{
          t('account.profile.signIn')
        }}</text
        ><UiIcon name="chevron-right" :size="16" />
      </button>
    </view>
    <view v-for="group in visibleGroups" :key="group.title" class="settings-section">
      <text class="settings-group-title">{{ group.title }}</text>
      <button
        v-for="item in group.items"
        :key="item.label"
        class="settings-button settings-menu list-row-action"
        hover-class="list-row-pressed"
        :hover-stay-time="80"
        :aria-label="item.valueLabel ? item.label : undefined"
        @click="item.action.activate"
        @keydown="item.action.handleKeydown"
        @keyup="item.action.handleKeyup"
        @blur="item.action.clearPress"
        role="button"
        tabindex="0"
      >
        <UiIcon :name="item.icon" :size="19" /><text class="settings-menu-label">{{
          item.label
        }}</text
        ><text v-if="item.valueLabel" class="settings-menu-detail">{{ item.valueLabel }}</text
        ><text v-if="item.trailingLabel" class="settings-menu-detail">{{ item.trailingLabel }}</text
        ><UiIcon v-else name="chevron-right" :size="16" />
      </button>
    </view>
    <button
      v-if="isLoggedIn"
      class="settings-button settings-logout"
      hover-class="settings-button--pressed"
      :hover-stay-time="80"
      @click="logoutButton.activate"
      @keydown="logoutButton.handleKeydown"
      @keyup="logoutButton.handleKeyup"
      @blur="logoutButton.clearPress"
      role="button"
      tabindex="0"
    >
      <UiIcon name="logout" :size="19" tone="danger" />{{ t('account.profile.signOut') }}
    </button>
  </view>
</template>
<script setup lang="ts">
import { t, languagePreference } from '@/i18n';
import { computed } from 'vue';
import UiIcon from '@/components/UiIcon.vue';
import type { UiIconName } from '@/types/ui-icon';
import { copyProjectFeedbackLink } from './utils/project-feedback';
import { openLogin } from '@/utils/login-navigation';
import { useProfile } from '@/pages/profile/composables/use-profile';
import { useButtonActivation } from '@/composables/use-button-activation';
const { isLoggedIn, handleLogout } = useProfile();
type SettingsEntry = {
  label: string;
  icon: UiIconName;
  run: () => void;
  signedIn?: boolean;
  valueLabel?: () => string;
  trailingLabel?: string;
};
const languageLabel = computed(() =>
  t(
    {
      system: 'account.settings.followSystem',
      'zh-Hans': 'account.settings.simplifiedChinese',
      en: 'account.settings.english',
    }[languagePreference.value]
  )
);
const groups: { title: string; signedIn: boolean; items: SettingsEntry[] }[] = [
  {
    title: 'account.settings.accountAndIdentity',
    signedIn: true,
    items: [
      {
        label: 'account.settings.personalInformation',
        icon: 'user',
        run: () => navigateTo('/pages/settings/components/personal'),
      },
      {
        label: 'account.profile.accountAndCampusIdentity',
        icon: 'shield',
        run: () => navigateTo('/pages/profile/identity'),
      },
    ],
  },
  {
    title: 'account.settings.foodAndRecommendations',
    signedIn: true,
    items: [
      {
        label: 'account.settings.allergens',
        icon: 'shield',
        run: () => navigateTo('/pages/settings/components/allergens'),
      },
      {
        label: 'account.settings.foodPreferences',
        icon: 'star',
        run: () => navigateTo('/pages/settings/components/preferences'),
      },
    ],
  },
  {
    title: 'account.settings.appPreferences',
    signedIn: false,
    items: [
      {
        label: 'account.settings.language',
        icon: 'language',
        valueLabel: () => languageLabel.value,
        run: () => navigateTo('/pages/settings/language'),
      },
      {
        label: 'account.settings.displaySettings',
        icon: 'eye',
        signedIn: true,
        run: () => navigateTo('/pages/settings/components/display'),
      },
      {
        label: 'account.settings.notificationSettings',
        icon: 'bell',
        signedIn: true,
        run: () => navigateTo('/pages/settings/components/notifications'),
      },
    ],
  },
  {
    title: 'account.settings.about',
    signedIn: false,
    items: [
      {
        label: 'account.settings.aboutTasteinsight',
        icon: 'info',
        run: () => navigateTo('/pages/settings/about'),
      },
    ],
  },
  {
    title: 'account.settings.feedbackAndReports',
    signedIn: false,
    items: [
      {
        label: 'account.settings.projectFeedback',
        icon: 'chat',
        trailingLabel: 'account.settings.copyLink',
        run: copyProjectFeedbackLink,
      },
      {
        label: 'account.settings.myReports',
        icon: 'shield',
        signedIn: true,
        run: () => navigateTo('/pages/profile/records/my-reports/index'),
      },
    ],
  },
];
const menuGroups = groups.map(group => ({
  ...group,
  items: group.items.map(item => ({
    ...item,
    action: useButtonActivation(item.run),
  })),
}));
const visibleGroups = computed(() =>
  menuGroups
    .filter(group => !group.signedIn || isLoggedIn.value)
    .map(group => ({
      ...group,
      title: t(group.title),
      items: group.items
        .filter(item => !item.signedIn || isLoggedIn.value)
        .map(item => ({
          ...item,
          label: t(item.label),
          valueLabel: item.valueLabel?.(),
          trailingLabel: item.trailingLabel ? t(item.trailingLabel) : undefined,
        })),
    }))
);
const loginButton = useButtonActivation(openLogin, () => isLoggedIn.value);
const logoutButton = useButtonActivation(handleLogout, () => !isLoggedIn.value);
function navigateTo(path: string) {
  uni.navigateTo({
    url: path,
    fail: () => uni.showToast({ title: t('account.profile.unableToOpenPage'), icon: 'none' }),
  });
}
</script>
<style scoped>
.settings-logout {
  width: 100%;
  min-height: 48px;
  gap: 8px;
  color: #b42318;
}
</style>
