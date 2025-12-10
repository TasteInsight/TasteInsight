<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { useUserStore } from "@/store/modules/use-user-store";

onLaunch(() => {
  console.log("App Launch");
  checkLoginStatus();
});

onShow(() => {
  console.log("App Show");
});

onHide(() => {
  console.log("App Hide");
});

/**
 * 检查登录状态，未登录则重定向到登录页
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
      url: '/pages/index/index'
    });
    return;
  }
  
  // 如果未登录且不在登录页，跳转到登录页
  if (!userStore.isLoggedIn && currentPath !== '/pages/login/index') {
    uni.reLaunch({
      url: '/pages/login/index'
    });
  }
}
</script>
<style>
/* 隐藏所有元素的点击高亮效果 */
view, scroll-view, swiper-item, image, text, button, input, textarea {
  -webkit-tap-highlight-color: transparent;
}
</style>
