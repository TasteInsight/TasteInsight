import { defineStore } from 'pinia';
import { ref, reactive } from 'vue'; 
import { createAISession, streamAIChat, submitRecommendFeedback } from '@/api/modules/ai';
import type { 
  ChatRequest, 
  RecommendFeedbackRequest, 
  ComponentDishCard,
  ComponentMealPlanDraft,
  ComponentCanteenCard,
  ComponentWindowCard
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

// 转换为 Pinia Setup Store
export const useChatStore = defineStore('ai-chat', () => {
  // === Constants ===
  // 最大历史记录条数：限制存储大小，避免本地存储过大影响性能
  const MAX_HISTORY_ENTRIES = 20;

  // === State (使用 ref 声明响应式状态) ===
  const messages = ref<ChatMessage[]>([]);
  const aiLoading = ref(false); // AI 正在回复
  const sessionId = ref<string>('');
  const historyEntries = ref<ChatHistoryEntry[]>([]);
  const currentStreamAbort = ref<(() => void) | null>(null);
  const HISTORY_STORAGE_KEY = 'ai-chat-history';

  // 载入本地历史
  loadHistoryFromStorage();

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

  function abortChat() {
    if (currentStreamAbort.value) {
      currentStreamAbort.value();
      currentStreamAbort.value = null;
    }
    aiLoading.value = false;
    // 如果最后一条消息还在 streaming，将其标记为结束
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.isStreaming = false;
    }
  }

  // === History helpers ===
  function persistHistory() {
    try {
      uni.setStorageSync(HISTORY_STORAGE_KEY, historyEntries.value);
    } catch (e) {
      console.error('persistHistory failed', e);
    }
  }

  function loadHistoryFromStorage() {
    try {
      const cached = uni.getStorageSync(HISTORY_STORAGE_KEY);
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
    const target = historyEntries.value.find(h => h.sessionId === session);
    if (!target) return false;
    messages.value = cloneMessages(target.messages);
    sessionId.value = target.sessionId;
    setScene(target.scene);
    return true;
  }

  /**
   * 初始化会话
   * @param scene 可选场景
   * @param force 是否强制重新初始化，即使 sessionId 已存在
   */
  async function initSession(scene?: string | AIScene, force = false) {
    if (sessionId.value && !force) return;
    // 如果强制重新初始化，清除现有 sessionId
    if (force) {
      sessionId.value = '';
    }
    // validate scene param, prefer passed param if valid
    let sceneToUse = currentScene.value;
    if (scene && (ALLOWED_SCENES as readonly string[]).includes(String(scene))) {
      sceneToUse = scene as AIScene;
    }
    currentScene.value = sceneToUse;
    try {
      const res = await createAISession({ scene: sceneToUse });
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
      }
    } catch (e) {
      console.error('Failed to create AI session with scene:', sceneToUse, e);
    }
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
    // 0. 中断上一次可能的请求
    abortChat();

    // 1. 确保会话已初始化
    if (!sessionId.value) await initSession();
    
    // 2. 【核心修复】先在 UI 上显示用户的消息
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

    const payload: ChatRequest = {
      message: text,
      clientContext: {
        localTime: new Date().toLocaleTimeString(),
      }
    };

    let currentEvent = '';

    const streamControl = streamAIChat(sessionId.value, payload, {
      onEvent: (evt) => {
        currentEvent = evt;
      },
      // 处理文本流
      onMessage: (chunk) => {
        // 只有当事件明确是 text_chunk 时才拼接文本
        if (currentEvent === 'text_chunk') {
             const contentArr = aiMessage.content;
             const lastSegment = contentArr[contentArr.length - 1];
             
             // 如果最后一个块是文本，则追加
             if (lastSegment && lastSegment.type === 'text') {
               lastSegment.text += chunk;
             } else {
               // 否则（比如上一个是卡片），新建一个文本块
               contentArr.push({ type: 'text', text: chunk });
             }
        }
      },
      // 处理组件流 (new_block)
      onJSON: (json) => {
        if (currentEvent === 'new_block') {
             // 简单的类型断言，实际项目中可以加 Schema 校验
             const segment = json as MessageSegment;
             if (segment && segment.type && segment.type !== 'text') {
               aiMessage.content.push(segment);
             }
        }
      },
      onError: (err) => {
        console.error('Stream error', err);
        const contentArr = aiMessage.content;
        const lastSegment = contentArr[contentArr.length - 1];
        
        const errorText = `\n[网络请求出错: ${err?.message || '请检查网络'}]`;
        if (lastSegment && lastSegment.type === 'text') {
            lastSegment.text += errorText;
        } else {
            contentArr.push({ type: 'text', text: errorText });
        }
        
        aiLoading.value = false;
        aiMessage.isStreaming = false;
        currentStreamAbort.value = null;
      },
      onComplete: () => {
        aiLoading.value = false;
        aiMessage.isStreaming = false;
        upsertHistoryEntry(sessionId.value, currentScene.value, messages.value);
        currentStreamAbort.value = null;
      }
    });

    // 保存中断控制器
    if (streamControl && streamControl.close) {
      currentStreamAbort.value = streamControl.close;
    }
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
      console.error("Feedback submission error:", error);
      uni.showToast({ title: '提交反馈失败', icon: 'error' });
    }
  }

  /**
   * 启动新的会话 (重置)
   */
  function startNewSession(scene?: string) {
    abortChat(); // 停止当前可能的生成
    messages.value = [];
    sessionId.value = '';
    // 如果传入了场景则先设置
    if (scene) setScene(scene);
    initSession(scene);
  }
  
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
    abortChat,
  };
});