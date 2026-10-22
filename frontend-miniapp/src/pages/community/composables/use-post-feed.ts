import { t } from '@/i18n';
import { computed, onScopeDispose, ref, watch } from 'vue';
import { getPosts, type Post } from '@/api/modules/social';
import { useUserStore } from '@/store/modules/use-user-store';

export function usePostFeed(source: () => { mine?: boolean; authorId?: string } = () => ({})) {
  const user = useUserStore();
  const posts = ref<Post[]>([]);
  const loading = ref(false);
  const initialized = ref(false);
  const error = ref('');
  const errorText = computed(() =>
    error.value.startsWith('social.') ? t(error.value) : error.value
  );
  const page = ref(0);
  const totalPages = ref(1);
  const hasMore = computed(() => page.value < totalPages.value);
  let version = 0;
  let active = true;
  let failedAppend = false;
  function invalidate() {
    version++;
    loading.value = false;
  }
  function reset() {
    invalidate();
    posts.value = [];
    initialized.value = false;
    error.value = '';
    page.value = 0;
    totalPages.value = 1;
    failedAppend = false;
  }
  async function load(append = false) {
    if (!active || (append && (loading.value || !hasMore.value))) return;
    const options = source();
    if (options.mine && !user.isLoggedIn) {
      reset();
      return;
    }
    const session = user.sessionVersion;
    const request = ++version;
    const current = () => active && request === version && session === user.sessionVersion;
    loading.value = true;
    error.value = '';
    try {
      const response = await getPosts(
        {
          page: append ? page.value + 1 : 1,
          pageSize: 20,
          ...(options.authorId ? { authorId: options.authorId } : {}),
        },
        options.mine
      );
      if (!current()) return;
      if (response.code !== 200) throw new Error(response.message || 'social.loadPostFailed');
      const previous = append ? posts.value : [];
      const incoming = new Set(response.data.items.map(item => item.id));
      posts.value = [...previous.filter(item => !incoming.has(item.id)), ...response.data.items];
      page.value = response.data.meta.page;
      totalPages.value = response.data.meta.totalPages;
      initialized.value = true;
    } catch (cause) {
      if (current()) {
        failedAppend = append;
        error.value = cause instanceof Error ? cause.message : 'social.loadPostsRetry';
      }
    } finally {
      if (current()) loading.value = false;
    }
  }
  watch(() => user.sessionVersion, reset, { flush: 'sync' });
  onScopeDispose(() => {
    active = false;
    invalidate();
  });
  const retry = () => load(failedAppend);
  return { posts, loading, initialized, error: errorText, hasMore, load, retry, reset, invalidate };
}
