<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="系统配置管理"
        :description="configDescription"
        header-icon="carbon:settings"
      />

      <!-- 食堂信息提示 -->
      <div v-if="currentCanteenInfo" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-center gap-2">
          <span class="iconify text-blue-600" data-icon="carbon:location"></span>
          <span class="text-sm font-medium text-blue-800">
            {{ currentCanteenInfo }}
          </span>
        </div>
      </div>

      <div class="mt-8">
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
                  :disabled="!authStore.hasPermission('config:edit') || isSaving"
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

              <div v-if="isSaving" class="flex items-center gap-2 text-sm text-gray-500">
                <span class="iconify animate-spin" data-icon="carbon:circle-dash"></span>
                <span>保存中...</span>
              </div>
              <div v-else-if="saveSuccess" class="flex items-center gap-2 text-sm text-green-600">
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
                  :disabled="!authStore.hasPermission('config:edit') || isSaving"
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

              <div v-if="isSaving" class="flex items-center gap-2 text-sm text-gray-500">
                <span class="iconify animate-spin" data-icon="carbon:circle-dash"></span>
                <span>保存中...</span>
              </div>
              <div v-else-if="saveSuccess" class="flex items-center gap-2 text-sm text-green-600">
                <span class="iconify" data-icon="carbon:checkmark-filled"></span>
                <span>保存成功</span>
              </div>
            </div>

            <div v-if="!authStore.hasPermission('config:edit')" class="mt-2 text-xs text-gray-500">
              <span class="iconify" data-icon="carbon:information"></span>
              您没有编辑配置的权限
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-if="!loading && configItems.length === 0" class="text-center py-12">
            <span class="iconify text-6xl text-gray-300 mx-auto" data-icon="carbon:settings"></span>
            <p class="mt-4 text-gray-500">暂无配置项</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { configApi } from '@/api/modules/config'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'ConfigManage',
  components: {
    Header,
  },
  setup() {
    const authStore = useAuthStore()
    const loading = ref(false)
    const isSaving = ref(false)
    const saveSuccess = ref(false)
    const reviewAutoApprove = ref(false)
    const commentAutoApprove = ref(false)
    const configItems = ref([])

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
        } else {
          throw new Error(response.message || '获取配置失败')
        }
      } catch (error) {
        console.error('加载配置失败:', error)
        alert('加载配置失败，请刷新重试')
      } finally {
        loading.value = false
      }
    }

    // 处理评价自动审核配置变更
    const handleReviewAutoApproveChange = async () => {
      if (!authStore.hasPermission('config:edit')) {
        alert('您没有编辑配置的权限')
        reviewAutoApprove.value = !reviewAutoApprove.value // 恢复原值
        return
      }

      isSaving.value = true
      saveSuccess.value = false

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
          saveSuccess.value = true
          // 3秒后隐藏成功提示
          setTimeout(() => {
            saveSuccess.value = false
          }, 3000)
        } else {
          throw new Error(response.message || '保存配置失败')
        }
      } catch (error) {
        console.error('保存配置失败:', error)
        alert(error instanceof Error ? error.message : '保存配置失败，请重试')
        // 恢复原值
        await loadConfig()
      } finally {
        isSaving.value = false
      }
    }

    // 处理评论自动审核配置变更
    const handleCommentAutoApproveChange = async () => {
      if (!authStore.hasPermission('config:edit')) {
        alert('您没有编辑配置的权限')
        commentAutoApprove.value = !commentAutoApprove.value // 恢复原值
        return
      }

      isSaving.value = true
      saveSuccess.value = false

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
          saveSuccess.value = true
          // 3秒后隐藏成功提示
          setTimeout(() => {
            saveSuccess.value = false
          }, 3000)
        } else {
          throw new Error(response.message || '保存配置失败')
        }
      } catch (error) {
        console.error('保存配置失败:', error)
        alert(error instanceof Error ? error.message : '保存配置失败，请重试')
        // 恢复原值
        await loadConfig()
      } finally {
        isSaving.value = false
      }
    }

    onMounted(async () => {
      // 直接加载配置，食堂名称从管理员信息中获取
      await loadConfig()
    })

    return {
      loading,
      isSaving,
      saveSuccess,
      reviewAutoApprove,
      commentAutoApprove,
      configItems,
      handleReviewAutoApproveChange,
      handleCommentAutoApproveChange,
      authStore,
      configDescription,
      currentCanteenInfo,
      toggleSwitchClass,
    }
  },
}
</script>

<style scoped>
.container-shadow {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>

