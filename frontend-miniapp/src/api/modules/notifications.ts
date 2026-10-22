import request from '@/utils/request';
import type { Dish, PaginatedData, PaginationParams } from '@/types/api';

export type NotificationScope = 'all' | 'service';
export interface InboxNotification {
  id: string;
  type:
    | 'like'
    | 'reply'
    | 'dining_application'
    | 'dining_accepted'
    | 'dining_rejected'
    | 'dining_cancelled'
    | 'new_dish'
    | 'price_change'
    | 'weekly_recommendation'
    | 'upload_approved'
    | 'upload_rejected'
    | 'upload_revoked'
    | 'report_handled';
  actor: { id: string; nickname: string; avatar: string } | null;
  targetType:
    | 'review'
    | 'comment'
    | 'post'
    | 'postComment'
    | 'dining_invite'
    | 'dish'
    | 'week_collection'
    | 'dish_upload'
    | 'report';
  targetId: string;
  subject?: string | null;
  subjectEn?: string | null;
  rootId: string | null;
  dishId?: string | null;
  readAt: string | null;
  createdAt: string;
}

export function notificationScope(): NotificationScope {
  // #ifdef MP-WEIXIN
  return 'service';
  // #endif
  // #ifndef MP-WEIXIN
  return 'all';
  // #endif
}

export const getNotifications = (params: PaginationParams = {}) =>
  request<PaginatedData<InboxNotification>>({
    url: '/notifications',
    method: 'GET',
    data: { ...params, scope: notificationScope() },
  });
export const getUnreadNotificationCount = () =>
  request<{ unreadCount: number }>({
    url: '/notifications/unread-count',
    method: 'GET',
    data: { scope: notificationScope() },
  });
export const readNotification = (id: string) =>
  request<null>({
    url: `/notifications/${encodeURIComponent(id)}/read?scope=${notificationScope()}`,
    method: 'PUT',
  });
export const readAllNotifications = () =>
  request<null>({ url: `/notifications/read-all?scope=${notificationScope()}`, method: 'PUT' });
export const getWeeklyNotificationCollection = (weekKey: string) =>
  request<{ weekKey: string; items: Dish[]; publishedAt: string }>({
    url: `/notifications/weekly/${encodeURIComponent(weekKey)}`,
    method: 'GET',
  });
