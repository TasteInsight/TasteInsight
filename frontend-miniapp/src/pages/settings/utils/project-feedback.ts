export function copyProjectFeedbackLink() {
  uni.setClipboardData({
    data: 'https://github.com/TasteInsight/TasteInsight/issues',
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }),
  });
}
