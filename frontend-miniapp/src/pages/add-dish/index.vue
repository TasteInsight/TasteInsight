<template>
  <div class="min-h-screen bg-gray-50 pb-32">
    <!-- 顶部标题 -->
    <div class="bg-white px-4 py-4 mb-2">
      <div class="text-lg font-semibold text-gray-800">添加新菜品</div>
      <div class="text-sm text-gray-500 mt-1">帮助我们完善菜品信息</div>
    </div>

    <!-- 表单内容 -->
    <div class="space-y-2">
      <!-- 基本信息 -->
      <div class="bg-white px-4 py-4">
        <div class="text-sm font-semibold text-gray-700 mb-3">基本信息</div>
        
        <!-- 菜品名称 -->
        <div class="mb-4">
          <div class="text-sm text-gray-600 mb-1">
            菜品名称 <span class="text-red-500">*</span>
          </div>
          <input
            v-model="formData.name"
            type="text"
            placeholder="请输入菜品名称"
            class="w-full h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none"
          />
        </div>

        <!-- 价格 -->
        <div class="mb-4">
          <div class="text-sm text-gray-600 mb-1">
            价格 <span class="text-red-500">*</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center flex-1">
              <span class="text-gray-500 mr-2">￥</span>
              <input
                v-model.number="formData.price"
                type="digit"
                placeholder="0.00"
                class="flex-1 h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none"
              />
            </div>
            <div class="flex items-center">
              <span class="text-gray-400 text-sm mr-2">/</span>
              <input
                v-model="formData.priceUnit"
                type="text"
                placeholder="两"
                class="w-16 h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none text-center"
              />
            </div>
          </div>
          <div class="text-xs text-gray-400 mt-1">价格单位选填，如：两、份、碗等</div>
        </div>

        <!-- 描述 -->
        <div>
          <div class="text-sm text-gray-600 mb-1">菜品描述</div>
          <textarea
            v-model="formData.description"
            placeholder="请输入菜品描述（选填）"
            class="w-full h-20 px-3 py-2 bg-gray-50 rounded-lg text-sm border-none outline-none resize-none"
          />
        </div>
      </div>

      <!-- 位置信息 -->
      <div class="bg-white px-4 py-4">
        <div class="text-sm font-semibold text-gray-700 mb-3">位置信息</div>
        
        <!-- 选择食堂 -->
        <div class="mb-4">
          <div class="text-sm text-gray-600 mb-2">
            所在食堂 <span class="text-red-500">*</span>
          </div>
          <div v-if="loading" class="text-gray-400 text-sm">加载中...</div>
          <div v-else class="grid grid-cols-3 gap-2">
            <button
              v-for="canteen in canteenList"
              :key="canteen.id"
              class="w-full py-2 px-3 rounded-lg text-sm transition-colors text-left truncate"
              :class="selectedCanteen?.id === canteen.id 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600'"
              @click="selectCanteen(canteen)"
            >
              {{ canteen.name }}
            </button>
          </div>
        </div>

        <!-- 选择窗口 -->
        <div v-if="windowList.length > 0">
          <div class="text-sm text-gray-600 mb-2">
            所在窗口 <span class="text-red-500">*</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="window in windowList"
              :key="window.id"
              class="w-full py-2 px-3 rounded-lg text-sm transition-colors text-left truncate"
              :class="formData.windowName === window.name 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600'"
              @click="selectWindow(window)"
            >
              {{ window.name }}
              <span v-if="window.floor?.level" class="text-xs opacity-70">
                ({{ window.floor.level }}楼)
              </span>
            </button>
          </div>
        </div>
        
        <!-- 手动输入窗口（当没有窗口列表时） -->
        <div v-else-if="selectedCanteen">
          <div class="text-sm text-gray-600 mb-1">
            窗口名称 <span class="text-red-500">*</span>
          </div>
          <input
            v-model="formData.windowName"
            type="text"
            placeholder="请输入窗口名称"
            class="w-full h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none mb-3"
          />
          <div class="text-sm text-gray-600 mb-1">窗口号</div>
          <input
            v-model="formData.windowNumber"
            type="text"
            placeholder="请输入窗口号（选填）"
            class="w-full h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none"
          />
        </div>
      </div>

      <!-- 供应时段 -->
      <div class="bg-white px-4 py-4">
        <div class="text-sm font-semibold text-gray-700 mb-3">
          供应时段 <span class="text-red-500">*</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in mealTimeOptions"
            :key="option.value"
            class="px-4 py-2 rounded-full text-sm transition-colors"
            :class="formData.availableMealTime.includes(option.value as any) 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-100 text-gray-600'"
            @click="toggleMealTime(option.value as any)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- 图片上传 -->
      <div class="bg-white px-4 py-4">
        <div class="text-sm font-semibold text-gray-700 mb-3">菜品图片</div>
        <div class="flex flex-wrap gap-2">
          <!-- 已上传图片 -->
          <div 
            v-for="(image, index) in formData.images" 
            :key="index"
            class="relative w-20 h-20"
          >
            <image :src="image" class="w-full h-full rounded-lg object-cover" mode="aspectFill" />
            <button 
              class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              @click="removeImage(index)"
            >
              ×
            </button>
          </div>
          
          <!-- 添加按钮 -->
          <button 
            v-if="!formData.images || formData.images.length < 9"
            class="w-20 h-20 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400"
            @click="chooseImages"
          >
            <text class="iconfont icon-plus text-2xl"></text>
            <span class="text-xs mt-1">添加图片</span>
          </button>
        </div>
        <div class="text-xs text-gray-400 mt-2">最多上传9张图片</div>
      </div>

      <!-- 标签 -->
      <div class="bg-white px-4 py-4">
        <div class="text-sm font-semibold text-gray-700 mb-3">菜品标签</div>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="tag in commonTags"
            :key="tag"
            class="w-full px-3 py-1.5 rounded-full text-sm transition-colors text-left truncate"
            :class="formData.tags?.includes(tag) 
              ? 'bg-blue-100 text-blue-600' 
              : 'bg-gray-100 text-gray-600'"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <input
            v-model="customTagInput"
            type="text"
            placeholder="输入自定义标签"
            class="flex-1 h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none"
            @confirm="addCustomTag"
          />
          <button
            class="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm"
            @click="addCustomTag"
          >
            添加
          </button>
        </div>
        <div v-if="customTags.length" class="mt-3 flex flex-wrap gap-2">
          <view
            v-for="tag in customTags"
            :key="tag"
            class="px-3 py-1.5 rounded-full text-sm bg-blue-500 text-white flex items-center gap-1"
          >
            <text>{{ tag }}</text>
            <text class="text-xs opacity-80" @tap="removeCustomTag(tag)">×</text>
          </view>
        </div>
      </div>

      <!-- 过敏原 -->
      <div class="bg-white px-4 py-4">
        <div class="text-sm font-semibold text-gray-700 mb-3">过敏原信息</div>
        <div class="text-xs text-gray-500 mb-2">选择该菜品可能含有的过敏原</div>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="allergen in commonAllergens"
            :key="allergen"
            class="w-full px-3 py-1.5 rounded-full text-sm transition-colors text-left truncate"
            :class="formData.allergens?.includes(allergen) 
              ? 'bg-orange-100 text-orange-600' 
              : 'bg-gray-100 text-gray-600'"
            @click="toggleAllergen(allergen)"
          >
            {{ allergen }}
          </button>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <input
            v-model="customAllergenInput"
            type="text"
            placeholder="输入自定义过敏原"
            class="flex-1 h-10 px-3 bg-gray-50 rounded-lg text-sm border-none outline-none"
            @confirm="addCustomAllergen"
          />
          <button
            class="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm"
            @click="addCustomAllergen"
          >
            添加
          </button>
        </div>
        <div v-if="customAllergens.length" class="mt-3 flex flex-wrap gap-2">
          <view
            v-for="allergen in customAllergens"
            :key="allergen"
            class="px-3 py-1.5 rounded-full text-sm bg-orange-500 text-white flex items-center gap-1"
          >
            <text>{{ allergen }}</text>
            <text class="text-xs opacity-80" @tap="removeCustomAllergen(allergen)">×</text>
          </view>
        </div>
      </div>
    </div>

    <!-- 底部提交按钮 -->
    <div
      class="fixed bottom-0 left-0 right-0 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-[2000]"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
    >
      <button
        class="w-full h-12 rounded-lg text-white font-semibold transition-colors"
        :class="isFormValid && !submitting 
          ? 'bg-blue-500 active:bg-blue-600' 
          : 'bg-gray-300 cursor-not-allowed'"
        :disabled="!isFormValid || submitting"
        @click="submitForm"
      >
        {{ submitting ? '提交中...' : '提交菜品' }}
      </button>
      <div class="text-xs text-gray-400 text-center mt-2">
        提交后将由管理员审核
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAddDish } from './composables/use-add-dish';

const {
  formData,
  canteenList,
  windowList,
  selectedCanteen,
  loading,
  submitting,
  isFormValid,
  mealTimeOptions,
  commonTags,
  commonAllergens,
  customTagInput,
  customAllergenInput,
  customTags,
  customAllergens,
  loadCanteenList,
  selectCanteen,
  selectWindow,
  toggleMealTime,
  toggleTag,
  addCustomTag,
  removeCustomTag,
  toggleAllergen,
  addCustomAllergen,
  removeCustomAllergen,
  chooseImages,
  removeImage,
  submitForm,
} = useAddDish();

// 获取URL参数中的关键词
onMounted(() => {
  loadCanteenList();
  
  // 获取传递的关键词参数作为默认菜品名
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = (currentPage as any)?.options || {};
  
  if (options.keyword) {
    formData.name = decodeURIComponent(options.keyword);
  }
});
</script>

<style scoped>
input, textarea {
  border: none;
  outline: none;
}

button {
  border: none;
  outline: none;
}

button::after {
  border: none;
}
</style>
