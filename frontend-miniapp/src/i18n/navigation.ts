import { watch } from 'vue';
import { locale, t } from './index';
import config from '@/config';

const titles: Record<string, string> = {
  'pages/index/index': 'nav.home',
  'pages/login/index': 'nav.login',
  'pages/search/index': 'nav.search',
  'pages/canteen/index': 'nav.canteen',
  'pages/window/index': 'nav.window',
  'pages/dish/index': 'nav.dish',
  'pages/news/index': 'nav.news',
  'pages/news/components/detail': 'nav.newsDetail',
  'pages/planning/index': 'nav.planning',
  'pages/ai-chat/index': 'nav.ai',
  'pages/profile/index': 'nav.profile',
  'pages/profile/identity': 'nav.identity',
  'pages/login/campus-auth': 'nav.campusLogin',
  'pages/profile/campus-auth': 'nav.campusOAuth',
  'pages/community/index': 'nav.community',
  'pages/community/detail': 'nav.post',
  'pages/community/editor': 'nav.compose',
  'pages/profile/public': 'nav.publicProfile',
  'pages/planning/dining': 'nav.dining',
  'pages/notifications/index': 'nav.notifications',
  'pages/notifications/weekly': 'nav.weekly',
  'pages/easter-egg/index': 'nav.easterEgg',
  'pages/settings/index': 'nav.settings',
  'pages/settings/language': 'nav.language',
  'pages/settings/components/personal': 'nav.personal',
  'pages/settings/components/avatar-crop': 'nav.crop',
  'pages/settings/components/allergens': 'nav.allergens',
  'pages/settings/components/preferences': 'nav.preferences',
  'pages/settings/components/display': 'nav.display',
  'pages/settings/components/notifications': 'nav.notificationSettings',
  'pages/settings/about': 'nav.about',
  'pages/profile/records/my-uploads/index': 'nav.uploads',
  'pages/profile/records/my-reviews/index': 'nav.reviews',
  'pages/profile/records/my-reports/index': 'nav.reports',
  'pages/profile/records/history/index': 'nav.history',
  'pages/profile/records/my-favorites/index': 'nav.favorites',
};

export function syncNativeNavigation(): void {
  const tabs = [
    { route: 'pages/index/index', key: 'nav.tabHome' },
    config.platform === 'mp-weixin'
      ? { route: 'pages/news/index', key: 'nav.tabNews' }
      : { route: 'pages/community/index', key: 'nav.tabCampus' },
    { route: 'pages/planning/index', key: 'nav.tabPlans' },
    { route: 'pages/ai-chat/index', key: 'nav.tabAI' },
    { route: 'pages/profile/index', key: 'nav.tabProfile' },
  ];
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const route = pages[pages.length - 1]?.route;
  if (route && titles[route]) uni.setNavigationBarTitle({ title: t(titles[route]) });
  // 微信只允许在 tabBar 页面更新标签；返回时由页面 onShow 同步当前语言。
  if (tabs.some(tab => tab.route === route))
    tabs.forEach(({ key }, index) => uni.setTabBarItem({ index, text: t(key) }));
}

watch(locale, syncNativeNavigation, { flush: 'post' });
