<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="系统配置管理"
        description="管理系统全局配置项"
        header-icon="carbon:settings"
      />

      <div class="mt-8">
        <!-- 加载状态 -->
        <div v-if="loading" class="text-center py-12">
          <span class="iconify text-4xl text-gray-300 animate-spin" data-icon="carbon:circle-dash"></span>
          <p class="mt-4 text-gray-500">加载中...</p>
        </div>

        <!-- 配置表单 -->
        <div v-else class="space-y-6">
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
                  class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-tsinghua-purple/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-tsinghua-purple"
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
    const commentAutoApprove = ref(false)
    const configItems = ref([])

    // 加载全局配置
    const loadGlobalConfig = async () => {
      loading.value = true
      try {
        const response = await configApi.getGlobalConfig()
        if (response.code === 200 && response.data) {
          const { config, templates } = response.data

          // 查找评论自动审核配置项
          const commentAutoApproveKey = 'comment.autoApprove'
          const commentAutoApproveItem = config?.items?.find(
            (item) => item.key === commentAutoApproveKey
          )

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
        const response = await configApi.updateGlobalConfig({
          key: 'comment.autoApprove',
          value: commentAutoApprove.value ? 'true' : 'false',
        })

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
        await loadGlobalConfig()
      } finally {
        isSaving.value = false
      }
    }

    onMounted(() => {
      loadGlobalConfig()
    })

    return {
      loading,
      isSaving,
      saveSuccess,
      commentAutoApprove,
      configItems,
      handleCommentAutoApproveChange,
      authStore,
    }
  },
}
</script>

<style scoped>
.container-shadow {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>

