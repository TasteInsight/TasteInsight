<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { registerFeedbackDefaults } from '@/utils/feedback';
import { syncSystemLocale } from '@/i18n';

onLaunch(() => {
  registerFeedbackDefaults();
  console.log('App Launch');
});

onShow(() => {
  syncSystemLocale();
  console.log('App Show');
});

onHide(() => {
  console.log('App Hide');
});
</script>
<style>
@import './styles/design-tokens.css';
@import './styles/page-layout.css';
@import './styles/page-navigation.css';
@import './styles/list-interaction.css';
@import './styles/error-feedback.css';
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
