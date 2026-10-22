import { t } from '@/i18n';
import { computed, ref, onMounted, reactive, getCurrentScope, onScopeDispose, watch } from 'vue';
import { getNewsList } from '@/api/modules/news';
import type { News } from '@/types/api';

/**
 * 获取并管理新闻列表数据的组合式函数 (模拟 usePagination 逻辑)
 * @param {object} initialParams - 初始查询参数
 */
export function useNewsList(initialParams = {}, isActive: () => boolean = () => true) {
  const list = ref<News[]>([]); // 新闻列表数据
  const loading = ref(false); // 是否正在加载
  const initialized = ref(false);
  const finished = ref(false); // 是否加载完毕
  const isRefreshing = ref(false); // 下拉刷新状态
  const error = ref('');
  const errorText = computed(() =>
    error.value.startsWith('social.') ? t(error.value) : error.value
  );
  let disposed = false;
  let failedReset = true;
  let mounted = false;
  const attempted = ref(false);
  const needsInitialLoad = computed(() => !attempted.value);
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

  const meta = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    ...initialParams,
  });

  const loadData = async (reset = false): Promise<boolean> => {
    if (disposed || loading.value || (!reset && finished.value)) return false;
    attempted.value = true;
    const page = reset ? 1 : meta.page;
    isRefreshing.value = reset;
    error.value = '';
    failedReset = reset;

    loading.value = true;
    try {
      const res = await getNewsList({
        page,
        pageSize: meta.pageSize,
      });
      if (disposed) return false;

      if (res.code === 200 && res.data) {
        const newItems = res.data.items || [];
        if (reset) {
          list.value = newItems;
        } else {
          list.value = [...list.value, ...newItems];
        }

        // 更新分页信息
        Object.assign(meta, res.data.meta);
        meta.page = meta.page + 1; // 准备加载下一页

        finished.value = meta.page > meta.totalPages;
        initialized.value = true;
        return true;
      } else {
        console.error('获取新闻列表失败:', res.message);
        error.value = 'social.loadNewsRetry';
      }
    } catch (cause) {
      console.error('API请求错误:', cause);
      if (!disposed) error.value = 'social.loadNewsRetry';
    } finally {
      loading.value = false;
      isRefreshing.value = false; // 结束刷新
    }
    return false;
  };

  const refresh = () => loadData(true);
  const loadMore = () => loadData(false);

  const loadInitial = () => {
    if (mounted && isActive() && needsInitialLoad.value) void refresh();
  };
  onMounted(() => {
    mounted = true;
    loadInitial();
  });
  watch(isActive, loadInitial);

  return {
    list,
    loading,
    initialized,
    needsInitialLoad,
    finished,
    isRefreshing,
    error: errorText,
    meta,
    refresh,
    loadMore,
    retry: () => loadData(failedReset),
  };
}
