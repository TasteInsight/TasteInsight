import { ref } from 'vue';
import { reportReview } from '@/api/modules/review';
import { reportComment } from '@/api/modules/comment';
import type { ReportRequest } from '@/types/api';

export function useReport() {
  const isReportVisible = ref(false);
  const reportTargetId = ref('');
  const reportTargetType = ref<'review' | 'comment'>('review');
  
  const openReportModal = (type: 'review' | 'comment', id: string) => {
    reportTargetId.value = id;
    reportTargetType.value = type;
    isReportVisible.value = true;
  };

  const closeReportModal = () => {
    isReportVisible.value = false;
    reportTargetId.value = '';
  };

  const submitReport = async (data: ReportRequest) => {
    try {
      if (reportTargetType.value === 'review') {
        await reportReview(reportTargetId.value, data);
      } else {
        await reportComment(reportTargetId.value, data);
      }
      uni.showToast({ title: '举报成功', icon: 'success' });
      closeReportModal();
    } catch (error: any) {
      uni.showToast({ title: error.message || '举报失败', icon: 'none' });
      console.error(error);
    }
  };

  return {
    isReportVisible,
    openReportModal,
    closeReportModal,
    submitReport
  };
}
