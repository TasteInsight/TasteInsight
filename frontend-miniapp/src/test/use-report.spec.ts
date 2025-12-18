/// <reference types="jest" />
import { useReport } from '@/pages/dish/composables/use-report';
import { reportReview } from '@/api/modules/review';
import { reportComment } from '@/api/modules/comment';
import type { ReportRequest } from '@/types/api';

// Mock APIs
jest.mock('@/api/modules/review', () => ({
  reportReview: jest.fn(),
}));
jest.mock('@/api/modules/comment', () => ({
  reportComment: jest.fn(),
}));

// Mock uni-app APIs
(global as any).uni = {
  showToast: jest.fn(),
} as any;

describe('useReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { isReportVisible } = useReport();
    expect(isReportVisible.value).toBe(false);
  });

  it('should open report modal correctly', () => {
    const { openReportModal, isReportVisible } = useReport();
    
    openReportModal('review', '123');
    
    expect(isReportVisible.value).toBe(true);
  });

  it('should close report modal correctly', () => {
    const { openReportModal, closeReportModal, isReportVisible } = useReport();
    
    openReportModal('review', '123');
    closeReportModal();
    
    expect(isReportVisible.value).toBe(false);
  });

  it('should submit review report successfully', async () => {
    const { openReportModal, submitReport } = useReport();
    const mockData: ReportRequest = { type: 'spam', reason: 'Spam content' };
    
    openReportModal('review', '123');
    (reportReview as jest.Mock).mockResolvedValue({ code: 200 });

    await submitReport(mockData);

    expect(reportReview).toHaveBeenCalledWith('123', mockData);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '举报成功' }));
  });

  it('should submit comment report successfully', async () => {
    const { openReportModal, submitReport } = useReport();
    const mockData: ReportRequest = { type: 'inappropriate', reason: 'Abusive content' };
    
    openReportModal('comment', '456');
    (reportComment as jest.Mock).mockResolvedValue({ code: 200 });

    await submitReport(mockData);

    expect(reportComment).toHaveBeenCalledWith('456', mockData);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '举报成功' }));
  });

  it('should handle report error', async () => {
    const { openReportModal, submitReport } = useReport();
    const mockData: ReportRequest = { type: 'spam', reason: 'Spam content' };
    
    openReportModal('review', '123');
    (reportReview as jest.Mock).mockRejectedValue(new Error('Network Error'));

    await submitReport(mockData);

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Network Error', icon: 'none' }));
  });
});
