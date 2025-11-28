<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style>
/* 隐藏所有元素的点击高亮效果 */
view, scroll-view, swiper-item, image, text, button, input, textarea {
  -webkit-tap-highlight-color: transparent;
}
</style>
