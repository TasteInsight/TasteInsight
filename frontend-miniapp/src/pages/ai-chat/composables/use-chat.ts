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
      
      // 格式化本地时间为 ISO8601 格式（带时区偏移）
      const pad2 = (n: number) => n.toString().padStart(2, '0');
      const pad3 = (n: number) => n.toString().padStart(3, '0');
      
      const year = now.getFullYear();
      const month = pad2(now.getMonth() + 1);
      const day = pad2(now.getDate());
      const hours = pad2(now.getHours());
      const minutes = pad2(now.getMinutes());
      const seconds = pad2(now.getSeconds());
      const millis = pad3(now.getMilliseconds());

      const tzOffsetMinutes = -now.getTimezoneOffset();
      const sign = tzOffsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(tzOffsetMinutes);
      const offH = pad2(Math.floor(abs / 60));
      const offM = pad2(abs % 60);

      const localTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}${sign}${offH}:${offM}`;
      
      const clientContext = {
        localTime,
        tzOffsetMinutes,
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
      const wasCurrent = chatStore.sessionId === sessionId;
      await chatStore.removeSession(sessionId);
      if (wasCurrent) {
        await fetchSuggestions();
      }
      return true;
    } catch (e) {
      console.error('Failed to delete session', e);
      return false;
    }
  };

  onMounted(() => {
    init();
  });

  const stopStreaming = () => {
    chatStore.abortChat(true); // 用户手动停止，显示提示
  };

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
    stopStreaming,
  };
}
