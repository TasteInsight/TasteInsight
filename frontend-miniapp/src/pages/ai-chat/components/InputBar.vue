<template>
  <view class="message-input-container">
    <input 
      class="input-field" 
      placeholder="请问今天吃什么？" 
      v-model="inputText" 
      :disabled="aiLoading"
      @confirm="sendMessage" 
    />
    <view 
      class="send-btn" 
      :class="{ 'disabled': !inputText.trim() || aiLoading }"
      @click="sendMessage"
    >
      <text class="iconify text-white" data-icon="mdi:send" data-width="16"></text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { computed }   from 'vue';

const chatStore = useChatStore();
const inputText = ref('');

// 禁用发送按钮的计算属性
const aiLoading = computed(() => chatStore.aiLoading);

const sendMessage = async () => {
  const text = inputText.value.trim();
  if (!text || aiLoading.value) return;

  // 1. 添加用户消息
  chatStore.addUserMessage(text);
  
  // 2. 清空输入框
  inputText.value = '';

  // 3. 请求 AI 推荐 (可以传递用户输入作为 requestData 的一部分，这里简化)
  // 实际项目中，需要根据用户输入解析意图，并构建 AIRecommendRequest
  await chatStore.fetchAIResponse(text, {}); 
};
</script>

<style scoped lang="scss">

.message-input-container {
  /* 模拟 prototype .message-input 样式 */
  position: absolute; 
  bottom: calc(80px + 12px); /* 底部导航栏高度 + 间距 */
  left: 16px;
  right: 16px;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: white;
  border-radius: 30px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  z-index: 10; 
}

.input-field {
  flex: 1;
  height: 100%;
  font-size: 16px;
}

.send-btn {
  width: 32px; /* 32px = w-8 h-8 */
  height: 32px;
  border-radius: 50%;
  background: #82318E; /* purple-bg */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.send-btn.disabled {
    opacity: 0.5;
    pointer-events: none;
}
</style>