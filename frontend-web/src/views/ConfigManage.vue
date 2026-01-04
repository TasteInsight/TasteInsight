<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="系统配置管理"
        :description="configDescription"
        header-icon="carbon:settings"
      />

      <!-- 食堂信息提示 -->
      <div v-if="currentCanteenInfo" class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-center gap-2">
          <span class="iconify text-blue-600" data-icon="carbon:location"></span>
          <span class="text-sm font-medium text-blue-800">
            {{ currentCanteenInfo }}
          </span>
        </div>
      </div>

      <div class="mt-6">
        <!-- 加载状态 -->
        <div v-if="loading" class="text-center py-12">
          <span class="iconify text-4xl text-gray-300 animate-spin" data-icon="carbon:circle-dash"></span>
          <p class="mt-4 text-gray-500">加载中...</p>
        </div>

        <!-- 配置表单 -->
        <div v-else class="space-y-6">
          <!-- 评价自动审核配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span class="iconify text-tsinghua-purple" data-icon="carbon:star-review"></span>
                  评价自动审核
                </h3>
                <p class="text-sm text-gray-600">
                  开启后，用户提交的评价将直接显示，无需管理员审核。关闭后，所有评价需要管理员审核通过后才能显示。
                </p>
              </div>
            </div>

            <div class="mt-4 flex items-center gap-4">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  v-model="reviewAutoApprove"
                  :disabled="!authStore.hasPermission('config:edit') || reviewSaving"
                  @change="handleReviewAutoApproveChange"
                  class="sr-only peer"
                />
                <div
                  :class="toggleSwitchClass"
                ></div>
                <span class="ml-3 text-sm font-medium text-gray-700">
                  {{ reviewAutoApprove ? '已开启' : '已关闭' }}
                </span>
              </label>

              <div v-if="reviewSaving" class="flex items-center gap-2 text-sm text-gray-500">
                <span class="iconify animate-spin" data-icon="carbon:circle-dash"></span>
                <span>保存中...</span>
              </div>
              <div v-else-if="reviewSaveSuccess" class="flex items-center gap-2 text-sm text-green-600">
                <span class="iconify" data-icon="carbon:checkmark-filled"></span>
                <span>保存成功</span>
              </div>
            </div>

            <div v-if="!authStore.hasPermission('config:edit')" class="mt-2 text-xs text-gray-500">
              <span class="iconify" data-icon="carbon:information"></span>
              您没有编辑配置的权限
            </div>
          </div>

          <!-- 评论自动审核配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span class="iconify text-tsinghua-purple" data-icon="carbon:chat"></span>
                  评论自动审核
                </h3>
                <p class="text-sm text-gray-600">
                  开启后，用户提交的评论将直接显示，无需管理员审核。关闭后，所有评论需要管理员审核通过后才能显示。
                </p>
              </div>
            </div>

            <div class="mt-4 flex items-center gap-4">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  v-model="commentAutoApprove"
                  :disabled="!authStore.hasPermission('config:edit') || commentSaving"
                  @change="handleCommentAutoApproveChange"
                  class="sr-only peer"
                />
                <div
                  :class="toggleSwitchClass"
                ></div>
                <span class="ml-3 text-sm font-medium text-gray-700">
                  {{ commentAutoApprove ? '已开启' : '已关闭' }}
                </span>
              </label>

              <div v-if="commentSaving" class="flex items-center gap-2 text-sm text-gray-500">
                <span class="iconify animate-spin" data-icon="carbon:circle-dash"></span>
                <span>保存中...</span>
              </div>
              <div v-else-if="commentSaveSuccess" class="flex items-center gap-2 text-sm text-green-600">
                <span class="iconify" data-icon="carbon:checkmark-filled"></span>
                <span>保存成功</span>
              </div>
            </div>

            <div v-if="!authStore.hasPermission('config:edit')" class="mt-2 text-xs text-gray-500">
              <span class="iconify" data-icon="carbon:information"></span>
              您没有编辑配置的权限
            </div>
          </div>

          <!-- 菜品嵌入向量刷新配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span class="iconify text-tsinghua-purple" data-icon="carbon:ai-results"></span>
                  菜品嵌入向量刷新
                </h3>
                <p class="text-sm text-gray-600">
                  刷新菜品嵌入向量可以更新推荐算法的数据，提高推荐准确性。批量刷新将处理指定食堂的所有菜品，可能需要较长时间。
                </p>
              </div>
            </div>

            <div class="mt-4 space-y-4">
              <!-- 食堂选择（仅全局管理员显示） -->
              <div v-if="!currentCanteenId" class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  选择要刷新的食堂
                </label>
                <select
                  v-model="selectedCanteenId"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  :disabled="embeddingRefreshing || loadingCanteens"
                >
                  <option value="" disabled>请选择食堂</option>
                  <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
                <p v-if="loadingCanteens" class="mt-1 text-xs text-gray-500">
                  加载食堂列表中...
                </p>
              </div>

              <!-- 批量刷新按钮 -->
              <div class="flex items-center gap-4">
                <button
                  type="button"
                  :key="'refresh-btn-' + embeddingRefreshing"
                  :disabled="!authStore.hasPermission('dish:edit') || embeddingRefreshing || (!currentCanteenId && !selectedCanteenId)"
                  @click="handleRefreshCanteenEmbeddings"
                  class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span 
                    v-if="embeddingRefreshing"
                    key="icon-loading"
                    class="iconify mr-1 animate-spin" 
                    data-icon="carbon:circle-dash"
                  ></span>
                  <span 
                    v-else
                    key="icon-refresh"
                    class="iconify mr-1" 
                    data-icon="carbon:refresh"
                  ></span>
                  {{ embeddingRefreshing ? '刷新中...' : (currentCanteenId ? '刷新当前食堂所有菜品嵌入向量' : '刷新所选食堂所有菜品嵌入向量') }}
                </button>

                <div v-if="embeddingRefreshSuccess" class="flex items-center gap-2 text-sm text-green-600">
                  <span class="iconify" data-icon="carbon:checkmark-filled"></span>
                  <span>刷新任务已提交</span>
                </div>
              </div>

              <!-- 任务状态显示 -->
              <div v-if="currentJobId" class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-700">任务状态</span>
                    <span 
                      v-if="jobStatus"
                      class="px-2 py-1 rounded text-xs font-medium"
                      :class="getJobStatusClass(jobStatus.status)"
                    >
                      {{ getJobStatusText(jobStatus.status) }}
                    </span>
                  </div>
                  <button
                    v-if="jobStatus && (jobStatus.status === 'pending' || jobStatus.status === 'processing' || jobStatus.status === 'waiting' || jobStatus.status === 'active')"
                    type="button"
                    @click="stopPolling"
                    class="text-xs text-gray-500 hover:text-gray-700"
                    title="后台任务会继续执行，仅停止状态查询"
                  >
                    隐藏状态
                  </button>
                </div>

                <!-- 进度条 -->
                <div v-if="jobStatus && (jobStatus.progress || jobStatus.returnValue)" class="mt-3">
                  <!-- 如果 progress 是对象，包含 total, processed 等信息 -->
                  <div v-if="typeof jobStatus.progress === 'object' && jobStatus.progress">
                    <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>进度: {{ jobStatus.progress.processed || 0 }} / {{ jobStatus.progress.total || 0 }}</span>
                      <span>{{ jobStatus.progress.total > 0 ? Math.round((jobStatus.progress.processed / jobStatus.progress.total) * 100) : 0 }}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div
                        class="bg-tsinghua-purple h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${jobStatus.progress.total > 0 ? (jobStatus.progress.processed / jobStatus.progress.total) * 100 : 0}%` }"
                      ></div>
                    </div>
                    <div v-if="jobStatus.progress.failed > 0" class="mt-2 text-xs text-red-600">
                      失败: {{ jobStatus.progress.failed }} 个
                    </div>
                  </div>
                  <!-- 如果 progress 是数字 -->
                  <div v-else-if="typeof jobStatus.progress === 'number'">
                    <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>进度: {{ jobStatus.progress }}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div
                        class="bg-tsinghua-purple h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${jobStatus.progress}%` }"
                      ></div>
                    </div>
                  </div>
                  <!-- 如果有 returnValue，显示完成信息 -->
                  <div v-if="jobStatus.returnValue && typeof jobStatus.returnValue === 'object'">
                    <div class="text-xs text-gray-600 mt-2">
                      <div v-if="jobStatus.returnValue.count !== undefined">
                        已处理: {{ jobStatus.returnValue.count }} 个菜品
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 消息提示 -->
                <div v-if="jobStatus?.message" class="mt-2 text-xs text-gray-600">
                  {{ jobStatus.message }}
                </div>
              </div>

              <div v-if="!authStore.hasPermission('dish:edit')" class="mt-2 text-xs text-gray-500">
                <span class="iconify" data-icon="carbon:information"></span>
                您没有刷新嵌入向量的权限
              </div>
            </div>
          </div>

          <!-- 加载失败提示 -->
          <div v-if="loadError" class="text-center py-12">
            <span class="iconify text-6xl text-gray-300 mx-auto" data-icon="carbon:warning-alt"></span>
            <p class="mt-4 text-gray-500">配置加载失败，请刷新页面重试</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { configApi } from '@/api/modules/config'
import { dishApi } from '@/api/modules/dish'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import { showAlert } from '@/composables/useModal'

export default {
  name: 'ConfigManage',
  components: {
    Header,
  },
  setup() {
    const authStore = useAuthStore()
    const loading = ref(false)
    const reviewSaving = ref(false)
    const reviewSaveSuccess = ref(false)
    const commentSaving = ref(false)
    const commentSaveSuccess = ref(false)
    const reviewAutoApprove = ref(false)
    const commentAutoApprove = ref(false)
    const configItems = ref([])
    const loadError = ref(false)

    // 菜品嵌入刷新相关状态
    const embeddingRefreshing = ref(false)
    const embeddingRefreshSuccess = ref(false)
    const currentJobId = ref(null)
    const jobStatus = ref(null)
    const pollingIntervalRef = ref(null)
    const isPollingActive = ref(false) // 标记轮询是否活跃，用于防止异步请求在停止后继续更新状态

    // 食堂列表（用于全局管理员选择）
    const canteenList = ref([])
    const loadingCanteens = ref(false)
    const selectedCanteenId = ref('')

    // 当前管理员的食堂ID
    const currentCanteenId = computed(() => authStore.user?.canteenId || null)
    
    // 当前管理员的食堂名称
    const currentCanteenName = computed(() => authStore.user?.canteenName || null)

    // Toggle switch 的类名（避免引号冲突）
    const toggleSwitchClass = computed(() => {
      return "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-tsinghua-purple/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-tsinghua-purple"
    })

    // 配置描述文本
    const configDescription = computed(() => {
      if (currentCanteenId.value) {
        return '管理当前食堂的配置项（仅影响当前食堂）'
      }
      return '管理系统全局配置项（影响所有食堂）'
    })

    // 当前食堂信息
    const currentCanteenInfo = computed(() => {
      if (!currentCanteenId.value) {
        return '您正在管理全局配置（所有食堂）'
      }
      
      // 直接使用管理员的 canteenName 字段
      if (currentCanteenName.value) {
        return `您正在管理食堂配置：${currentCanteenName.value}（仅影响该食堂）`
      }
      
      // 如果 canteenName 不存在，显示ID作为后备
      return `您正在管理食堂配置（食堂ID: ${currentCanteenId.value}）`
    })


    // 加载配置（根据管理员是否有食堂ID决定加载全局还是食堂配置）
    const loadConfig = async () => {
      loading.value = true
      try {
        let response
        if (currentCanteenId.value) {
          // 有食堂ID，使用有效配置API获取实际生效的配置值（食堂配置 > 全局配置 > 默认值）
          response = await configApi.getEffectiveConfig(currentCanteenId.value)
        } else {
          // 没有食堂ID，加载全局配置
          response = await configApi.getGlobalConfig()
        }

        if (response.code === 200 && response.data) {
          const reviewAutoApproveKey = 'review.autoApprove'
          const commentAutoApproveKey = 'comment.autoApprove'

          if (currentCanteenId.value) {
            // 食堂配置：从有效配置列表中查找
            const effectiveConfigData = response.data
            const effectiveItems = effectiveConfigData.items || []
            
            const reviewAutoApproveItem = effectiveItems.find(
              (item) => item.key === reviewAutoApproveKey
            )
            const commentAutoApproveItem = effectiveItems.find(
              (item) => item.key === commentAutoApproveKey
            )

            if (reviewAutoApproveItem) {
              reviewAutoApprove.value = reviewAutoApproveItem.value === 'true'
            } else {
              reviewAutoApprove.value = false
            }

            if (commentAutoApproveItem) {
              commentAutoApprove.value = commentAutoApproveItem.value === 'true'
            } else {
              commentAutoApprove.value = false
            }

            // 保存有效配置项用于显示
            configItems.value = effectiveItems
          } else {
            // 全局配置
            const globalConfigData = response.data
            const config = globalConfigData.config
            const templates = globalConfigData.templates

            const reviewAutoApproveItem = config?.items?.find(
              (item) => item.key === reviewAutoApproveKey
            )
            const commentAutoApproveItem = config?.items?.find(
              (item) => item.key === commentAutoApproveKey
            )

            if (reviewAutoApproveItem) {
              reviewAutoApprove.value = reviewAutoApproveItem.value === 'true'
            } else {
              // 如果配置项不存在，查找模板中的默认值
              const template = templates?.find((t) => t.key === reviewAutoApproveKey)
              if (template) {
                reviewAutoApprove.value = template.defaultValue === 'true'
              }
            }

            if (commentAutoApproveItem) {
              commentAutoApprove.value = commentAutoApproveItem.value === 'true'
            } else {
              // 如果配置项不存在，查找模板中的默认值
              const template = templates?.find((t) => t.key === commentAutoApproveKey)
              if (template) {
                commentAutoApprove.value = template.defaultValue === 'true'
              }
            }

            // 保存所有配置项用于显示
            configItems.value = config?.items || []
          }
          loadError.value = false
        } else {
          throw new Error(response.message || '获取配置失败')
        }
      } catch (error) {
        console.error('加载配置失败:', error)
        loadError.value = true
        showAlert('加载配置失败，请刷新重试')
      } finally {
        loading.value = false
      }
    }

    // 处理评价自动审核配置变更
    const handleReviewAutoApproveChange = async () => {
      if (!authStore.hasPermission('config:edit')) {
        showAlert('您没有编辑配置的权限')
        reviewAutoApprove.value = !reviewAutoApprove.value // 恢复原值
        return
      }

      reviewSaving.value = true
      reviewSaveSuccess.value = false

      try {
        let response
        if (currentCanteenId.value) {
          // 有食堂ID，更新食堂配置
          response = await configApi.updateCanteenConfig(currentCanteenId.value, {
            key: 'review.autoApprove',
            value: reviewAutoApprove.value ? 'true' : 'false',
          })
        } else {
          // 没有食堂ID，更新全局配置
          response = await configApi.updateGlobalConfig({
            key: 'review.autoApprove',
            value: reviewAutoApprove.value ? 'true' : 'false',
          })
        }

        if (response.code === 200) {
          reviewSaveSuccess.value = true
          // 3秒后隐藏成功提示
          setTimeout(() => {
            reviewSaveSuccess.value = false
          }, 3000)
        } else {
          throw new Error(response.message || '保存配置失败')
        }
      } catch (error) {
        console.error('保存配置失败:', error)
        showAlert(error instanceof Error ? error.message : '保存配置失败，请重试')
        // 恢复原值
        await loadConfig()
      } finally {
        reviewSaving.value = false
      }
    }

    // 处理评论自动审核配置变更
    const handleCommentAutoApproveChange = async () => {
      if (!authStore.hasPermission('config:edit')) {
        showAlert('您没有编辑配置的权限')
        commentAutoApprove.value = !commentAutoApprove.value // 恢复原值
        return
      }

      commentSaving.value = true
      commentSaveSuccess.value = false

      try {
        let response
        if (currentCanteenId.value) {
          // 有食堂ID，更新食堂配置
          response = await configApi.updateCanteenConfig(currentCanteenId.value, {
            key: 'comment.autoApprove',
            value: commentAutoApprove.value ? 'true' : 'false',
          })
        } else {
          // 没有食堂ID，更新全局配置
          response = await configApi.updateGlobalConfig({
            key: 'comment.autoApprove',
            value: commentAutoApprove.value ? 'true' : 'false',
          })
        }

        if (response.code === 200) {
          commentSaveSuccess.value = true
          // 3秒后隐藏成功提示
          setTimeout(() => {
            commentSaveSuccess.value = false
          }, 3000)
        } else {
          throw new Error(response.message || '保存配置失败')
        }
      } catch (error) {
        console.error('保存配置失败:', error)
        showAlert(error instanceof Error ? error.message : '保存配置失败，请重试')
        // 恢复原值
        await loadConfig()
      } finally {
        commentSaving.value = false
      }
    }

    // 加载食堂列表（仅全局管理员需要）
    const loadCanteenList = async () => {
      if (currentCanteenId.value) {
        // 有食堂ID的管理员不需要加载列表
        return
      }

      loadingCanteens.value = true
      try {
        const response = await canteenApi.getCanteens({ pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteenList.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      } finally {
        loadingCanteens.value = false
      }
    }

    // 处理按食堂批量刷新菜品嵌入向量
    const handleRefreshCanteenEmbeddings = async () => {
      if (!authStore.hasPermission('dish:edit')) {
        showAlert('您没有刷新嵌入向量的权限')
        return
      }

      // 确定要刷新的食堂ID
      const canteenIdToRefresh = currentCanteenId.value || selectedCanteenId.value

      if (!canteenIdToRefresh) {
        showAlert('请选择要刷新的食堂')
        return
      }

      embeddingRefreshing.value = true
      embeddingRefreshSuccess.value = false
      currentJobId.value = null
      jobStatus.value = null

      try {
        const response = await dishApi.refreshDishesEmbeddingByCanteen(canteenIdToRefresh)
        
        console.log('刷新任务响应:', response)
        
        if (response && response.code === 200 && response.data) {
          embeddingRefreshSuccess.value = true
          const jobId = response.data.jobId
          
          console.log('获取到的jobId:', jobId)
          
          if (jobId) {
            // 有jobId，异步模式，开始轮询
            currentJobId.value = jobId
            console.log('开始轮询任务状态，jobId:', jobId)
            startPolling(jobId)
          } else {
            // 没有jobId，同步模式，直接完成
            console.log('同步模式，任务已完成')
            currentJobId.value = null
            embeddingRefreshing.value = false
            showAlert('刷新任务已提交（同步模式）')
            // 3秒后隐藏成功提示
            setTimeout(() => {
              embeddingRefreshSuccess.value = false
            }, 3000)
          }
        } else {
          throw new Error(response?.message || '提交刷新任务失败')
        }
      } catch (error) {
        console.error('刷新嵌入向量失败:', error)
        embeddingRefreshing.value = false
        currentJobId.value = null
        showAlert(error instanceof Error ? error.message : '刷新嵌入向量失败，请重试')
      }
    }

    // 开始轮询任务状态
    const startPolling = (jobId) => {
      // 清除之前的轮询
      if (pollingIntervalRef.value) {
        clearInterval(pollingIntervalRef.value)
        pollingIntervalRef.value = null
      }
      
      // 标记轮询为活跃状态
      isPollingActive.value = true
      
      // 立即查询一次
      checkJobStatus(jobId)
      
      // 每2秒轮询一次
      pollingIntervalRef.value = setInterval(() => {
        checkJobStatus(jobId)
      }, 2000)
    }

    // 停止轮询
    const stopPolling = () => {
      // 标记轮询为非活跃状态，阻止正在进行的异步请求更新状态
      isPollingActive.value = false
      
      if (pollingIntervalRef.value) {
        clearInterval(pollingIntervalRef.value)
        pollingIntervalRef.value = null
      }
      // 重置成功提示状态
      embeddingRefreshSuccess.value = false
      // 重置刷新中状态
      embeddingRefreshing.value = false
      // 清除任务ID和状态，让任务状态区域消失
      currentJobId.value = null
      jobStatus.value = null
    }

    // 检查任务状态
    const checkJobStatus = async (jobId) => {
      if (!jobId) {
        console.warn('jobId为空，停止轮询')
        stopPolling()
        return
      }

      // 如果轮询已被停止，不再处理响应
      if (!isPollingActive.value) {
        return
      }

      try {
        const response = await dishApi.getEmbeddingJobStatus(jobId)
        
        // 再次检查轮询状态，因为在等待响应期间可能已被停止
        if (!isPollingActive.value) {
          return
        }
        
        console.log('任务状态响应:', response)
        
        // 确保正确获取响应数据
        let statusData = null
        if (response && response.code === 200) {
          // 标准响应格式：{ code: 200, data: {...} }
          statusData = response.data
        } else if (response && response.status) {
          // 如果响应直接包含status字段，说明data就是状态数据
          statusData = response
        }
        
        if (statusData) {
          // 更新任务状态
          // 后端返回的是 state 字段，不是 status
          // 为了兼容，我们统一使用 status
          const taskStatus = statusData.state || statusData.status
          const normalizedStatus = {
            ...statusData,
            status: taskStatus, // 统一使用 status 字段
            // 映射 BullMQ 的状态到我们的状态
            state: taskStatus,
          }
          
          // 将 BullMQ 的状态映射到我们的状态格式
          // BullMQ 状态: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
          let mappedStatus = taskStatus
          if (taskStatus === 'waiting') {
            mappedStatus = 'pending'
          } else if (taskStatus === 'active') {
            mappedStatus = 'processing'
          }
          
          normalizedStatus.status = mappedStatus
          jobStatus.value = normalizedStatus
          
          console.log('任务状态更新:', normalizedStatus, '原始状态:', taskStatus)
          
          // 如果任务完成或失败，停止轮询并重置UI状态
          if (mappedStatus === 'completed' || mappedStatus === 'failed') {
            // 先停止轮询，清除定时器
            isPollingActive.value = false
            if (pollingIntervalRef.value) {
              clearInterval(pollingIntervalRef.value)
              pollingIntervalRef.value = null
            }
            // 重置UI状态
            embeddingRefreshing.value = false
            embeddingRefreshSuccess.value = false
            
            if (mappedStatus === 'completed') {
              showAlert('嵌入向量刷新完成')
            } else {
              showAlert(`嵌入向量刷新失败: ${normalizedStatus.failedReason || normalizedStatus.message || '未知错误'}`)
            }
            return
          }
          
          // 如果状态是pending或processing，继续轮询
          if (mappedStatus === 'pending' || mappedStatus === 'processing') {
            // 继续轮询，不做任何操作
            return
          }
        } else if (response && response.code === 404) {
          // 任务不存在，停止轮询
          console.warn('任务不存在:', jobId)
          stopPolling()
          jobStatus.value = null
          showAlert('任务不存在或已过期')
        } else {
          // 其他错误情况
          console.warn('获取任务状态异常:', response)
        }
      } catch (error) {
        console.error('获取任务状态失败:', error)
        // 如果轮询已被手动停止，不再处理错误
        if (!isPollingActive.value) {
          return
        }
        // 如果连续失败，停止轮询
        stopPolling()
        showAlert('获取任务状态失败，请刷新页面查看')
      }
    }

    // 获取任务状态文本
    const getJobStatusText = (status) => {
      const statusMap = {
        pending: '等待中',
        waiting: '等待中', // BullMQ 状态
        processing: '处理中',
        active: '处理中', // BullMQ 状态
        completed: '已完成',
        failed: '失败',
      }
      return statusMap[status] || status
    }

    // 获取任务状态样式类
    const getJobStatusClass = (status) => {
      const classMap = {
        pending: 'bg-yellow-100 text-yellow-700',
        waiting: 'bg-yellow-100 text-yellow-700', // BullMQ 状态
        processing: 'bg-blue-100 text-blue-700',
        active: 'bg-blue-100 text-blue-700', // BullMQ 状态
        completed: 'bg-green-100 text-green-700',
        failed: 'bg-red-100 text-red-700',
      }
      return classMap[status] || 'bg-gray-100 text-gray-700'
    }

    onMounted(async () => {
      // 直接加载配置，食堂名称从管理员信息中获取
      await loadConfig()
      // 如果是全局管理员，加载食堂列表
      await loadCanteenList()
    })

    onActivated(async () => {
      await loadConfig()
      // 如果是全局管理员，加载食堂列表
      await loadCanteenList()
    })

    onBeforeUnmount(() => {
      // 组件卸载时停止轮询
      stopPolling()
    })

    return {
      loading,
      loadError,
      reviewSaving,
      reviewSaveSuccess,
      commentSaving,
      commentSaveSuccess,
      reviewAutoApprove,
      commentAutoApprove,
      configItems,
      handleReviewAutoApproveChange,
      handleCommentAutoApproveChange,
      authStore,
      configDescription,
      currentCanteenInfo,
      toggleSwitchClass,
      // 菜品嵌入刷新相关
      embeddingRefreshing,
      embeddingRefreshSuccess,
      currentJobId,
      jobStatus,
      handleRefreshCanteenEmbeddings,
      getJobStatusText,
      getJobStatusClass,
      stopPolling,
      // 食堂选择相关
      canteenList,
      loadingCanteens,
      selectedCanteenId,
      currentCanteenId,
    }
  },
}
</script>

<style scoped>
.container-shadow {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>

