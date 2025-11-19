<!-- @/pages/planning/index.vue -->
<template>
  <div class="app-page">
    <div class="content-container">
      <!-- Tab 切换 -->
      <div class="flex py-4 border-b border-gray-100 justify-center">
        <div 
          class="mx-4 cursor-pointer" 
          :class="activeTab === 'current' ? 'font-bold text-purple-700' : 'text-gray-500'"
          @click="activeTab = 'current'">
          现有规划
        </div>
        <div 
          class="mx-4 cursor-pointer" 
          :class="activeTab === 'history' ? 'font-bold text-purple-700' : 'text-gray-500'"
          @click="activeTab = 'history'">
          历史记录
        </div>
      </div>

      <!-- 内容区 -->
      <div v-if="loading" class="text-center py-10 text-gray-500">正在加载规划...</div>
      <div v-else-if="error" class="text-center py-10 text-red-500">{{ error }}</div>
      
      <div v-else>
        <!-- 现有规划 -->
        <div v-show="activeTab === 'current'">
          <div v-if="currentPlans.length > 0">
            <PlanCard v-for="plan in currentPlans" :key="plan.id" :plan="plan" />
          </div>
          <div v-else class="text-center py-10 text-gray-500">暂无现有规划</div>
        </div>

        <!-- 历史记录 -->
        <div v-show="activeTab === 'history'">
          <div v-if="historyPlans.length > 0">
            <PlanCard v-for="plan in historyPlans" :key="plan.id" :plan="plan" is-history />
          </div>
          <div v-else class="text-center py-10 text-gray-500">暂无历史记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PlanCard from './components/PlanCard.vue';
import { useMenuPlanning } from './composables/use-menu-planning';

const activeTab = ref('current');
const { loading, error, currentPlans, historyPlans } = useMenuPlanning();
</script>