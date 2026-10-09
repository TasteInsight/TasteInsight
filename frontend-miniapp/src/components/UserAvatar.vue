<template>
  <view class="user-avatar" role="img" :aria-label="label" :style="{width: size + 'px', height: size + 'px'}">
    <image v-if="src && !failed" :key="src" class="user-avatar-photo" :src="src" mode="aspectFill" aria-hidden="true" @error="failed = true" />
    <image v-else class="user-avatar-fallback" src="/static/tabbar/profile-line.png" mode="aspectFit" aria-hidden="true" />
  </view>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
const props = withDefaults(defineProps<{src?: string; size?: number; label?: string}>(), {src:'', size:40, label:'用户头像'});
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>
<style scoped>
.user-avatar { display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; border-radius:50%; background:#f4f4f5; }
.user-avatar-photo { width:100%; height:100%; }
.user-avatar-fallback { width:60%; height:60%; }
</style>
