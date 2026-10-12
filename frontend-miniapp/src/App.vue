<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';
import { registerFeedbackDefaults } from '@/utils/feedback';

onLaunch(() => {
  registerFeedbackDefaults();
  console.log('App Launch');
  checkLoginStatus();
});

onShow(() => {
  console.log('App Show');
});

onHide(() => {
  console.log('App Hide');
});

/**
 * 已有会话的用户直接进入首页，公开页面允许游客浏览。
 */
function checkLoginStatus() {
  const userStore = useUserStore();

  // 获取当前页面路径
  const pages = getCurrentPages();

  // Check if pages array is empty
  if (pages.length === 0) {
    console.warn('No pages found during app initialization. Skipping login status check.');
    return;
  }

  const currentPage = pages[pages.length - 1];
  const currentPath = currentPage ? `/${currentPage.route}` : '';

  // 如果已登录且在登录页，跳转到首页
  if (userStore.isLoggedIn && currentPath === '/pages/login/index') {
    uni.switchTab({
      url: '/pages/index/index',
    });
    return;
  }
}
</script>
<style>
@import './styles/design-tokens.css';
@import './styles/page-layout.css';
@import './styles/page-navigation.css';
@import './styles/list-interaction.css';
@import './pages/settings/settings-page.css';
/* #ifdef H5 */
@import './styles/feedback.css';
@import './styles/picker.css';
/* #endif */

/* 隐藏所有元素的点击高亮效果 */
view,
scroll-view,
swiper-item,
image,
text,
button,
input,
textarea {
  -webkit-tap-highlight-color: transparent;
}
</style>
