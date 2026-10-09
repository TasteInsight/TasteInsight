import { ref, onMounted, reactive, getCurrentScope, onScopeDispose } from 'vue';
import { getNewsList } from '@/api/modules/news';
import type { News } from '@/types/api';

/**
 * 获取并管理新闻列表数据的组合式函数 (模拟 usePagination 逻辑)
 * @param {object} initialParams - 初始查询参数
 */
export function useNewsList(initialParams = {}) {
  const list = ref<News[]>([]); // 新闻列表数据
  const loading = ref(false); // 是否正在加载
  const initialized = ref(false);
  const finished = ref(false); // 是否加载完毕
  const isRefreshing = ref(false); // 下拉刷新状态
  const error = ref('');
  let disposed = false;
  let failedReset = true;
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
        error.value = '公告加载失败，请重试';
      }
    } catch (cause) {
      console.error('API请求错误:', cause);
      if (!disposed) error.value = '公告加载失败，请重试';
    } finally {
      loading.value = false;
      isRefreshing.value = false; // 结束刷新
    }
    return false;
  };

  const refresh = () => loadData(true);
  const loadMore = () => loadData(false);

  // 组件挂载时自动加载数据
  onMounted(() => {
    refresh();
  });

  return {
    list,
    loading,
    initialized,
    finished,
    isRefreshing,
    error,
    meta,
    refresh,
    loadMore,
    retry: () => loadData(failedReset),
  };
}
