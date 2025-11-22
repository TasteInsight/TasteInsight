<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen min-w-[1200px]">
        <div class="bg-white rounded-lg container-shadow p-8">
          <Header 
            title="新闻管理" 
            description="管理和发布新闻资讯"
            header-icon="carbon:news"
          />
          
          <!-- 创建新闻按钮 -->
          <div class="mt-6 flex justify-end">
            <button
              @click="showCreateModal = true"
              class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center space-x-2"
            >
              <span class="iconify" data-icon="carbon:add"></span>
              <span>创建新闻</span>
            </button>
          </div>
          
          <!-- 新闻列表 -->
          <div class="mt-6">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">标题</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">摘要</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">发布时间</th>
                    <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr 
                    v-for="news in newsList" 
                    :key="news.id"
                    class="hover:bg-gray-50"
                  >
                    <td class="py-4 px-6">
                      <div class="font-medium text-gray-900">{{ news.title }}</div>
                    </td>
                    <td class="py-4 px-6">
                      <div class="text-gray-600 text-sm max-w-xs truncate">
                        {{ getSummary(news) }}
                      </div>
                    </td>
                    <td class="py-4 px-6 text-gray-600">{{ getCanteenName(news.canteenId) }}</td>
                    <td class="py-4 px-6 text-gray-600 text-sm">{{ formatDate(news.publishedAt) || '未设置' }}</td>
                    <td class="py-4 px-6 text-center">
                      <div class="flex items-center justify-center space-x-2">
                        <button
                          @click="editNews(news)"
                          class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition duration-200"
                        >
                          编辑
                        </button>
                        <button
                          @click="deleteNews(news.id)"
                          class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition duration-200"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="newsList.length === 0">
                    <td colspan="5" class="py-8 text-center text-gray-500">
                      暂无新闻，点击"创建新闻"按钮添加
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 分页 -->
            <div class="mt-6 flex justify-center" v-if="pagination.totalPages > 1">
              <Pagination
                :current-page="pagination.page"
                :total-pages="pagination.totalPages"
                @page-change="handlePageChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 创建/编辑新闻模态框 -->
    <div 
      v-if="showCreateModal || showEditModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-xl font-semibold text-gray-800">
            {{ showEditModal ? '编辑新闻' : '创建新闻' }}
          </h3>
          <button
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 transition"
          >
            <span class="iconify text-2xl" data-icon="carbon:close"></span>
          </button>
        </div>
        
        <div class="p-6">
          <form @submit.prevent="submitForm" class="space-y-6">
            <div>
              <label class="block text-gray-700 font-medium mb-2">标题 *</label>
              <input
                v-model="newsForm.title"
                type="text"
                required
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                placeholder="请输入新闻标题"
              />
            </div>
            
            <div>
              <label class="block text-gray-700 font-medium mb-2">摘要 *</label>
              <input
                v-model="newsForm.summary"
                type="text"
                required
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                placeholder="请输入新闻摘要"
              />
            </div>
            
            <div>
              <label class="block text-gray-700 font-medium mb-2">内容 *</label>
              <textarea
                v-model="newsForm.content"
                required
                rows="10"
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple resize-none"
                placeholder="请输入新闻内容"
              ></textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="block text-gray-700 font-medium mb-2">食堂 *</label>
                <select
                  v-model="newsForm.canteenId"
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                >
                  <option value="" disabled>请选择食堂</option>
                  <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
              </div>
              
              <div>
                <label class="block text-gray-700 font-medium mb-2">发布时间 *</label>
                <input
                  v-model="newsForm.publishedAt"
                  type="datetime-local"
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                />
              </div>
            </div>
            
            <div class="flex space-x-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                class="flex-1 px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
              >
                {{ showEditModal ? '更新' : '创建' }}
              </button>
              <button
                type="button"
                @click="closeModal"
                class="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { newsApi } from '@/api/modules/news'
import { canteenApi } from '@/api/modules/canteen'
import Sidebar from '@/components/Layout/Sidebar.vue'
import Header from '@/components/Layout/Header.vue'
import Pagination from '@/components/Common/Pagination.vue'

export default {
  name: 'NewsManage',
  components: {
    Sidebar,
    Header,
    Pagination
  },
  setup() {
    const newsList = ref([])
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const editingNewsId = ref(null)
    const canteenList = ref([])
    
    const pagination = reactive({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    })
    
    const newsForm = reactive({
      title: '',
      content: '',
      summary: '',
      canteenId: '',
      publishedAt: ''
    })
    
    // 加载新闻列表
    const loadNews = async () => {
      try {
        const response = await newsApi.getNews({
          page: pagination.page,
          pageSize: pagination.pageSize
        })
        
        if (response.code === 200 && response.data) {
          // 处理分页响应格式
          if (response.data.items) {
            newsList.value = response.data.items
            if (response.data.meta) {
              pagination.total = response.data.meta.total
              pagination.totalPages = response.data.meta.totalPages || Math.ceil(response.data.meta.total / pagination.pageSize)
            }
          } else if (Array.isArray(response.data)) {
            // 兼容非分页格式
            newsList.value = response.data
          }
        }
      } catch (error) {
        console.error('加载新闻列表失败:', error)
        alert(error instanceof Error ? error.message : '加载新闻列表失败，请重试')
      }
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // 获取摘要
    const getSummary = (news) => {
      if (news.summary) {
        return news.summary
      }
      if (news.content) {
        return news.content.length > 50 ? news.content.substring(0, 50) + '...' : news.content
      }
      return '无摘要'
    }
    
    // 获取食堂名称
    const getCanteenName = (canteenId) => {
      if (!canteenId) return '未设置'
      const canteen = canteenList.value.find(c => c.id === canteenId)
      return canteen ? canteen.name : '未知食堂'
    }
    
    // 加载食堂列表
    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          if (response.data.items) {
            canteenList.value = response.data.items
          } else if (Array.isArray(response.data)) {
            canteenList.value = response.data
          }
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      }
    }
    
    // 重置表单
    const resetForm = () => {
      newsForm.title = ''
      newsForm.content = ''
      newsForm.summary = ''
      newsForm.canteenId = ''
      newsForm.publishedAt = ''
      editingNewsId.value = null
    }
    
    // 关闭模态框
    const closeModal = () => {
      showCreateModal.value = false
      showEditModal.value = false
      resetForm()
    }
    
    // 编辑新闻
    const editNews = (news) => {
      editingNewsId.value = news.id
      newsForm.title = news.title || ''
      newsForm.content = news.content || ''
      newsForm.summary = news.summary || ''
      newsForm.canteenId = news.canteenId || ''
      
      // 处理发布时间，转换为 datetime-local 格式
      if (news.publishedAt) {
        const date = new Date(news.publishedAt)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        newsForm.publishedAt = `${year}-${month}-${day}T${hours}:${minutes}`
      } else {
        newsForm.publishedAt = ''
      }
      
      showEditModal.value = true
    }
    
    // 提交表单
    const submitForm = async () => {
      try {
        // 构建请求数据
        const requestData = {
          title: newsForm.title,
          content: newsForm.content,
          summary: newsForm.summary,
          canteenId: newsForm.canteenId,
          publishedAt: newsForm.publishedAt ? new Date(newsForm.publishedAt).toISOString() : undefined
        }
        
        if (showEditModal.value && editingNewsId.value) {
          // 更新新闻
          const response = await newsApi.updateNews(editingNewsId.value, requestData)
          if (response.code === 200 || response.code === 201) {
            alert('新闻更新成功！')
            closeModal()
            loadNews()
          } else {
            throw new Error(response.message || '更新失败')
          }
        } else {
          // 创建新闻
          const response = await newsApi.createNews(requestData)
          if (response.code === 200 || response.code === 201) {
            alert('新闻创建成功！')
            closeModal()
            loadNews()
          } else {
            throw new Error(response.message || '创建失败')
          }
        }
      } catch (error) {
        console.error('提交失败:', error)
        alert(error instanceof Error ? error.message : '操作失败，请重试')
      }
    }
    
    // 删除新闻
    const deleteNews = async (newsId) => {
      if (!confirm('确定要删除这条新闻吗？')) {
        return
      }
      
      try {
        const response = await newsApi.deleteNews(newsId)
        if (response.code === 200 || response.code === 201) {
          alert('新闻删除成功！')
          loadNews()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除失败:', error)
        alert(error instanceof Error ? error.message : '删除失败，请重试')
      }
    }
    
    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      loadNews()
    }
    
    onMounted(() => {
      loadCanteens()
      loadNews()
    })
    
    return {
      newsList,
      showCreateModal,
      showEditModal,
      newsForm,
      canteenList,
      pagination,
      formatDate,
      getSummary,
      getCanteenName,
      closeModal,
      editNews,
      submitForm,
      deleteNews,
      handlePageChange
    }
  }
}
</script>

