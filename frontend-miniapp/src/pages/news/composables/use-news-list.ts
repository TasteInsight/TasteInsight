// @/pages/news/composables/useNewsList.js
import { ref, onMounted, reactive } from 'vue';
import { getNewsList } from '@/api/modules/news';
import type { News } from '@/types/api';

/**
 * 获取并管理新闻列表数据的组合式函数 (模拟 usePagination 逻辑)
 * @param {object} initialParams - 初始查询参数
 */
export function useNewsList(initialParams = {}) {
  const list = ref<News[]>([]);// 新闻列表数据
  const loading = ref(false); // 是否正在加载
  const finished = ref(false); // 是否加载完毕
  const isRefreshing = ref(false); // 下拉刷新状态
  
  const meta = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    ...initialParams
  });

  const loadData = async (reset = false) => {
    if (loading.value || (!reset && finished.value)) return;

    if (reset) {
      meta.page = 1;
      finished.value = false;
      isRefreshing.value = true; // 开始刷新
    }
    
    loading.value = true;
    try {
      const res = await getNewsList({
        page: meta.page,
        pageSize: meta.pageSize,
      });

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

        if (meta.page > meta.totalPages) {
          finished.value = true;
        }
      } else {
        console.error('获取新闻列表失败:', res.message);
        // 如果是首次加载失败，清空列表并标记完成
        if (reset) list.value = []; 
        finished.value = true;
      }
    } catch (error) {
      console.error('API请求错误:', error);
      if (reset) list.value = [];
      finished.value = true;
    } finally {
      loading.value = false;
      isRefreshing.value = false; // 结束刷新
    }
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
    finished,
    isRefreshing,
    meta,
    refresh,
    loadMore,
  };
}