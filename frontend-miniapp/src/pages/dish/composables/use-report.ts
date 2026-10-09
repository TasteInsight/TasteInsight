import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { reportReview } from '@/api/modules/review';
import { reportComment } from '@/api/modules/comment';
import type { ReportRequest } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';

export function useReport() {
  const userStore = useUserStore();
  let disposed = false;
  let dialogVersion = 0;
  const submitting = ref(false);
  const isReportVisible = ref(false);
  const reportTargetId = ref('');
  const reportTargetType = ref<'review' | 'comment'>('review');

  const openReportModal = (type: 'review' | 'comment', id: string) => {
    dialogVersion++;
    submitting.value = false;
    reportTargetId.value = id;
    reportTargetType.value = type;
    isReportVisible.value = true;
  };

  const closeReportModal = () => {
    dialogVersion++;
    submitting.value = false;
    isReportVisible.value = false;
    reportTargetId.value = '';
  };

  const submitReport = async (data: ReportRequest): Promise<boolean> => {
    if (submitting.value || !isReportVisible.value || disposed) return false;
    const version = dialogVersion;
    const session = userStore.sessionVersion;
    const targetId = reportTargetId.value;
    const targetType = reportTargetType.value;
    const isCurrent = () =>
      !disposed && version === dialogVersion && session === userStore.sessionVersion;
    submitting.value = true;
    try {
      const response =
        targetType === 'review'
          ? await reportReview(targetId, { ...data })
          : await reportComment(targetId, { ...data });
      if (!isCurrent()) return false;
      if (response.code !== 200 && response.code !== 201)
        throw new Error(response.message || '举报失败，请重试');
      uni.showToast({ title: '举报成功', icon: 'success' });
      closeReportModal();
      return true;
    } catch (error: any) {
      if (!isCurrent()) return false;
      uni.showToast({ title: error.message || '举报失败', icon: 'none' });
      return false;
    } finally {
      if (isCurrent()) submitting.value = false;
    }
  };

  watch(() => userStore.sessionVersion, closeReportModal, { flush: 'sync' });
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

  return {
    isReportVisible,
    submitting,
    openReportModal,
    closeReportModal,
    submitReport,
  };
}
