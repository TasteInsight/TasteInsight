export function confirmDiscardChanges(dirty: boolean, content: string): Promise<boolean> {
  if (!dirty) return Promise.resolve(true);
  return new Promise(resolve => {
    uni.showModal({
      title: '放弃修改？',
      content,
      confirmText: '放弃修改',
      cancelText: '继续编辑',
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    });
  });
}
