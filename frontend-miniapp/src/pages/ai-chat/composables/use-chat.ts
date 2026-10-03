import { ref, onMounted, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { getAISuggestions } from '@/api/modules/ai';
import type { AIScene } from '@/types/api';

export function useChat() {
  const chatStore = useChatStore();
  const userStore = useUserStore();
  const suggestions = ref<string[]>([]);
  const isSuggestionsLoading = ref(false);

  // 首次加载状态
  const hasInitialized = ref(false);
  const isInitializing = ref(false);
  const isInitialLoading = computed(
    () => isInitializing.value || (!hasInitialized.value && chatStore.messages.length === 0)
  );
  const operationVersion = ref(0);
  let disposed = false;

  const captureOperation = () => {
    const operation = operationVersion.value;
    const sessionVersion = userStore.sessionVersion;
    const owner = userStore.userInfo?.id;
    return () => !disposed && operation === operationVersion.value &&
      sessionVersion === userStore.sessionVersion && owner === userStore.userInfo?.id;
  };

  const invalidateOperation = () => {
    operationVersion.value += 1;
    isInitializing.value = false;
    isSuggestionsLoading.value = false;
  };

  const beginOperation = (initializing = false) => {
    invalidateOperation();
    isInitializing.value = initializing;
    return captureOperation();
  };

  const fetchSuggestions = async (isCurrent = beginOperation()) => {
    if (!isCurrent()) return;
    const sessionId = chatStore.sessionId;
    const ownsSuggestions = () => isCurrent() && chatStore.sessionId === sessionId;
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
      if (!ownsSuggestions()) return;
      if (res.code === 200 && res.data && res.data.suggestions) {
        suggestions.value = res.data.suggestions;
      }
    } catch (e) {
      if (!ownsSuggestions()) return;
      console.error('Failed to fetch suggestions', e);
    } finally {
      if (ownsSuggestions()) isSuggestionsLoading.value = false;
    }
  };

  const scene = computed<AIScene>(() => chatStore.currentScene || 'general_chat');

  const setScene = (s: string) => {
    // forward to store for validation
    const previous = chatStore.currentScene;
    chatStore.setScene(s);
    if (previous !== chatStore.currentScene) invalidateOperation();
  };

  const init = async (s?: string) => {
    // 如果传入 scene 则更新
    if (s) setScene(s);

    const isCurrent = beginOperation(true);
    try {
      if (chatStore.messages.length === 0) {
        if (!await chatStore.initSession(scene.value)) return;
      }
      if (!isCurrent()) return;
      await fetchSuggestions(isCurrent);
    } finally {
      if (isCurrent()) {
        isInitializing.value = false;
        hasInitialized.value = true;
      }
    }
  };

  const resetChat = async (s?: string) => {
    // 如果指定了新场景，先更新 store 状态
    if (s) setScene(s);

    const isCurrent = beginOperation(true);
    try {
      // 开启新会话 (内部会自动创建 session 并拉取 welcomeMessage)
      await chatStore.startNewSession(s || scene.value);
      if (!isCurrent() || !chatStore.sessionId) return;

      // 刷新建议词
      await fetchSuggestions(isCurrent);
    } finally {
      if (isCurrent()) {
        isInitializing.value = false;
        hasInitialized.value = true;
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || disposed) return;

    const isCurrent = beginOperation();
    try {
      await chatStore.sendChatMessage(text);
      if (!isCurrent() || !chatStore.sessionId) return;
      // 消息发送后，刷新建议词 (模拟根据上下文更新)
      // 实际场景中，后端可能会在流式响应结束后返回新的建议，或者需要再次调用接口
      // 这里简单起见，再次调用获取建议接口
      await fetchSuggestions(isCurrent);
    } catch (e) {
      if (!isCurrent()) return;
      console.error('Failed to send chat message', e);
      // Optionally, show error to user here
    }
  };

  const handleSuggestionClick = (text: string) => {
    return sendMessage(text);
  };

  const loadHistorySession = async (
    sessionId: string,
    onComplete?: (loaded: boolean) => void
  ): Promise<boolean | undefined> => {
    const isCurrent = beginOperation(true);
    try {
      const ok = chatStore.loadSessionFromHistory(sessionId);
      if (ok) {
        await fetchSuggestions(isCurrent);
      }
      if (!isCurrent()) return;
      onComplete?.(ok);
      return ok;
    } finally {
      if (isCurrent()) {
        isInitializing.value = false;
        hasInitialized.value = true;
      }
    }
  };

  const deleteSession = async (
    sessionId: string,
    onSuccess?: () => void
  ): Promise<boolean | undefined> => {
    const wasCurrent = chatStore.sessionId === sessionId;
    const isCurrent = wasCurrent ? beginOperation() : captureOperation();
    try {
      const removed = await chatStore.removeSession(sessionId);
      if (!isCurrent()) return;
      if (!removed) return false;
      if (wasCurrent) {
        await fetchSuggestions(isCurrent);
      }
      if (!isCurrent()) return;
      onSuccess?.();
      return true;
    } catch (e) {
      if (!isCurrent()) return;
      console.error('Failed to delete session', e);
      return false;
    }
  };

  watch(
    [() => userStore.sessionVersion, () => userStore.isLoggedIn ? userStore.userInfo?.id : null],
    () => {
      invalidateOperation();
      suggestions.value = [];
      hasInitialized.value = false;
    },
    { flush: 'sync' }
  );

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      invalidateOperation();
    });
  }

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
    captureOperation,
    handleSuggestionClick,
    refreshSuggestions: fetchSuggestions,
    resetChat,
    scene,
    setScene,
    historyEntries: computed(() => chatStore.historyEntries),
    loadHistorySession,
    applyMealPlan: chatStore.applyMealPlan,
    deleteSession,
    stopStreaming,
  };
}
