import { ref, onMounted, computed } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { getAISuggestions } from '@/api/modules/ai';

export function useChat() {
  const chatStore = useChatStore();
  const suggestions = ref<string[]>([]);
  const isSuggestionsLoading = ref(false);

  // 首次加载状态
  const hasInitialized = ref(false);
  const isInitialLoading = computed(() => !hasInitialized.value && chatStore.messages.length === 0);

  const fetchSuggestions = async () => {
    isSuggestionsLoading.value = true;
    try {
      const res = await getAISuggestions();
      if (res.code === 200 && res.data && res.data.suggestions) {
        suggestions.value = res.data.suggestions;
      }
    } catch (e) {
      console.error('Failed to fetch suggestions', e);
    } finally {
      isSuggestionsLoading.value = false;
    }
  };

  const init = async () => {
    if (chatStore.messages.length === 0) {
      await chatStore.initSession();
    }
    await fetchSuggestions();
    hasInitialized.value = true;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    // 发送消息
    await chatStore.sendChatMessage(text);
    
    // 消息发送后，刷新建议词 (模拟根据上下文更新)
    // 实际场景中，后端可能会在流式响应结束后返回新的建议，或者需要再次调用接口
    // 这里简单起见，再次调用获取建议接口
    fetchSuggestions();
  };

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  onMounted(() => {
    init();
  });

  return {
    messages: computed(() => chatStore.messages),
    aiLoading: computed(() => chatStore.aiLoading),
    suggestions,
    isInitialLoading,
    sendMessage,
    handleSuggestionClick,
    refreshSuggestions: fetchSuggestions
  };
}
