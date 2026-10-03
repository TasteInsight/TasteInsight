import { defineStore } from 'pinia';
import { ref, reactive, watch } from 'vue';
import { useUserStore } from './use-user-store';
import { createAISession, streamAIChat, submitRecommendFeedback, deleteAISession } from '@/api/modules/ai';
import { USE_MOCK } from '../../mock/mock-adapter';
import type {
  ChatRequest,
  RecommendFeedbackRequest,
  ComponentDishCard,
  ComponentMealPlanDraft,
  ComponentCanteenCard,
  ComponentWindowCard,
} from '@/types/api';
import type { AIScene } from '@/types/api';

// 消息段类型
export type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'card_dish'; data: ComponentDishCard[] }
  | { type: 'card_plan'; data: ComponentMealPlanDraft[] }
  | { type: 'card_canteen'; data: ComponentCanteenCard[] }
  | { type: 'card_window'; data: ComponentWindowCard[] };

// 内部消息类型定义
export interface ChatMessage {
  id: number;
  type: 'user' | 'ai'; // 消息发送方
  content: MessageSegment[]; // 支持混排
  timestamp: number;
  isStreaming?: boolean; // 是否正在流式接收中
}

// 历史会话记录
export interface ChatHistoryEntry {
  sessionId: string;
  scene: AIScene;
  updatedAt: number;
  title?: string; // 可选标题（来自首条用户消息）
  messages: ChatMessage[];
}

type ChatStream = {
  sessionId: string;
  scene: AIScene;
  messages: ChatMessage[];
  aiMessage: ChatMessage;
  close?: () => void;
};

// 转换为 Pinia Setup Store
export const useChatStore = defineStore('ai-chat', () => {
  const userStore = useUserStore();
  // === Constants ===
  // 最大历史记录条数：限制存储大小，避免本地存储过大影响性能
  const MAX_HISTORY_ENTRIES = 20;

  // === State (使用 ref 声明响应式状态) ===
  const messages = ref<ChatMessage[]>([]);
  const aiLoading = ref(false); // AI 正在回复
  const sessionId = ref<string>('');
  const historyEntries = ref<ChatHistoryEntry[]>([]);
  let activeStream: ChatStream | null = null;
  let historyOwner: string | null = null;
  let conversationVersion = 0;
  let sessionCreation: Promise<boolean> | null = null;

  // === Actions (声明为普通函数) ===

  // 当前会话场景，默认为 general_chat
  const currentScene = ref<AIScene>('general_chat');
  const ALLOWED_SCENES = ['general_chat', 'meal_planner', 'dish_critic'] as const;

  function setScene(scene?: string | AIScene) {
    const s = (scene || 'general_chat') as string;
    if ((ALLOWED_SCENES as readonly string[]).includes(s)) {
      currentScene.value = s as AIScene;
    } else {
      currentScene.value = 'general_chat';
    }
  }

  function abortChat(showToast = true) {
    const stream = activeStream;
    activeStream = null;
    if (stream) {
      stream.aiMessage.isStreaming = false;
      const lastSegment = stream.aiMessage.content[stream.aiMessage.content.length - 1];
      if (!showToast && lastSegment?.type === 'text' && lastSegment.text.trim()) {
        lastSegment.text += '\n\n_[回复被中断]_';
      }
      upsertHistoryEntry(stream.sessionId, stream.scene, stream.messages);
      stream.close?.();
      if (showToast) {
        uni.showToast({ 
          title: '已停止生成', 
          icon: 'none',
          duration: 1500
        });
      }
    }
    
    aiLoading.value = false;
  }

  // === History helpers ===
  function persistHistory() {
    if (!historyOwner) return;
    try {
      uni.setStorageSync(`ai-chat-history:${historyOwner}`, historyEntries.value);
    } catch (e) {
      console.error('persistHistory failed', e);
    }
  }

  function loadHistoryFromStorage() {
    if (!historyOwner) return;
    try {
      const cached = uni.getStorageSync(`ai-chat-history:${historyOwner}`);
      if (cached && Array.isArray(cached)) {
        historyEntries.value = cached as ChatHistoryEntry[];
      }
    } catch (e) {
      console.error('loadHistoryFromStorage failed', e);
    }
  }

  function cloneMessages(msgs: ChatMessage[]) {
    return JSON.parse(JSON.stringify(msgs)) as ChatMessage[];
  }

  function upsertHistoryEntry(session: string, scene: AIScene, msgs: ChatMessage[]) {
    if (!session) return;
    const copy = cloneMessages(msgs);
    const textSeg = copy.find(m => m.type === 'user')?.content?.find(seg => seg.type === 'text');
    const title = textSeg && textSeg.type === 'text' ? textSeg.text : '对话';
    const idx = historyEntries.value.findIndex(h => h.sessionId === session);
    const entry: ChatHistoryEntry = {
      sessionId: session,
      scene,
      updatedAt: Date.now(),
      title,
      messages: copy,
    };
    if (idx >= 0) {
      historyEntries.value[idx] = entry;
    } else {
      historyEntries.value.unshift(entry);
    }
    // 最多保留 MAX_HISTORY_ENTRIES 条
    historyEntries.value = historyEntries.value.slice(0, MAX_HISTORY_ENTRIES);
    persistHistory();
  }

  function loadSessionFromHistory(session: string) {
    const selected = historyEntries.value.find(h => h.sessionId === session);
    if (!selected) return false;
    abortChat(false);
    conversationVersion += 1;
    sessionCreation = null;
    const target = historyEntries.value.find(h => h.sessionId === session) || selected;
    messages.value = cloneMessages(target.messages);
    sessionId.value = target.sessionId;
    setScene(target.scene);
    return true;
  }

  function clearConversation() {
    abortChat(false);
    conversationVersion += 1;
    sessionCreation = null;
    sessionId.value = '';
    messages.value = [];
  }

  /**
   * 初始化会话
   * @param scene 可选场景
   * @param force 是否强制重新初始化，即使 sessionId 已存在
   */
  async function initSession(scene?: string | AIScene, force = false) {
    if (force) clearConversation();
    if (sessionId.value) return true;
    if (sessionCreation) return sessionCreation;
    // validate scene param, prefer passed param if valid
    let sceneToUse = currentScene.value;
    if (scene && (ALLOWED_SCENES as readonly string[]).includes(String(scene))) {
      sceneToUse = scene as AIScene;
    }
    currentScene.value = sceneToUse;
    const version = conversationVersion;
    const ownerSession = userStore.sessionVersion;
    const pending = (async () => {
      try {
        const res = await createAISession({ scene: sceneToUse });
        if (version !== conversationVersion || ownerSession !== userStore.sessionVersion) return false;
        if (res.code === 200 && res.data) {
          sessionId.value = res.data.sessionId;
          if (res.data.welcomeMessage) {
            messages.value.push({
              id: Date.now() + Math.random(),
              type: 'ai',
              content: [{ type: 'text', text: res.data.welcomeMessage }],
              timestamp: Date.now(),
            });
            upsertHistoryEntry(sessionId.value, sceneToUse, messages.value);
          }
          return true;
        }
      } catch (e) {
        console.error('Failed to create AI session with scene:', sceneToUse, e);
      }
      return false;
    })().finally(() => {
      if (sessionCreation === pending) sessionCreation = null;
    });
    sessionCreation = pending;
    return pending;
  }

  /**
   * 添加用户消息到聊天记录
   * @param text 用户输入文本
   */
  function addUserMessage(text: string) {
    const newMessage: ChatMessage = {
      id: Date.now(),
      type: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    };
    messages.value.push(newMessage); // 访问 ref 值需要 .value
    return newMessage;
  }

  /**
   * 发送聊天消息并处理流式响应
   */
  async function sendChatMessage(text: string) {
    const version = conversationVersion;
    const ownerSession = userStore.sessionVersion;
    if (!sessionId.value && !(await initSession())) return;
    if (version !== conversationVersion || ownerSession !== userStore.sessionVersion) return;
    abortChat(false);

    // 先在 UI 上显示用户消息。
    addUserMessage(text);

    aiLoading.value = true;

    // 3. 创建一个空的 AI 消息占位符
    const aiMessageId = Date.now() + 1;
    const aiMessage = reactive<ChatMessage>({
      id: aiMessageId,
      type: 'ai',
      content: [{ type: 'text', text: '' }], // 默认先给一个空文本块，防止渲染报错
      timestamp: Date.now(),
      isStreaming: true,
    });
    messages.value.push(aiMessage);
    const stream: ChatStream = {
      sessionId: sessionId.value,
      scene: currentScene.value,
      messages: messages.value,
      aiMessage,
    };
    activeStream = stream;

    const pad2 = (n: number) => n.toString().padStart(2, '0');
    const pad3 = (n: number) => n.toString().padStart(3, '0');
    const formatLocalISOStringWithOffset = (d: Date) => {
      const year = d.getFullYear();
      const month = pad2(d.getMonth() + 1);
      const day = pad2(d.getDate());
      const hours = pad2(d.getHours());
      const minutes = pad2(d.getMinutes());
      const seconds = pad2(d.getSeconds());
      const millis = pad3(d.getMilliseconds());

      // getTimezoneOffset(): minutes behind UTC (e.g. China is -480)
      const tzOffsetMinutes = -d.getTimezoneOffset();
      const sign = tzOffsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(tzOffsetMinutes);
      const offH = pad2(Math.floor(abs / 60));
      const offM = pad2(abs % 60);

      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}${sign}${offH}:${offM}`;
    };

    const now = new Date();
    const payload: ChatRequest = {
      message: text,
      clientContext: {
        // 标准 ISO8601：本地时间 + 偏移（例如 2025-12-25T12:00:00.000+08:00）
        localTime: formatLocalISOStringWithOffset(now),
        tzOffsetMinutes: -now.getTimezoneOffset(),
        timeZone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined,
      },
    };

    let currentEvent = '';
    const appendText = (chunk: string) => {
      const lastSegment = aiMessage.content[aiMessage.content.length - 1];
      if (lastSegment?.type === 'text') lastSegment.text += chunk;
      else aiMessage.content.push({ type: 'text', text: chunk });
    };
    const finishStream = () => {
      if (activeStream !== stream) return;
      activeStream = null;
      aiLoading.value = false;
      aiMessage.isStreaming = false;
      upsertHistoryEntry(stream.sessionId, stream.scene, stream.messages);
    };

    const streamControl = USE_MOCK
      ? (() => {
          // 模拟流式回复。
          const mockResponse = `收到你的消息："${payload.message}"。这是一个模拟的流式回复。我可以帮你推荐菜品，或者制定饮食计划。`;
          const chunks = mockResponse.split('');
          let currentIndex = 0;
          const interval = setInterval(() => {
            if (activeStream !== stream) {
              clearInterval(interval);
              return;
            }
            if (currentIndex >= chunks.length) {
              clearInterval(interval);
              finishStream();
              return;
            }

            const chunkSize = Math.floor(Math.random() * 3) + 1;
            const chunkContent = chunks.slice(currentIndex, currentIndex + chunkSize).join('');
            currentIndex += chunkSize;

            appendText(chunkContent);
          }, 100);

          return {
            close: () => {
              clearInterval(interval);
            },
          };
        })()
      : streamAIChat(stream.sessionId, payload, {
          onEvent: (evt: string) => {
            if (activeStream !== stream) return;
            currentEvent = evt;
          },
          onMessage: (chunk: string) => {
            if (activeStream !== stream) return;
            if (currentEvent === 'text_chunk') appendText(chunk);
          },
          onJSON: json => {
            if (activeStream !== stream) return;
            
            if (currentEvent === 'new_block') {
              const segment = json as MessageSegment;
              if (segment && segment.type && segment.type !== 'text') {
                aiMessage.content.push(segment);
              }
            }
          },
          onError: err => {
            if (activeStream !== stream) return;
            console.error('Stream error', err);
            appendText(`\n[网络请求出错: ${err?.message || '请检查网络'}]`);
            finishStream();
          },
          onComplete: finishStream,
        });

    if (activeStream === stream) stream.close = streamControl.close;
  }

  /**
   * 提交用户对推荐菜品的反馈
   */
  async function submitFeedback(feedback: RecommendFeedbackRequest) {
    try {
      const res = await submitRecommendFeedback(feedback);
      if (res.code === 200) {
        uni.showToast({ title: '反馈成功', icon: 'success' });
      } else {
        uni.showToast({ title: res.message || '反馈失败', icon: 'error' });
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      uni.showToast({ title: '提交反馈失败', icon: 'error' });
    }
  }

  /**
   * 启动新的会话 (重置)
   */
  async function startNewSession(scene?: string | AIScene) {
    clearConversation();
    // 如果传入了场景则先设置
    if (scene) setScene(scene);
    await initSession(scene);
  }

  /**
   * 删除会话（从历史记录和本地存储中移除）
   */
  async function removeSession(session: string) {
    try {
      const sceneToKeep = currentScene.value;
      const ownerSession = userStore.sessionVersion;

      // 调用后端接口删除会话
      await deleteAISession(session);
      if (ownerSession !== userStore.sessionVersion) return false;
      const isDeletingCurrentSession = sessionId.value === session;
      if (isDeletingCurrentSession) clearConversation();
      // 从本地历史记录中删除
      const idx = historyEntries.value.findIndex(h => h.sessionId === session);
      if (idx >= 0) {
        historyEntries.value.splice(idx, 1);
        persistHistory();
      }

      // 如果删除的是当前会话：自动创建一个新会话并切换过去
      if (isDeletingCurrentSession) {
        await initSession(sceneToKeep);
      }
      
      return true;
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }

  watch(
    [() => userStore.sessionVersion, () => userStore.isLoggedIn ? userStore.userInfo?.id : null],
    ([, owner]) => {
      clearConversation();
      historyOwner = owner || null;
      historyEntries.value = [];
      setScene('general_chat');
      loadHistoryFromStorage();
    },
    { immediate: true, flush: 'sync' }
  );

  return {
    messages,
    aiLoading,
    sessionId,
    currentScene,
    historyEntries,
    initSession,
    setScene,
    addUserMessage,
    sendChatMessage,
    submitFeedback,
    startNewSession,
    loadSessionFromHistory,
    removeSession,
    abortChat,
  };
});
