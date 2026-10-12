import type { InboxNotification } from '@/api/modules/notifications';

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
  }
}

export function notificationDestination(
  item: InboxNotification
): { url: string; tab?: boolean } | null {
  const id = encodeURIComponent(item.targetId);
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
