import type { InboxNotification } from '@/api/modules/notifications';
import type { UiIconName } from '@/components/UiIcon.vue';
import dayjs from 'dayjs';

const systemPresentation: Partial<
  Record<InboxNotification['type'], { title: string; icon: UiIconName }>
> = {
  dining_accepted: { title: '约饭申请已接受', icon: 'users' },
  dining_rejected: { title: '约饭申请未接受', icon: 'users' },
  dining_cancelled: { title: '约饭已取消', icon: 'calendar' },
  new_dish: { title: '食堂上新', icon: 'plus' },
  price_change: { title: '菜品价格更新', icon: 'info' },
  weekly_recommendation: { title: '本周推荐已更新', icon: 'calendar' },
  report_handled: { title: '举报处理结果已更新', icon: 'shield' },
  upload_approved: { title: '菜品资料已采纳', icon: 'shield' },
  upload_rejected: { title: '菜品资料未通过', icon: 'edit' },
  upload_revoked: { title: '菜品资料已退回', icon: 'history' },
};

export function notificationTitle(item: InboxNotification): string {
  return systemPresentation[item.type]?.title || notificationText(item);
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
  const actor = item.actor?.nickname || '一位同学';
  const target =
    item.targetType === 'review' ? '评价' : item.targetType === 'post' ? '动态' : '回复';
  switch (item.type) {
    case 'like':
      return `${actor} 赞了你的${target}`;
    case 'reply':
      return `${actor} 回复了你`;
    case 'dining_application':
      return `${actor} 申请与你同行`;
    case 'dining_accepted':
      return '你的约饭申请已被接受';
    case 'dining_rejected':
      return '你的约饭申请未被接受';
    case 'dining_cancelled':
      return '你参加的约饭已取消';
    case 'new_dish':
      return '食堂上新了，来看看新菜品';
    case 'price_change':
      return '关注的菜品价格有更新';
    case 'weekly_recommendation':
      return '本周推荐已更新';
    case 'report_handled':
      return '你提交的举报已有处理结果，查看处理详情';
    case 'upload_approved':
      return '你提交的菜品资料已采纳';
    case 'upload_rejected':
      return '你提交的菜品资料未通过审核，查看原因并修改';
    case 'upload_revoked':
      return '你提交的菜品资料已退回审核';
  }
}

export function notificationDestination(
  item: InboxNotification
): { url: string; tab?: boolean } | null {
  const id = encodeURIComponent(item.targetId);
  if (item.targetType === 'report') return { url: `/pages/profile/my-reports/index?id=${id}` };
  if (item.targetType === 'dish_upload') return { url: `/pages/profile/my-uploads/index?id=${id}` };
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
