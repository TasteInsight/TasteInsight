import { ref, onMounted, computed } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { getAISuggestions } from '@/api/modules/ai';
import type { AIScene } from '@/types/api';

export function useChat() {
  const chatStore = useChatStore();
  const suggestions = ref<string[]>([]);
  const isSuggestionsLoading = ref(false);

  // 首次加载状态
  const hasInitialized = ref(false);
  const isInitializing = ref(false);
  const isInitialLoading = computed(
    () => isInitializing.value || (!hasInitialized.value && chatStore.messages.length === 0)
  );

  const fetchSuggestions = async () => {
    isSuggestionsLoading.value = true;
    try {
      // 构建时间上下文，与发送聊天消息时保持一致
      const now = new Date();
      const clientContext = {
        localTime: now.toISOString(),
        tzOffsetMinutes: -now.getTimezoneOffset(),
        timeZone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined,
      };
      
      const res = await getAISuggestions(clientContext);
      if (res.code === 200 && res.data && res.data.suggestions) {
        suggestions.value = res.data.suggestions;
      }
    } catch (e) {
      console.error('Failed to fetch suggestions', e);
    } finally {
      isSuggestionsLoading.value = false;
    }
  };

  const scene = ref<AIScene>(chatStore.currentScene || 'general_chat');

  const setScene = (s: string) => {
    // forward to store for validation
    chatStore.setScene(s);
    scene.value = chatStore.currentScene || 'general_chat';
  };

  const init = async (s?: string) => {
    // 如果传入 scene 则更新
    if (s) setScene(s);

    isInitializing.value = true;
    try {
      if (chatStore.messages.length === 0) {
        await chatStore.initSession(scene.value);
      }
      await fetchSuggestions();
    } finally {
      isInitializing.value = false;
      hasInitialized.value = true;
    }
  };

  const resetChat = async (s?: string) => {
    // 如果指定了新场景，先更新 store 状态
    if (s) setScene(s);

    isInitializing.value = true;
    try {
      // 开启新会话 (内部会自动创建 session 并拉取 welcomeMessage)
      await chatStore.startNewSession(s || scene.value);

      // 刷新建议词
      await fetchSuggestions();
    } finally {
      isInitializing.value = false;
      hasInitialized.value = true;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    try {
      await chatStore.sendChatMessage(text);
      // 消息发送后，刷新建议词 (模拟根据上下文更新)
      // 实际场景中，后端可能会在流式响应结束后返回新的建议，或者需要再次调用接口
      // 这里简单起见，再次调用获取建议接口
      fetchSuggestions();
    } catch (e) {
      console.error('Failed to send chat message', e);
      // Optionally, show error to user here
    }
  };

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  const loadHistorySession = async (sessionId: string) => {
    isInitializing.value = true;
    try {
      const ok = chatStore.loadSessionFromHistory(sessionId);
      if (ok) {
        await fetchSuggestions();
      }
      return ok;
    } finally {
      isInitializing.value = false;
      hasInitialized.value = true;
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await chatStore.removeSession(sessionId);
      return true;
    } catch (e) {
      console.error('Failed to delete session', e);
      return false;
    }
  };

  onMounted(() => {
    init();
  });

  return {
    messages: computed(() => chatStore.messages),
    aiLoading: computed(() => chatStore.aiLoading),
    currentSessionId: computed(() => chatStore.sessionId),
    suggestions,
    isInitializing,
    isInitialLoading,
    init,
    sendMessage,
    handleSuggestionClick,
    refreshSuggestions: fetchSuggestions,
    resetChat,
    scene,
    setScene,
    historyEntries: computed(() => chatStore.historyEntries),
    loadHistorySession,
    deleteSession,
  };
}
