import { defineStore } from 'pinia';
import { ref } from 'vue'; 
import { getAIRecommendation, submitRecommendFeedback } from '@/api/modules/ai';
import type { 
  AIRecommendRequest, 
  RecommendationItem, 
  RecommendFeedbackRequest,
  Dish 
} from '@/types/api';

// 内部消息类型定义
export interface ChatMessage {
  id: number;
  type: 'user' | 'ai'; // 消息发送方
  text: string; // 消息内容
  timestamp: number;
  recommendations?: RecommendationItem[]; // 仅在 type: 'ai' 时可能存在
  isFeedbackLoading?: boolean; // 反馈提交状态
}

// 转换为 Pinia Setup Store
export const useChatStore = defineStore('ai-chat', () => {
  // === State (使用 ref 声明响应式状态) ===
  const messages = ref<ChatMessage[]>([]);
  const aiLoading = ref(false); // AI 正在回复
  const currentSessionId = ref(Date.now()); // 简单的会话ID

  // === Actions (声明为普通函数) ===

  /**
   * 添加用户消息到聊天记录
   * @param text 用户输入文本
   */
  function addUserMessage(text: string) {
    const newMessage: ChatMessage = {
      id: Date.now() + Math.random(),
      type: 'user',
      text: text,
      timestamp: Date.now(),
    };
    messages.value.push(newMessage); // 访问 ref 值需要 .value
    return newMessage;
  }

  /**
   * 请求 AI 推荐并添加 AI 回复
   * @param requestData AI请求数据，例如用户输入、偏好
   */
  async function fetchAIResponse(userText: string, requestData: AIRecommendRequest = {}) {
    aiLoading.value = true; // 访问 ref 值需要 .value
    
    // 1. 模拟 AI 思考中的消息
    const loadingMessage: ChatMessage = {
      id: Date.now() + Math.random(),
      type: 'ai',
      text: 'AI 正在思考中...',
      timestamp: Date.now(),
    };
    messages.value.push(loadingMessage); // 访问 ref 值需要 .value

    try {
      const res = await getAIRecommendation(requestData);

      // 2. 移除加载消息
      const loadingIndex = messages.value.findIndex(m => m.id === loadingMessage.id);
      if (loadingIndex !== -1) {
          messages.value.splice(loadingIndex, 1);
      }

      if (res.code === 200 && res.data) {
        // 3. 构建最终回复消息
        const recommendations = res.data.recommendations || [];
        const aiResponse: ChatMessage = {
          id: Date.now() + Math.random(),
          type: 'ai',
          text: recommendations.length > 0 ? '根据您的偏好，为您推荐以下菜品：' : '抱歉，当前没有合适的推荐。',
          timestamp: Date.now(),
          recommendations: recommendations,
        };
        messages.value.push(aiResponse);
      } else {
        throw new Error(res.message || 'AI推荐服务异常');
      }
    } catch (error) {
      // 4. 处理错误，更新加载消息或添加错误消息
      const loadingIndex = messages.value.findIndex(m => m.id === loadingMessage.id);
      if (loadingIndex !== -1) {
          // 替换加载消息为错误提示
          // 注意: 原Options Store中的 `loading: false` 属性在 ChatMessage 接口中不存在，已移除。
          messages.value.splice(loadingIndex, 1, {
              ...loadingMessage,
              text: 'AI服务请求失败，请稍后再试。',
          } as ChatMessage);
      } else {
          messages.value.push({
              id: Date.now() + Math.random(),
              type: 'ai',
              text: 'AI服务请求失败，请稍后再试。',
              timestamp: Date.now(),
          });
      }
      console.error("AI Recommendation Error:", error);
    } finally {
      aiLoading.value = false;
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
   * 启动新的会话
   */
  function startNewSession() {
    messages.value = [];
    currentSessionId.value = Date.now();
    // 可以选择性地添加一个欢迎消息
    messages.value.push({
        id: Date.now(),
        type: 'ai',
        text: '您好！我是您的智能美食助手，请问今天想吃什么呢？',
        timestamp: Date.now(),
    });
  }
  
  // Setup Store 必须返回所有 state, getters 和 actions
  return {
    // State
    messages,
    aiLoading,
    currentSessionId,

    // Actions
    addUserMessage,
    fetchAIResponse,
    submitFeedback,
    startNewSession,
  };
});