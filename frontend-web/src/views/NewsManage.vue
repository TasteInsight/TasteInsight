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
              @click="openCreateModal"
              class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center space-x-2"
            >
              <span class="iconify" data-icon="carbon:add"></span>
              <span>创建新闻</span>
            </button>
          </div>
          
          <!-- 新闻列表 -->
          <div class="mt-6">
            <!-- 状态筛选 -->
            <div class="mb-4 flex space-x-4">
              <button 
                class="px-4 py-2 rounded-lg transition-colors"
                :class="currentStatus === 'published' ? 'bg-tsinghua-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                @click="changeStatus('published')"
              >
                已发布
              </button>
              <button 
                class="px-4 py-2 rounded-lg transition-colors"
                :class="currentStatus === 'draft' ? 'bg-tsinghua-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                @click="changeStatus('draft')"
              >
                未发布 (草稿)
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">标题</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">摘要</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">
                      {{ currentStatus === 'published' ? '发布时间' : '创建时间' }}
                    </th>
                    <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-if="isLoading">
                    <td colspan="5" class="py-8 text-center text-gray-500">
                      <span class="iconify inline-block text-2xl animate-spin" data-icon="mdi:loading"></span>
                      <span class="ml-2">加载中...</span>
                    </td>
                  </tr>
                  <tr v-else-if="newsList.length === 0">
                    <td colspan="5" class="py-8 text-center text-gray-500">
                      暂无{{ currentStatus === 'published' ? '已发布' : '未发布' }}新闻
                    </td>
                  </tr>
                  <tr 
                    v-else
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
                    <td class="py-4 px-6 text-gray-600 text-sm">
                      {{ formatDate(currentStatus === 'published' ? news.publishedAt : news.createdAt) || '未设置' }}
                    </td>
                    <td class="py-4 px-6 text-center">
                      <div class="flex items-center justify-center space-x-2">
                        <!-- 未发布状态操作 -->
                        <template v-if="currentStatus === 'draft'">
                          <button
                            @click="publishNews(news.id)"
                            class="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition duration-200"
                          >
                            发布
                          </button>
                          <button
                            @click="editNews(news)"
                            class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition duration-200"
                          >
                            编辑
                          </button>
                        </template>
                        
                        <!-- 已发布状态操作 -->
                        <template v-else>
                          <button
                            @click="revokeNews(news.id)"
                            class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200 transition duration-200"
                            title="如需编辑已发布新闻，请先撤回至草稿状态"
                          >
                            撤回
                          </button>
                          <span class="ml-1 text-gray-400 text-xs" title="如需编辑已发布新闻，请先撤回至草稿状态">
                            <span class="iconify" data-icon="mdi:information-outline"></span>
                          </span>
                        </template>

                        <button
                          @click="deleteNews(news.id)"
                          class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition duration-200"
                        >
                          删除
                        </button>
                      </div>
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
      <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] overflow-y-auto m-4">
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
            <!-- 发布人信息 -->
            <div>
              <label class="block text-gray-700 font-medium mb-2">发布人</label>
              <input
                :value="currentAdmin?.username || currentAdmin?.id || '未知'"
                type="text"
                disabled
                class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p class="mt-1 text-sm text-gray-500">发布人ID: {{ currentAdmin?.id || '未知' }} (自动填充)</p>
            </div>

            <div>
              <label class="block text-gray-700 font-medium mb-2">标题 <span class="text-red-500">*</span></label>
              <input
                v-model="newsForm.title"
                type="text"
                required
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                placeholder="请输入新闻标题"
              />
            </div>
            
            <div>
              <label class="block text-gray-700 font-medium mb-2">摘要 <span class="text-red-500">*</span></label>
              <input
                v-model="newsForm.summary"
                type="text"
                required
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                placeholder="请输入新闻摘要"
              />
            </div>
            
            <!-- ================= 富文本编辑器区域 START ================= -->
            <div>
              <label class="block text-gray-700 font-medium mb-2">内容 <span class="text-red-500">*</span></label>
              <div style="border: 1px solid #ccc; z-index: 100;" class="rounded-lg overflow-hidden">
                <Toolbar
                  style="border-bottom: 1px solid #ccc"
                  :editor="editorRef"
                  :defaultConfig="toolbarConfig"
                  :mode="mode"
                />
                <Editor
                  style="height: 400px; overflow-y: hidden;"
                  v-model="valueHtml"
                  :defaultConfig="editorConfig"
                  :mode="mode"
                  @onCreated="handleCreated"
                />
              </div>
            </div>
            <!-- ================= 富文本编辑器区域 END ================= -->
            
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="block text-gray-700 font-medium mb-2">发布单位 <span class="text-red-500">*</span></label>
                <select
                  v-model="newsForm.canteenId"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                >
                  <option value="">全校公告</option>
                  <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
              </div>
              
              <div>
                <label class="block text-gray-700 font-medium mb-2">发布时间 <span class="text-red-500">*</span></label>
                <input
                  v-model="newsForm.publishedAt"
                  type="datetime-local"
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                />
              </div>
            </div>
            
            <div class="flex space-x-4 pt-4 border-t border-gray-200">
              <!-- 创建模式：保存草稿 或 立即发布 -->
              <template v-if="!showEditModal">
                <button
                  type="button"
                  @click="submitForm('draft')"
                  class="flex-1 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition duration-200"
                >
                  保存为草稿
                </button>
                <button
                  type="button"
                  @click="submitForm('published')"
                  class="flex-1 px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
                >
                  立即发布
                </button>
              </template>
              
              <!-- 编辑模式：保存更新 -->
              <template v-else>
                <button
                  type="button"
                  @click="submitForm('draft')"
                  class="flex-1 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition duration-200"
                >
                  保存为草稿
                </button>
                <button
                  type="button"
                  @click="submitForm('published')"
                  class="flex-1 px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
                >
                  立即发布
                </button>
              </template>

              <button
                type="button"
                @click="closeModal"
                class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
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
// 1. 引入 Vue 核心功能，添加 shallowRef, onBeforeUnmount
import { ref, reactive, onMounted, shallowRef, onBeforeUnmount, computed } from 'vue'
// 2. 引入 wangEditor CSS 和组件
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'

import { newsApi } from '@/api/modules/news'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Sidebar from '@/components/Layout/Sidebar.vue'
import Header from '@/components/Layout/Header.vue'
import Pagination from '@/components/Common/Pagination.vue'

export default {
  name: 'NewsManage',
  components: {
    Sidebar,
    Header,
    Pagination,
    Editor, // 注册 Editor 组件
    Toolbar // 注册 Toolbar 组件
  },
  setup() {
    const newsList = ref([])
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const editingNewsId = ref(null)
    const isLoading = ref(false)
    const currentStatus = ref('published') // 默认显示已发布
    const canteenList = ref([])
    const authStore = useAuthStore()

    // 获取当前登录管理员信息
    const currentAdmin = computed(() => authStore.user)
    
    // --- wangEditor 配置 START ---
    // 编辑器实例，必须用 shallowRef
    const editorRef = shallowRef()
    
    // 内容 HTML，直接绑定到 Editor
    const valueHtml = ref('')
    
    const mode = 'default' // 或 'simple'
    
    const toolbarConfig = {}
    
    const editorConfig = { 
      placeholder: '请输入新闻内容...',
      MENU_CONF: {
        // 如果需要上传图片，请在这里配置，例如：
        // uploadImage: { server: '/api/upload', fieldName: 'file' }
      }
    }
    
    // 组件销毁时，也及时销毁编辑器
    onBeforeUnmount(() => {
      const editor = editorRef.value
      if (editor == null) return
      editor.destroy()
    })
    
    const handleCreated = (editor) => {
      editorRef.value = editor // 记录 editor 实例
    }
    // --- wangEditor 配置 END ---

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
      publishedAt: '',
      status: 'draft'
    })
    
    // 加载新闻列表
    const loadNews = async () => {
      isLoading.value = true
      try {
        const response = await newsApi.getNews({
          page: pagination.page,
          pageSize: pagination.pageSize,
          status: currentStatus.value
        })
        
        if (response.code === 200 && response.data) {
          if (response.data.items) {
            newsList.value = response.data.items
            if (response.data.meta) {
              pagination.total = response.data.meta.total
              pagination.totalPages = response.data.meta.totalPages || Math.ceil(response.data.meta.total / pagination.pageSize)
            }
          } else if (Array.isArray(response.data)) {
            newsList.value = response.data
          }
        } else {
          // 清空列表
          newsList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('加载新闻列表失败:', error)
        alert(error instanceof Error ? error.message : '加载新闻列表失败，请重试')
      } finally {
        isLoading.value = false
      }
    }
    
    // 切换状态筛选
    const changeStatus = (status) => {
      currentStatus.value = status
      pagination.page = 1
      loadNews()
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    }
    
    const getSummary = (news) => {
      // 简单处理：如果是富文本，可能包含HTML标签，这里简单截取
      // 实际项目中建议后端返回纯文本摘要，或者前端用正则去掉HTML标签
      let text = news.summary || news.content || '无摘要'
      // 移除HTML标签仅用于列表展示（简单的正则）
      text = text.replace(/<[^>]+>/g, '')
      return text.length > 50 ? text.substring(0, 50) + '...' : text
    }
    
    const getCanteenName = (canteenId) => {
      if (!canteenId) return '未设置'
      const canteen = canteenList.value.find(c => c.id === canteenId)
      return canteen ? canteen.name : '未知食堂'
    }
    
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
      newsForm.status = 'draft'
      editingNewsId.value = null
      
      // 【关键】重置编辑器内容
      valueHtml.value = ''
    }
    
    // 打开创建模态框
    const openCreateModal = () => {
      resetForm()
      showCreateModal.value = true
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
      newsForm.status = news.status || 'draft'
      
      // 【关键】将新闻内容赋值给编辑器
      valueHtml.value = news.content || ''
      
      if (news.publishedAt) {
        const date = new Date(news.publishedAt)
        // 格式化为 datetime-local 所需格式 YYYY-MM-DDThh:mm
        const pad = (n) => String(n).padStart(2, '0')
        const year = date.getFullYear()
        const month = pad(date.getMonth() + 1)
        const day = pad(date.getDate())
        const hours = pad(date.getHours())
        const minutes = pad(date.getMinutes())
        newsForm.publishedAt = `${year}-${month}-${day}T${hours}:${minutes}`
      } else {
        newsForm.publishedAt = ''
      }
      
      showEditModal.value = true
    }
    
    // 提交表单
    const submitForm = async (targetStatus) => {
      // 表单验证
      if (!newsForm.title || !newsForm.summary || !valueHtml.value) {
        alert('请填写标题、摘要和内容')
        return
      }
      if (targetStatus === 'published' && !newsForm.publishedAt) {
        alert('请填写发布时间')
        return
      }

      try {
        // 【关键】提交前，将编辑器中的 HTML 同步回 newsForm.content
        newsForm.content = valueHtml.value

        const requestData = {
          title: newsForm.title,
          content: newsForm.content,
          summary: newsForm.summary,
          canteenId: newsForm.canteenId || null, // 如果是空字符串（全校公告），则传 null
          publishedAt: newsForm.publishedAt ? new Date(newsForm.publishedAt).toISOString() : undefined,
          createdBy: authStore.user?.id, // 添加发布人 ID
          status: targetStatus // 使用传入的目标状态
        }
        
        if (showEditModal.value && editingNewsId.value) {
          // 更新
          const response = await newsApi.updateNews(editingNewsId.value, requestData)
          if (response.code === 200 || response.code === 201) {
            alert('新闻更新成功！')
            closeModal()
            loadNews()
          } else {
            throw new Error(response.message || '更新失败')
          }
        } else {
          // 创建
          const response = await newsApi.createNews(requestData)
          if (response.code === 200 || response.code === 201) {
            alert('新闻创建成功！')
            closeModal()
            // 如果创建的是草稿，确保当前视图切换到草稿列表，或者提示用户
            if (targetStatus === 'draft' && currentStatus.value !== 'draft') {
              currentStatus.value = 'draft'
            }
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
    
    // 发布新闻
    const publishNews = async (id) => {
      if (!confirm('确定要发布这条新闻吗？')) return
      try {
        const response = await newsApi.publishNews(id)
        if (response.code === 200) {
          alert('发布成功')
          loadNews()
        } else {
          throw new Error(response.message || '发布失败')
        }
      } catch (error) {
        console.error('发布失败:', error)
        alert(error instanceof Error ? error.message : '发布失败，请重试')
      }
    }

    // 撤回新闻
    const revokeNews = async (id) => {
      if (!confirm('确定要撤回这条新闻吗？撤回后将变为草稿状态。')) return
      try {
        const response = await newsApi.revokeNews(id)
        if (response.code === 200) {
          alert('撤回成功，已移至草稿箱')
          loadNews()
        } else {
          throw new Error(response.message || '撤回失败')
        }
      } catch (error) {
        console.error('撤回失败:', error)
        alert(error instanceof Error ? error.message : '撤回失败，请重试')
      }
    }
    
    const deleteNews = async (newsId) => {
      if (!confirm('确定要删除这条新闻吗？')) return
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
      currentAdmin,
      currentStatus,
      isLoading,
      changeStatus,
      publishNews,
      revokeNews,
      // 导出编辑器相关变量
      editorRef,
      valueHtml,
      mode,
      toolbarConfig,
      editorConfig,
      handleCreated,
      // 导出其他方法
      formatDate,
      getSummary,
      getCanteenName,
      closeModal,
      openCreateModal,
      editNews,
      submitForm,
      deleteNews,
      handlePageChange
    }
  }
}
</script>