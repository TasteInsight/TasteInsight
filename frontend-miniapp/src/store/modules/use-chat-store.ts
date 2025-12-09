import { defineStore } from 'pinia';
import { ref } from 'vue'; 
import { createAISession, streamAIChat, submitRecommendFeedback } from '@/api/modules/ai';
import type { 
  ChatRequest, 
  RecommendFeedbackRequest, 
  ComponentDishCard,
  ComponentMealPlanDraft,
  ComponentCanteenCard
} from '@/types/api';

// 消息段类型
export type MessageSegment = 
  | { type: 'text'; text: string }
  | { type: 'card_dish'; data: ComponentDishCard[] }
  | { type: 'card_plan'; data: ComponentMealPlanDraft[] }
  | { type: 'card_canteen'; data: ComponentCanteenCard[] };

// 内部消息类型定义
export interface ChatMessage {
  id: number;
  type: 'user' | 'ai'; // 消息发送方
  content: MessageSegment[]; // 支持混排
  timestamp: number;
  isStreaming?: boolean; // 是否正在流式接收中
}// 转换为 Pinia Setup Store
export const useChatStore = defineStore('ai-chat', () => {
  // === State (使用 ref 声明响应式状态) ===
  const messages = ref<ChatMessage[]>([]);
  const aiLoading = ref(false); // AI 正在回复
  const sessionId = ref<string>('');

  // === Actions (声明为普通函数) ===

  /**
   * 初始化会话
   */
  async function initSession() {
    if (sessionId.value) return;
    try {
      const res = await createAISession({ scene: 'general_chat' });
      if (res.code === 200 && res.data) {
        sessionId.value = res.data.sessionId;
        if (res.data.welcomeMessage) {
          messages.value.push({
            id: Date.now(),
            type: 'ai',
            content: [{ type: 'text', text: res.data.welcomeMessage }],
            timestamp: Date.now(),
          });
        }
      }
    } catch (e) {
      console.error('Failed to create AI session', e);
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
    if (!sessionId.value) await initSession();
    
    aiLoading.value = true;
    
    // 创建一个空的 AI 消息用于流式更新
    const aiMessageId = Date.now() + 1;
    const aiMessage = ref<ChatMessage>({
      id: aiMessageId,
      type: 'ai',
      content: [{ type: 'text', text: '' }], // 初始为空文本
      timestamp: Date.now(),
      isStreaming: true,
    });
    messages.value.push(aiMessage.value);

    const payload: ChatRequest = {
      message: text,
      clientContext: {
        localTime: new Date().toLocaleTimeString(),
      }
    };

    let currentEvent = '';

    streamAIChat(sessionId.value, payload, {
      onEvent: (evt) => {
        currentEvent = evt;
      },
      onMessage: (chunk) => {
        if (currentEvent === 'text_chunk') {
             const lastSegment = aiMessage.value.content[aiMessage.value.content.length - 1];
             if (lastSegment && lastSegment.type === 'text') {
               lastSegment.text += chunk;
             } else {
               aiMessage.value.content.push({ type: 'text', text: chunk });
             }
        }
      },
      onJSON: (json) => {
        if (currentEvent === 'new_block') {
             aiMessage.value.content.push(json as MessageSegment);
        }
      },
      onError: (err) => {
        console.error('Stream error', err);
        const lastSegment = aiMessage.value.content[aiMessage.value.content.length - 1];
        if (lastSegment && lastSegment.type === 'text') {
            lastSegment.text += '\n[网络错误，请重试]';
        } else {
            aiMessage.value.content.push({ type: 'text', text: '\n[网络错误，请重试]' });
        }
        aiLoading.value = false;
        aiMessage.value.isStreaming = false;
      },
      onComplete: () => {
        aiLoading.value = false;
        aiMessage.value.isStreaming = false;
      }
    });
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
  function startNewSession() {
    messages.value = [];
    sessionId.value = '';
    initSession();
  }
  
  return {
    messages,
    aiLoading,
    sessionId,
    initSession,
    addUserMessage,
    sendChatMessage,
    submitFeedback,
    startNewSession,
  };
});