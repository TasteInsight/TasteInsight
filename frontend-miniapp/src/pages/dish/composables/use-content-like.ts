import { t } from '@/i18n';
import { getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue';
import type { ApiResponse } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';

interface Likeable {
  id: string;
  status: string;
  likeCount?: number;
  likedByMe?: boolean;
}

export function useContentLike<T extends Likeable>(
  items: () => T[],
  setLike: (
    id: string,
    liked: boolean
  ) => Promise<ApiResponse<{ liked: boolean; likeCount: number }>>
) {
  const user = useUserStore();
  const pending = shallowRef<Record<string, boolean>>({});
  const changes = shallowRef<Record<string, { source: T; liked: boolean; count: number }>>({});
  let active = true;
  let generation = 0;
  const isLiked = (item: T) =>
    changes.value[item.id]?.source === item ? changes.value[item.id].liked : !!item.likedByMe;
  const likeCount = (item: T) =>
    changes.value[item.id]?.source === item ? changes.value[item.id].count : (item.likeCount ?? 0);
  const resetLikes = () => {
    generation++;
    pending.value = {};
    changes.value = {};
  };
  async function toggleLike(item: T) {
    if (!active || pending.value[item.id] || item.status !== 'approved' || !requireStudent())
      return;
    const session = user.sessionVersion;
    const version = generation;
    const current = () => active && version === generation && session === user.sessionVersion;
    pending.value = { ...pending.value, [item.id]: true };
    try {
      const response = await setLike(item.id, !isLiked(item));
      if (!current() || !items().includes(item)) return;
      if (response.code !== 200)
        throw new Error(response.message || t('food.couldNotLikeTryAgain'));
      changes.value = {
        ...changes.value,
        [item.id]: { source: item, liked: response.data.liked, count: response.data.likeCount },
      };
    } catch (error) {
      if (current())
        uni.showToast({
          title: error instanceof Error ? error.message : t('food.couldNotLikeTryAgain'),
          icon: 'none',
        });
    } finally {
      if (current()) {
        const next = { ...pending.value };
        delete next[item.id];
        pending.value = next;
      }
    }
  }
  watch(() => user.sessionVersion, resetLikes, { flush: 'sync' });
  if (getCurrentScope())
    onScopeDispose(() => {
      active = false;
      resetLikes();
    });
  return { pending, isLiked, likeCount, toggleLike, resetLikes };
}
