// @/store/modules/use-chat-store.ts
import { defineStore } from 'pinia';
import { getAIRecommendation, submitRecommendFeedback } from '@/api/modules/ai';
import type { 
  AIRecommendRequest, 
  RecommendationItem, 
  RecommendFeedbackRequest,
  Dish // 引入 Dish 类型用于推荐项展示
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

export const useChatStore = defineStore('ai-chat', {
  state: () => ({
    messages: [] as ChatMessage[],
    aiLoading: false, // AI 正在回复
    currentSessionId: Date.now(), // 简单的会话ID
  }),

  actions: {
    /**
     * 添加用户消息到聊天记录
     * @param text 用户输入文本
     */
    addUserMessage(text: string) {
      const newMessage: ChatMessage = {
        id: Date.now() + Math.random(),
        type: 'user',
        text: text,
        timestamp: Date.now(),
      };
      this.messages.push(newMessage);
      return newMessage;
    },

    /**
     * 请求 AI 推荐并添加 AI 回复
     * @param requestData AI请求数据，例如用户输入、偏好
     */
    async fetchAIResponse(userText: string, requestData: AIRecommendRequest = {}) {
      this.aiLoading = true;
      
      // 1. 模拟 AI 思考中的消息
      const loadingMessage: ChatMessage = {
        id: Date.now() + Math.random(),
        type: 'ai',
        text: 'AI 正在思考中...',
        timestamp: Date.now(),
      };
      this.messages.push(loadingMessage);

      try {
        const res = await getAIRecommendation(requestData);

        // 2. 移除加载消息
        const loadingIndex = this.messages.findIndex(m => m.id === loadingMessage.id);
        if (loadingIndex !== -1) {
            this.messages.splice(loadingIndex, 1);
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
          this.messages.push(aiResponse);
        } else {
          throw new Error(res.message || 'AI推荐服务异常');
        }
      } catch (error) {
        // 4. 处理错误，更新加载消息或添加错误消息
        const loadingIndex = this.messages.findIndex(m => m.id === loadingMessage.id);
        if (loadingIndex !== -1) {
            this.messages.splice(loadingIndex, 1, {
                ...loadingMessage,
                text: 'AI服务请求失败，请稍后再试。',
                loading: false,
            } as ChatMessage);
        } else {
            this.messages.push({
                id: Date.now() + Math.random(),
                type: 'ai',
                text: 'AI服务请求失败，请稍后再试。',
                timestamp: Date.now(),
            });
        }
        console.error("AI Recommendation Error:", error);
      } finally {
        this.aiLoading = false;
      }
    },

    /**
     * 提交用户对推荐菜品的反馈
     */
    async submitFeedback(feedback: RecommendFeedbackRequest) {
      // 可以在此处查找并更新特定消息的 isFeedbackLoading 状态 (如果需要)
      // 实际应用中，反馈通常是独立的，不需影响聊天气泡状态
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
    },

    /**
     * 启动新的会话
     */
    startNewSession() {
      this.messages = [];
      this.currentSessionId = Date.now();
      // 可以选择性地添加一个欢迎消息
      this.messages.push({
          id: Date.now(),
          type: 'ai',
          text: '您好！我是您的智能美食助手，请问今天想吃什么呢？',
          timestamp: Date.now(),
      });
    }
  },
});