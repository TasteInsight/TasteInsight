<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen">
        <div class="bg-white rounded-lg container-shadow p-8 relative">
          <!-- 关闭按钮 -->
          <button
            @click="goBack"
            class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition p-2"
            title="关闭"
          >
            <span class="iconify text-2xl" data-icon="carbon:close"></span>
          </button>
          
          <Header 
            title="菜品审核详情" 
            description="查看菜品信息并决定是否通过审核"
            header-icon="carbon:task-approved"
          />
          
          <div class="space-y-6 mt-6">
            <div class="grid grid-cols-2 gap-6">
              <!-- 左侧列 -->
              <div>
                <!-- 食堂信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">食堂信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.canteen || '未填写' }}
                      </div>
                    </div>
                    <div>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.floor || '未填写' }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 窗口信息 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">窗口名称/编号</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {{ dishData.window || '未填写' }}
                  </div>
                </div>
                
                <!-- 菜品名称 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品名称</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700 font-medium">
                    {{ dishData.name || '未填写' }}
                  </div>
                </div>
                
                <!-- 菜品描述 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品描述</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700 min-h-[100px] max-h-[200px] overflow-y-auto">
                    {{ dishData.description || '未填写' }}
                  </div>
                </div>
                
                <!-- 菜品图片 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">菜品图片</label>
                  <div class="border-2 border-dashed rounded-lg h-48 flex items-center justify-center bg-gray-50 overflow-hidden">
                    <img 
                      v-if="dishData.image || dishData.imageUrl" 
                      :src="dishData.image || dishData.imageUrl" 
                      alt="菜品图片"
                      class="w-full h-full object-cover"
                    >
                    <div v-else class="text-center p-6">
                      <span class="iconify text-4xl text-gray-400 mx-auto" data-icon="bi:image"></span>
                      <div class="mt-2 text-gray-500">暂无图片</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 右侧列 -->
              <div>
                <!-- 菜品子项 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品子项</label>
                  <div class="space-y-2">
                    <div 
                      v-for="(item, index) in dishData.subItems" 
                      :key="index"
                      class="flex items-center justify-between px-4 py-2 border rounded-lg bg-gray-50"
                    >
                      <span class="text-gray-700">{{ item.name || '未命名' }}</span>
                      <span class="text-tsinghua-purple font-medium">{{ item.price ? `¥${item.price}` : '未定价' }}</span>
                    </div>
                    <div v-if="!dishData.subItems || dishData.subItems.length === 0" class="px-4 py-2 border rounded-lg bg-gray-50 text-gray-500">
                      暂无子项
                    </div>
                  </div>
                </div>
                
                <!-- 供应信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">菜系分类</label>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.cuisine || '未填写' }}
                      </div>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">主要口味</label>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.taste || '未填写' }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 供应时间 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应时间</label>
                  <div class="space-y-2">
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.breakfast ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.breakfast ? 'text-gray-700' : 'text-gray-400'">早餐（6:30-9:30）</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.lunch ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.lunch ? 'text-gray-700' : 'text-gray-400'">午餐（10:30-13:30）</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.dinner ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.dinner ? 'text-gray-700' : 'text-gray-400'">晚餐（16:30-19:30）</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.night ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.night ? 'text-gray-700' : 'text-gray-400'">夜宵（19:40-22:00）</span>
                    </div>
                  </div>
                </div>
                
                <!-- 供应季节 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应季节</label>
                  <div class="grid grid-cols-4 gap-2">
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.seasons?.spring ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.seasons?.spring ? 'text-gray-700' : 'text-gray-400'">春季</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.seasons?.summer ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.seasons?.summer ? 'text-gray-700' : 'text-gray-400'">夏季</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.seasons?.autumn ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.seasons?.autumn ? 'text-gray-700' : 'text-gray-400'">秋季</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.seasons?.winter ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.seasons?.winter ? 'text-gray-700' : 'text-gray-400'">冬季</span>
                    </div>
                  </div>
                </div>
                
                <!-- 过敏原 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">过敏原</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {{ dishData.allergens || '未填写' }}
                  </div>
                </div>
                
                <!-- 原辅料 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">原辅料</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {{ dishData.ingredients || '未填写' }}
                  </div>
                </div>
                
                <!-- 提交信息 -->
                <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div class="text-sm text-gray-600 mb-2">提交信息</div>
                  <div class="space-y-1 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">提交人：</span>
                      <span class="text-gray-800 font-medium">{{ dishData.submitter || '未知' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">提交时间：</span>
                      <span class="text-gray-800">{{ dishData.submitDate || '' }} {{ dishData.submitTime || '' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">当前状态：</span>
                      <span 
                        class="px-2 py-1 rounded-full text-xs font-medium"
                        :class="statusClasses[dishData.status]"
                      >
                        {{ statusText[dishData.status] }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 审核操作按钮 -->
            <div class="flex space-x-4 pt-6 border-t border-gray-200">
              <button 
                type="button" 
                class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center"
                @click="approveDish"
              >
                <span class="iconify mr-2" data-icon="carbon:checkmark-filled"></span>
                批准通过
              </button>
              <button 
                type="button" 
                class="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center"
                @click="rejectDish"
              >
                <span class="iconify mr-2" data-icon="carbon:close-filled"></span>
                拒绝审核
              </button>
              <button 
                type="button" 
                class="flex-1 px-6 py-3 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition duration-200 flex items-center justify-center"
                @click="revokeApproval"
              >
                <span class="iconify mr-2" data-icon="carbon:reset"></span>
                撤销审核结果
              </button>
              <button 
                type="button" 
                class="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                @click="goBack"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Sidebar from '@/components/Layout/Sidebar.vue';
import Header from '@/components/Layout/Header.vue';

export default {
  name: 'ReviewDishDetail',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const dishId = route.params.id
    
    const dishData = reactive({
      id: '',
      name: '',
      canteen: '',
      floor: '',
      window: '',
      description: '',
      allergens: '',
      ingredients: '',
      image: '',
      imageUrl: '',
      subItems: [],
      cuisine: '',
      taste: '',
      servingTime: {
        breakfast: false,
        lunch: true,
        dinner: true,
        night: true
      },
      seasons: {
        spring: true,
        summer: true,
        autumn: true,
        winter: true
      },
      submitter: '',
      submitDate: '',
      submitTime: '',
      status: 'pending'
    })
    
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    
    const statusText = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝'
    }
    
    // 加载菜品信息
    const loadDishData = () => {
      // 模拟数据 - 实际应该从 API 或 store 获取
      const sampleDishes = [
        {
          id: 1,
          name: '水煮肉片',
          canteen: '观畴园',
          floor: '二层',
          window: '自选菜',
          location: '观畴园-二层-自选菜',
          submitDate: '2025-10-20',
          submitTime: '14:23:45',
          submitter: '张师傅',
          status: 'pending',
          image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg',
          description: '经典川菜，选用优质猪肉，配以豆芽、辣椒等配菜，麻辣鲜香',
          allergens: '无',
          ingredients: '猪肉、豆芽、辣椒、花椒、蒜、姜',
          cuisine: '川菜',
          taste: '麻辣',
          subItems: [
            { name: '小份', price: '15' },
            { name: '大份', price: '20' }
          ],
          servingTime: {
            breakfast: false,
            lunch: true,
            dinner: true,
            night: false
          },
          seasons: {
            spring: true,
            summer: true,
            autumn: true,
            winter: true
          }
        },
        {
          id: 2,
          name: '辛拉面',
          canteen: '桃李园',
          floor: '一层',
          window: '韩国风味',
          location: '桃李园-一层-韩国风味',
          submitDate: '2025-10-20',
          submitTime: '11:15:32',
          submitter: 'NoraexX',
          status: 'approved',
          image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
        },
        {
          id: 3,
          name: '宜宾燃面',
          canteen: '清芬园',
          floor: '一层',
          window: '面食窗口',
          location: '清芬园一层',
          submitDate: '2025-10-20',
          submitTime: '16:45:21',
          submitter: '某不愿透露姓名的曾姓男子',
          status: 'rejected',
          image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
        },
        {
          id: 4,
          name: '菠萝咕咾肉',
          canteen: '观畴园',
          floor: '二层',
          window: '自选菜',
          location: '观畴园-二层-自选菜',
          submitDate: '2025-10-20',
          submitTime: '09:32:17',
          submitter: 'ljx666',
          status: 'pending',
          image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg',
          description: '酸甜可口的经典粤菜',
          allergens: '无',
          ingredients: '猪肉、菠萝、青椒、红椒',
          cuisine: '粤菜',
          taste: '酸甜',
          subItems: [
            { name: '标准份', price: '18' }
          ]
        }
      ]
      
      const dish = sampleDishes.find(d => d.id === parseInt(dishId))
      
      if (dish) {
        Object.assign(dishData, {
          ...dish,
          imageUrl: dish.image || dish.imageUrl || ''
        })
      } else {
        alert('未找到该菜品信息')
        router.push('/review-dish')
      }
    }
    
    // 批准通过
    const approveDish = () => {
      if (confirm(`确定要批准通过菜品 "${dishData.name}" 吗？`)) {
        dishData.status = 'approved'
        // TODO: 调用 API 更新状态
        alert('菜品已批准通过！')
        router.push('/review-dish')
      }
    }
    
    // 拒绝审核
    const rejectDish = () => {
      if (confirm(`确定要拒绝菜品 "${dishData.name}" 吗？`)) {
        dishData.status = 'rejected'
        // TODO: 调用 API 更新状态
        alert('菜品已拒绝！')
        router.push('/review-dish')
      }
    }
    
    // 撤销审核结果
    const revokeApproval = () => {
      if (dishData.status === 'pending') {
        alert('该菜品当前为待审核状态，无需撤销。')
        return
      }
      if (confirm(`确定要撤销菜品 "${dishData.name}" 的审核结果吗？`)) {
        dishData.status = 'pending'
        // TODO: 调用 API 更新状态
        alert('菜品审核结果已撤销，重新进入待审核状态。')
        router.push('/review-dish')
      }
    }
    
    // 返回
    const goBack = () => {
      router.push('/review-dish')
    }
    
    onMounted(() => {
      loadDishData()
    })
    
    return {
      dishData,
      statusClasses,
      statusText,
      approveDish,
      rejectDish,
      revokeApproval,
      goBack
    }
  }
}
</script>

