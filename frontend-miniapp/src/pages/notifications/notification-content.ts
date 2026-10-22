import { t } from '@/i18n';
import type { InboxNotification } from '@/api/modules/notifications';
import type { UiIconName } from '@/types/ui-icon';
import dayjs from 'dayjs';

const systemPresentation: Partial<
  Record<InboxNotification['type'], { title: string; icon: UiIconName }>
> = {
  dining_accepted: { title: 'social.inviteAcceptedTitle', icon: 'users' },
  dining_rejected: { title: 'social.inviteRejectedTitle', icon: 'users' },
  dining_cancelled: { title: 'social.inviteCancelledTitle', icon: 'calendar' },
  new_dish: { title: 'social.newDishTitle', icon: 'plus' },
  price_change: { title: 'social.priceChangeTitle', icon: 'info' },
  weekly_recommendation: { title: 'social.weeklyUpdated', icon: 'calendar' },
  report_handled: { title: 'social.reportHandledTitle', icon: 'shield' },
  upload_approved: { title: 'social.uploadApprovedTitle', icon: 'shield' },
  upload_rejected: { title: 'social.uploadRejectedTitle', icon: 'edit' },
  upload_revoked: { title: 'social.uploadRevokedTitle', icon: 'history' },
};

export function notificationTitle(item: InboxNotification): string {
  const title = systemPresentation[item.type]?.title;
  return title ? t(title) : notificationText(item);
}

export function notificationIcon(item: InboxNotification): UiIconName {
  if (item.type === 'like') return 'star';
  if (item.type === 'reply') return 'chat';
  if (item.type === 'dining_application') return 'users';
  return systemPresentation[item.type]?.icon || 'bell';
}

export function formatNotificationDate(date: string, now: Date = new Date()): string {
  const created = dayjs(date);
  const current = dayjs(now);
  if (created.isSame(current, 'day')) return created.format('HH:mm');
  return created.format(created.isSame(current, 'year') ? 'M/D HH:mm' : 'YYYY/M/D HH:mm');
}

export function notificationText(item: InboxNotification): string {
  const actor = item.actor?.nickname || t('social.someone');
  const target =
    item.targetType === 'review'
      ? t('social.reviewTarget')
      : item.targetType === 'post'
        ? t('social.postTarget')
        : t('social.replyTarget');
  switch (item.type) {
    case 'like':
      return t('social.likedNotification', { p0: actor, p1: target });
    case 'reply':
      return t('social.repliedNotification', { p0: actor });
    case 'dining_application':
      return t('social.mealRequestNotification', { p0: actor });
    case 'dining_accepted':
      return t('social.inviteAcceptedText');
    case 'dining_rejected':
      return t('social.inviteRejectedText');
    case 'dining_cancelled':
      return t('social.inviteCancelledText');
    case 'new_dish':
      return t('social.newDishText');
    case 'price_change':
      return t('social.priceChangeText');
    case 'weekly_recommendation':
      return t('social.weeklyUpdated');
    case 'report_handled':
      return t('social.reportHandledText');
    case 'upload_approved':
      return t('social.uploadApprovedText');
    case 'upload_rejected':
      return t('social.uploadRejectedText');
    case 'upload_revoked':
      return t('social.uploadRevokedText');
  }
}

export function notificationDestination(
  item: InboxNotification
): { url: string; tab?: boolean } | null {
  const id = encodeURIComponent(item.targetId);
  if (item.targetType === 'report') return { url: `/pages/profile/records/my-reports/index?id=${id}` };
  if (item.targetType === 'dish_upload') return { url: `/pages/profile/records/my-uploads/index?id=${id}` };
  if (item.targetType === 'dish') return { url: `/pages/dish/index?id=${id}` };
  if (item.targetType === 'week_collection')
    return { url: `/pages/notifications/weekly?week=${id}` };
  if (item.targetType === 'review' || item.targetType === 'comment') {
    if (!item.dishId) return null;
    const reviewId = item.targetType === 'review' ? item.targetId : item.rootId;
    if (!reviewId) return null;
    return {
      url: `/pages/dish/index?id=${encodeURIComponent(item.dishId)}&reviewId=${encodeURIComponent(reviewId)}`,
    };
  }
  // #ifndef MP-WEIXIN
  if (item.targetType === 'post') return { url: `/pages/community/detail?id=${id}` };
  if (item.targetType === 'postComment' && item.rootId)
    return { url: `/pages/community/detail?id=${encodeURIComponent(item.rootId)}` };
  if (item.targetType === 'dining_invite') return { url: `/pages/planning/dining?id=${id}` };
  // #endif
  return null;
}
