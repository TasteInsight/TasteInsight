<template>
  <view class="page-content settings-page">
    <view v-for="group in groups" :key="group.title" class="settings-section">
      <text class="settings-hint group-title">{{ group.title }}</text>
      <button
        v-for="item in group.items"
        :key="item.path"
        class="settings-button settings-menu"
        @click="navigateTo(item.path)"
      >
        <text>{{ item.label }}</text
        ><text class="iconfont icon-chevronright" aria-hidden="true"></text>
      </button>
    </view>
  </view>
</template>
<script setup lang="ts">
const groups = [
  {
    title: '个人与饮食',
    items: [
      { label: '个人信息', path: 'personal' },
      { label: '过敏原', path: 'allergens' },
      { label: '饮食偏好', path: 'preferences' },
    ],
  },
  {
    title: '使用偏好',
    items: [
      { label: '显示设置', path: 'display' },
      { label: '通知设置', path: 'notifications' },
    ],
  },
];
function navigateTo(path: string) {
  uni.navigateTo({
    url: '/pages/settings/components/' + path,
    fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }),
  });
}
</script>
<style scoped>
.group-title {
  margin-bottom: 8px;
}
</style>
