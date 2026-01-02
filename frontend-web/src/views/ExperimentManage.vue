<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'">
        <div class="flex justify-between items-center mb-6">
          <Header
            title="推荐配置管理"
            description="管理推荐系统的A/B测试实验配置"
            header-icon="carbon:experiment"
          />
          <button
            class="px-6 py-2 text-white rounded-lg transition duration-200 flex items-center"
            :class="authStore.hasPermission('experiment:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('experiment:create') ? null : createNewExperiment()"
            :title="!authStore.hasPermission('experiment:create') ? '无权限创建' : '创建新实验'"
          >
            <span class="iconify mr-1" data-icon="carbon:add"></span>
            新建实验
          </button>
        </div>

        <!-- 搜索栏 -->
        <div class="mb-6">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索实验名称..."
            class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
          />
        </div>

        <!-- 实验列表表格 -->
        <div v-if="loading" class="text-center py-12">
          <span class="iconify text-4xl text-gray-300 animate-spin" data-icon="carbon:circle-dash"></span>
          <p class="mt-4 text-gray-500">加载中...</p>
        </div>

        <div v-else class="overflow-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">实验名称</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">创建时间</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">开始日期</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">状态</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">流量占比</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">组数</th>
                <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="experiment in filteredExperiments" :key="experiment.id" class="hover:bg-gray-50">
                <td class="py-4 px-6">
                  <div class="font-medium">{{ experiment.name }}</div>
                  <div v-if="experiment.description" class="text-xs text-gray-500 mt-1">
                    {{ experiment.description }}
                  </div>
                </td>
                <td class="py-4 px-6 text-sm text-gray-500">
                  {{ formatDate(experiment.createdAt) }}
                </td>
                <td class="py-4 px-6 text-sm text-gray-500">
                  {{ formatDate(experiment.startTime) }}
                </td>
                <td class="py-4 px-6">
                  <span
                    class="px-2 py-1 text-xs rounded-full"
                    :class="getStatusClass(experiment.status)"
                  >
                    {{ getStatusLabel(experiment.status) }}
                  </span>
                </td>
                <td class="py-4 px-6 text-sm">
                  {{ (experiment.trafficRatio * 100).toFixed(1) }}%
                </td>
                <td class="py-4 px-6 text-sm">
                  {{ experiment.groups?.length || 0 }}
                </td>
                <td class="py-4 px-6 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-2">
                    <button
                      class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                      @click.stop="viewExperiment(experiment)"
                      title="查看详情"
                    >
                      <span class="iconify" data-icon="carbon:view"></span>
                    </button>
                    <button
                      v-if="authStore.hasPermission('experiment:edit')"
                      class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                      @click.stop="editExperiment(experiment)"
                      title="编辑"
                    >
                      <span class="iconify" data-icon="carbon:edit"></span>
                    </button>
                    <button
                      v-if="authStore.hasPermission('experiment:delete')"
                      class="p-2 rounded-full hover:bg-gray-200 text-red-500"
                      @click.stop="deleteExperiment(experiment)"
                      title="删除"
                    >
                      <span class="iconify" data-icon="carbon:trash-can"></span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredExperiments.length === 0 && !loading" class="text-center py-12">
          <span
            class="iconify text-6xl text-gray-300 mx-auto"
            data-icon="carbon:experiment"
          ></span>
          <p class="mt-4 text-gray-500">暂无实验</p>
          <button
            v-if="authStore.hasPermission('experiment:create')"
            class="mt-4 px-6 py-2 text-white rounded-lg transition duration-200 bg-tsinghua-purple hover:bg-tsinghua-dark"
            @click="createNewExperiment()"
          >
            创建第一个实验
          </button>
        </div>
      </div>

      <!-- 详情视图 -->
      <div v-else-if="viewMode === 'detail'">
        <div class="flex justify-between items-center mb-6">
          <Header
            :title="currentExperiment?.name || '实验详情'"
            :description="currentExperiment?.description || '查看实验配置详情'"
            header-icon="carbon:experiment"
          />
          <button
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <div v-if="loading" class="text-center py-12">
          <span class="iconify text-4xl text-gray-300 animate-spin" data-icon="carbon:circle-dash"></span>
          <p class="mt-4 text-gray-500">加载中...</p>
        </div>

        <div v-else-if="currentExperiment" class="space-y-6">
          <!-- 基本信息 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span class="iconify text-tsinghua-purple" data-icon="carbon:information"></span>
              基本信息
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-600">实验名称</label>
                <p class="mt-1 text-gray-800">{{ currentExperiment.name }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-600">状态</label>
                <p class="mt-1">
                  <span
                    class="px-2 py-1 text-xs rounded-full"
                    :class="getStatusClass(currentExperiment.status)"
                  >
                    {{ getStatusLabel(currentExperiment.status) }}
                  </span>
                </p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-600">创建时间</label>
                <p class="mt-1 text-gray-800">{{ formatDate(currentExperiment.createdAt) }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-600">开始日期</label>
                <p class="mt-1 text-gray-800">{{ formatDate(currentExperiment.startTime) }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-600">结束日期</label>
                <p class="mt-1 text-gray-800">
                  {{ currentExperiment.endTime ? formatDate(currentExperiment.endTime) : '未设置' }}
                </p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-600">流量占比</label>
                <p class="mt-1 text-gray-800">{{ (currentExperiment.trafficRatio * 100).toFixed(1) }}%</p>
              </div>
              <div v-if="currentExperiment.description" class="col-span-2">
                <label class="text-sm font-medium text-gray-600">描述</label>
                <p class="mt-1 text-gray-800">{{ currentExperiment.description }}</p>
              </div>
            </div>
            <div class="mt-4 flex gap-2">
              <button
                v-if="authStore.hasPermission('experiment:edit')"
                class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition"
                @click="editExperiment(currentExperiment)"
              >
                编辑实验
              </button>
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'running'"
                class="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                @click="disableExperiment(currentExperiment)"
              >
                禁用实验
              </button>
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'paused'"
                class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                @click="enableExperiment(currentExperiment)"
              >
                启用实验
              </button>
            </div>
          </div>

          <!-- 实验分组列表 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span class="iconify text-tsinghua-purple" data-icon="carbon:group"></span>
                实验分组
              </h3>
            </div>
            <div class="space-y-4">
              <div
                v-for="(group, index) in currentExperiment.groups || []"
                :key="index"
                class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                @click="viewGroupDetail(group, index)"
              >
                <div class="flex justify-between items-center">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-medium text-gray-800">组 {{ index + 1 }}: {{ group.name }}</span>
                      <span class="px-2 py-1 text-xs rounded-full bg-tsinghua-purple/10 text-tsinghua-purple">
                        占比: {{ (group.ratio * 100).toFixed(1) }}%
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="authStore.hasPermission('experiment:edit')"
                      class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                      @click.stop="editGroup(group, index)"
                      title="编辑分组"
                    >
                      <span class="iconify" data-icon="carbon:edit"></span>
                    </button>
                    <button
                      v-if="authStore.hasPermission('experiment:edit')"
                      class="p-2 rounded-full hover:bg-gray-200 text-red-500"
                      @click.stop="deleteGroup(index)"
                      title="删除分组"
                    >
                      <span class="iconify" data-icon="carbon:trash-can"></span>
                    </button>
                    <span class="iconify text-gray-400" data-icon="carbon:chevron-right"></span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!currentExperiment.groups || currentExperiment.groups.length === 0" class="text-center py-8 text-gray-500">
              暂无实验分组
            </div>
          </div>
        </div>
      </div>

      <!-- 分组详情视图 -->
      <div v-else-if="viewMode === 'groupDetail'">
        <div class="flex justify-between items-center mb-6">
          <Header
            :title="`分组详情: ${currentGroup?.name || ''}`"
            description="查看分组配置的权重和召回配额"
            header-icon="carbon:settings"
          />
          <button
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="backToDetail"
          >
            返回详情
          </button>
        </div>

        <div v-if="currentGroup" class="space-y-6">
          <!-- 分组基本信息 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span class="iconify text-tsinghua-purple" data-icon="carbon:information"></span>
              分组信息
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-600">分组名称</label>
                <p class="mt-1 text-gray-800">{{ currentGroup.name }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-600">组内占比</label>
                <p class="mt-1 text-gray-800">{{ (currentGroup.ratio * 100).toFixed(1) }}%</p>
              </div>
            </div>
          </div>

          <!-- 权重配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span class="iconify text-tsinghua-purple" data-icon="carbon:weight"></span>
              权重配置 (Weights)
            </h3>
            <div v-if="currentGroup.config?.weights" class="space-y-3">
              <div
                v-for="(value, key) in currentGroup.config.weights"
                :key="key"
                class="flex justify-between items-center py-2 border-b border-gray-100"
              >
                <span class="text-sm font-medium text-gray-600">{{ getWeightLabel(key) }}</span>
                <span class="text-sm text-gray-800 font-mono">{{ value }}</span>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-500">
              未配置权重
            </div>
          </div>

          <!-- 召回配额配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span class="iconify text-tsinghua-purple" data-icon="carbon:chart-line"></span>
              召回配额配置 (Recall Quota)
            </h3>
            <div v-if="currentGroup.config?.recallQuota" class="space-y-3">
              <div
                v-for="(value, key) in currentGroup.config.recallQuota"
                :key="key"
                class="flex justify-between items-center py-2 border-b border-gray-100"
              >
                <span class="text-sm font-medium text-gray-600">{{ getRecallQuotaLabel(key) }}</span>
                <span class="text-sm text-gray-800 font-mono">{{ (value * 100).toFixed(1) }}%</span>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-500">
              未配置召回配额
            </div>
          </div>
        </div>
      </div>

      <!-- 创建/编辑视图 -->
      <div v-else-if="viewMode === 'edit'">
        <div class="flex justify-between items-center mb-6">
          <Header
            :title="editingExperiment ? '编辑实验' : '创建实验'"
            :description="editingExperiment ? '修改实验配置' : '创建新的A/B测试实验'"
            header-icon="carbon:experiment"
          />
          <button
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <form class="space-y-6" @submit.prevent="submitForm">
          <!-- 基本信息 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">基本信息</h3>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="block text-gray-700 font-medium mb-2">
                  实验名称 <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  v-model="formData.name"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  :class="{ 'border-red-400 bg-red-50': errors.name }"
                  placeholder="请输入实验名称"
                  required
                />
                <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2">描述</label>
                <input
                  type="text"
                  v-model="formData.description"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  placeholder="请输入实验描述（可选）"
                />
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2">
                  流量占比 <span class="text-red-500">*</span>
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    v-model.number="formData.trafficRatio"
                    min="0"
                    max="1"
                    step="0.01"
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                    :class="{ 'border-red-400 bg-red-50': errors.trafficRatio }"
                    placeholder="0.1"
                    required
                  />
                  <span class="text-gray-500">(0-1之间的小数)</span>
                </div>
                <p v-if="errors.trafficRatio" class="mt-1 text-xs text-red-500">{{ errors.trafficRatio }}</p>
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2">
                  开始日期 <span class="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  v-model="formData.startTime"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  :class="{ 'border-red-400 bg-red-50': errors.startTime }"
                  required
                />
                <p v-if="errors.startTime" class="mt-1 text-xs text-red-500">{{ errors.startTime }}</p>
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2">结束日期</label>
                <input
                  type="datetime-local"
                  v-model="formData.endTime"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  placeholder="可选"
                />
              </div>
            </div>
          </div>

          <!-- 实验分组 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-800">实验分组</h3>
              <button
                type="button"
                class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition"
                @click="addGroup"
              >
                <span class="iconify mr-1" data-icon="carbon:add"></span>
                添加分组
              </button>
            </div>
            <div class="space-y-4">
              <div
                v-for="(group, index) in formData.groups"
                :key="index"
                class="border border-gray-200 rounded-lg p-4"
              >
                <div class="flex justify-between items-center mb-4">
                  <h4 class="font-medium text-gray-800">分组 {{ index + 1 }}</h4>
                  <button
                    type="button"
                    class="text-red-500 hover:text-red-700"
                    @click="removeGroup(index)"
                  >
                    <span class="iconify" data-icon="carbon:trash-can"></span>
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">
                      分组名称 <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      v-model="group.name"
                      class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                      placeholder="例如：对照组"
                      required
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">
                      组内占比 <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      v-model.number="group.ratio"
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                      placeholder="0.5"
                      required
                    />
                  </div>
                </div>
                <div class="mt-4">
                  <button
                    type="button"
                    class="text-sm text-tsinghua-purple hover:text-tsinghua-dark"
                    @click="editGroupConfig(group, index)"
                  >
                    配置权重和召回配额 →
                  </button>
                </div>
              </div>
            </div>
            <div v-if="formData.groups.length === 0" class="text-center py-8 text-gray-500">
              请至少添加一个实验分组
            </div>
          </div>

          <!-- 表单按钮 -->
          <div class="flex space-x-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isSubmitting"
            >
              <span class="iconify mr-1" data-icon="carbon:save"></span>
              {{ isSubmitting ? '提交中...' : editingExperiment ? '保存修改' : '创建实验' }}
            </button>
            <button
              type="button"
              class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
              @click="backToList"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { experimentApi } from '@/api/modules/experiment'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import { showAlert, showConfirmDanger } from '@/composables/useModal'
import type {
  Experiment,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  ExperimentGroup,
  ExperimentConfig,
} from '@/types/api'

export default {
  name: 'ExperimentManage',
  components: {
    Header,
  },
  setup() {
    const authStore = useAuthStore()
    const loading = ref(false)
    const isSubmitting = ref(false)
    const viewMode = ref('list') // 'list' | 'detail' | 'edit' | 'groupDetail'
    const experimentList = ref<Experiment[]>([])
    const currentExperiment = ref<Experiment | null>(null)
    const currentGroup = ref<ExperimentGroup | null>(null)
    const currentGroupIndex = ref(-1)
    const editingExperiment = ref<Experiment | null>(null)
    const searchQuery = ref('')

    const formData = reactive<CreateExperimentRequest>({
      name: '',
      description: '',
      trafficRatio: 0.1,
      startTime: '',
      endTime: '',
      groups: [],
    })

    const errors = reactive({
      name: '',
      trafficRatio: '',
      startTime: '',
    })

    // 过滤后的实验列表
    const filteredExperiments = computed(() => {
      if (!searchQuery.value) {
        return experimentList.value
      }
      const query = searchQuery.value.toLowerCase()
      return experimentList.value.filter(
        (exp) =>
          exp.name.toLowerCase().includes(query) ||
          (exp.description && exp.description.toLowerCase().includes(query))
      )
    })

    // 加载实验列表
    const loadExperiments = async () => {
      loading.value = true
      try {
        const response = await experimentApi.getExperiments()
        if (response.code === 200) {
          experimentList.value = response.data || []
        } else {
          await showAlert(response.message || '加载实验列表失败', '错误')
        }
      } catch (error) {
        console.error('加载实验列表失败:', error)
        await showAlert('加载实验列表失败，请稍后重试', '错误')
      } finally {
        loading.value = false
      }
    }

    // 加载实验详情
    const loadExperimentDetail = async (id: string) => {
      loading.value = true
      try {
        const response = await experimentApi.getExperimentById(id)
        if (response.code === 200) {
          currentExperiment.value = response.data
        } else {
          await showAlert(response.message || '加载实验详情失败', '错误')
        }
      } catch (error) {
        console.error('加载实验详情失败:', error)
        await showAlert('加载实验详情失败，请稍后重试', '错误')
      } finally {
        loading.value = false
      }
    }

    // 格式化日期
    const formatDate = (date: string | Date | undefined) => {
      if (!date) return '-'
      const d = new Date(date)
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    // 获取状态标签
    const getStatusLabel = (status: string | undefined) => {
      const statusMap: Record<string, string> = {
        draft: '草稿',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成',
      }
      return statusMap[status || 'draft'] || status || '未知'
    }

    // 获取状态样式
    const getStatusClass = (status: string | undefined) => {
      const classMap: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-700',
        running: 'bg-green-100 text-green-700',
        paused: 'bg-yellow-100 text-yellow-700',
        completed: 'bg-blue-100 text-blue-700',
      }
      return classMap[status || 'draft'] || 'bg-gray-100 text-gray-700'
    }

    // 获取权重标签
    const getWeightLabel = (key: string) => {
      const labelMap: Record<string, string> = {
        preferenceMatch: '偏好匹配',
        favoriteSimilarity: '收藏相似度',
        browseRelevance: '浏览相关性',
        dishQuality: '菜品质量',
        diversity: '多样性',
        searchRelevance: '搜索相关性',
      }
      return labelMap[key] || key
    }

    // 获取召回配额标签
    const getRecallQuotaLabel = (key: string) => {
      const labelMap: Record<string, string> = {
        vectorQuota: '向量召回配额',
        ruleQuota: '规则召回配额',
        collaborativeQuota: '协同过滤召回配额',
      }
      return labelMap[key] || key
    }

    // 查看实验详情
    const viewExperiment = async (experiment: Experiment) => {
      await loadExperimentDetail(experiment.id)
      viewMode.value = 'detail'
    }

    // 创建新实验
    const createNewExperiment = () => {
      editingExperiment.value = null
      resetForm()
      viewMode.value = 'edit'
    }

    // 编辑实验
    const editExperiment = async (experiment: Experiment) => {
      await loadExperimentDetail(experiment.id)
      if (currentExperiment.value) {
        editingExperiment.value = currentExperiment.value
        formData.name = currentExperiment.value.name
        formData.description = currentExperiment.value.description || ''
        formData.trafficRatio = currentExperiment.value.trafficRatio
        formData.startTime = formatDateTimeLocal(currentExperiment.value.startTime)
        formData.endTime = currentExperiment.value.endTime
          ? formatDateTimeLocal(currentExperiment.value.endTime)
          : ''
        formData.groups = JSON.parse(JSON.stringify(currentExperiment.value.groups || []))
        viewMode.value = 'edit'
      }
    }

    // 格式化日期时间到本地格式
    const formatDateTimeLocal = (date: string | Date) => {
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    // 删除实验
    const deleteExperiment = async (experiment: Experiment) => {
      const confirmed = await showConfirmDanger(
        `确定要删除实验"${experiment.name}"吗？此操作不可恢复。`,
        '确认删除'
      )
      if (!confirmed) return

      try {
        const response = await experimentApi.deleteExperiment(experiment.id)
        if (response.code === 200) {
          await showAlert('实验已删除', '成功')
          await loadExperiments()
        } else {
          await showAlert(response.message || '删除实验失败', '错误')
        }
      } catch (error) {
        console.error('删除实验失败:', error)
        await showAlert('删除实验失败，请稍后重试', '错误')
      }
    }

    // 启用实验
    const enableExperiment = async (experiment: Experiment) => {
      try {
        const response = await experimentApi.enableExperiment(experiment.id)
        if (response.code === 200) {
          await showAlert('实验已启用', '成功')
          await loadExperimentDetail(experiment.id)
        } else {
          await showAlert(response.message || '启用实验失败', '错误')
        }
      } catch (error) {
        console.error('启用实验失败:', error)
        await showAlert('启用实验失败，请稍后重试', '错误')
      }
    }

    // 禁用实验
    const disableExperiment = async (experiment: Experiment) => {
      const confirmed = await showConfirmDanger(`确定要禁用实验"${experiment.name}"吗？`, '确认禁用')
      if (!confirmed) return

      try {
        const response = await experimentApi.disableExperiment(experiment.id)
        if (response.code === 200) {
          await showAlert('实验已禁用', '成功')
          await loadExperimentDetail(experiment.id)
        } else {
          await showAlert(response.message || '禁用实验失败', '错误')
        }
      } catch (error) {
        console.error('禁用实验失败:', error)
        await showAlert('禁用实验失败，请稍后重试', '错误')
      }
    }

    // 查看分组详情
    const viewGroupDetail = (group: ExperimentGroup, index: number) => {
      currentGroup.value = group
      currentGroupIndex.value = index
      viewMode.value = 'groupDetail'
    }

    // 编辑分组
    const editGroup = (group: ExperimentGroup, index: number) => {
      // 这里可以打开一个编辑分组的对话框或跳转到编辑页面
      // 暂时先显示分组详情
      viewGroupDetail(group, index)
    }

    // 删除分组
    const deleteGroup = async (index: number) => {
      if (!currentExperiment.value) return

      const confirmed = await showConfirmDanger(
        `确定要删除分组"${currentExperiment.value.groups[index]?.name}"吗？`,
        '确认删除'
      )
      if (!confirmed) return

      // 从当前实验中删除分组
      if (currentExperiment.value.groups) {
        currentExperiment.value.groups.splice(index, 1)
      }

      // 更新实验
      try {
        const updateData: UpdateExperimentRequest = {
          groups: currentExperiment.value.groups,
        }
        const response = await experimentApi.updateExperiment(currentExperiment.value.id, updateData)
        if (response.code === 200) {
          await showAlert('分组已删除', '成功')
          await loadExperimentDetail(currentExperiment.value.id)
        } else {
          await showAlert(response.message || '删除分组失败', '错误')
        }
      } catch (error) {
        console.error('删除分组失败:', error)
        await showAlert('删除分组失败，请稍后重试', '错误')
      }
    }

    // 添加分组
    const addGroup = () => {
      formData.groups.push({
        name: '',
        ratio: 0.5,
        config: {},
      })
    }

    // 删除分组（表单中）
    const removeGroup = (index: number) => {
      formData.groups.splice(index, 1)
    }

    // 编辑分组配置
    const editGroupConfig = (group: ExperimentGroup, index: number) => {
      // 这里可以打开一个配置对话框
      // 暂时提示用户可以在创建后编辑
      showAlert('分组配置（权重和召回配额）可以在创建实验后通过编辑分组来配置', '提示')
    }

    // 重置表单
    const resetForm = () => {
      formData.name = ''
      formData.description = ''
      formData.trafficRatio = 0.1
      formData.startTime = ''
      formData.endTime = ''
      formData.groups = []
      Object.keys(errors).forEach((key) => {
        errors[key] = ''
      })
    }

    // 提交表单
    const submitForm = async () => {
      // 验证表单
      let hasError = false
      
      // 确保数值字段是数字类型
      const trafficRatio = Number(formData.trafficRatio)
      if (isNaN(trafficRatio) || trafficRatio <= 0 || trafficRatio > 1) {
        errors.trafficRatio = '流量占比必须在0到1之间'
        hasError = true
      }
      
      if (!formData.name || !formData.name.trim()) {
        errors.name = '请输入实验名称'
        hasError = true
      }
      
      if (!formData.startTime) {
        errors.startTime = '请选择开始日期'
        hasError = true
      }

      if (formData.endTime && formData.startTime) {
        const start = new Date(formData.startTime)
        const end = new Date(formData.endTime)
        if (end <= start) {
          await showAlert('结束日期必须晚于开始日期', '错误')
          hasError = true
        }
      }
      
      if (formData.groups.length === 0) {
        await showAlert('请至少添加一个实验分组', '错误')
        hasError = true
      }

      // 验证每个分组都有名称和有效的占比
      for (let i = 0; i < formData.groups.length; i++) {
        const group = formData.groups[i]
        if (!group.name || !group.name.trim()) {
          await showAlert(`分组 ${i + 1} 缺少名称`, '错误')
          hasError = true
          break
        }
        const ratio = Number(group.ratio)
        if (isNaN(ratio) || ratio < 0 || ratio > 1) {
          await showAlert(`分组 ${i + 1} 的占比必须在0到1之间`, '错误')
          hasError = true
          break
        }
      }

      // 验证分组占比总和
      const totalRatio = formData.groups.reduce((sum, group) => {
        const ratio = Number(group.ratio) || 0
        return sum + ratio
      }, 0)
      if (Math.abs(totalRatio - 1) > 0.01) {
        await showAlert(`分组占比总和应为1，当前为${totalRatio.toFixed(2)}`, '错误')
        hasError = true
      }

      if (hasError) return

      isSubmitting.value = true
      try {
        if (editingExperiment.value) {
          // 更新实验
          const updateData: UpdateExperimentRequest = {
            name: formData.name,
            description: formData.description,
            trafficRatio: formData.trafficRatio,
            startTime: new Date(formData.startTime).toISOString(),
            endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
            groups: formData.groups,
          }
          const response = await experimentApi.updateExperiment(editingExperiment.value.id, updateData)
          if (response.code === 200) {
            await showAlert('实验已更新', '成功')
            await loadExperiments()
            viewMode.value = 'list'
          } else {
            await showAlert(response.message || '更新实验失败', '错误')
          }
        } else {
          // 创建实验
          // 确保groups数组中的每个对象都有必要的字段，并确保数据类型正确
          const groups = formData.groups.map((group, index) => {
            // 确保 ratio 是有效的数字
            const ratioValue = typeof group.ratio === 'number' 
              ? group.ratio 
              : parseFloat(String(group.ratio || 0))
            
            if (isNaN(ratioValue)) {
              throw new Error(`分组 ${index + 1} 的占比必须是有效的数字`)
            }

            // 只包含后端期望的字段，确保类型正确
            const groupData: {
              name: string
              ratio: number
              config?: Record<string, any>
            } = {
              name: String(group.name || '').trim(),
              ratio: ratioValue,
            }
            
            // 只有当config存在且不为空对象时才添加
            if (group.config && typeof group.config === 'object' && Object.keys(group.config).length > 0) {
              groupData.config = group.config
            }
            
            return groupData
          })

          // 验证每个分组都有名称
          const invalidGroups = groups.filter((g) => !g.name || !g.name.trim())
          if (invalidGroups.length > 0) {
            await showAlert('请为所有分组填写名称', '错误')
            return
          }

          // 确保 trafficRatio 是有效的数字
          const trafficRatioValue = typeof formData.trafficRatio === 'number'
            ? formData.trafficRatio
            : parseFloat(String(formData.trafficRatio || 0))
          
          if (isNaN(trafficRatioValue)) {
            errors.trafficRatio = '流量占比必须是有效的数字'
            return
          }

          // 构建请求数据，确保只包含后端期望的字段，且类型正确
          const createData: CreateExperimentRequest = {
            name: String(formData.name || '').trim(),
            trafficRatio: trafficRatioValue,
            startTime: new Date(formData.startTime).toISOString(),
            groups: groups,
          }

          // 只有当description有值时才添加
          const description = formData.description?.trim()
          if (description) {
            createData.description = description
          }

          // 只有当endTime有值时才添加
          if (formData.endTime) {
            createData.endTime = new Date(formData.endTime).toISOString()
          }

          // 最终清理：确保只包含后端期望的字段，移除任何可能的额外属性
          const cleanedData: CreateExperimentRequest = {
            name: createData.name,
            trafficRatio: createData.trafficRatio,
            startTime: createData.startTime,
            groups: createData.groups.map((g) => ({
              name: g.name,
              ratio: g.ratio,
              ...(g.config ? { config: g.config } : {}),
            })),
          }
          
          if (createData.description) {
            cleanedData.description = createData.description
          }
          
          if (createData.endTime) {
            cleanedData.endTime = createData.endTime
          }

          console.log('发送的创建实验数据:', JSON.stringify(cleanedData, null, 2))
          console.log('数据类型检查:', {
            name: typeof cleanedData.name,
            trafficRatio: typeof cleanedData.trafficRatio,
            startTime: typeof cleanedData.startTime,
            groups: cleanedData.groups.map(g => ({
              name: typeof g.name,
              ratio: typeof g.ratio,
            })),
          })

          const response = await experimentApi.createExperiment(cleanedData)
          if (response.code === 200 || response.code === 201) {
            await showAlert('实验已创建', '成功')
            await loadExperiments()
            viewMode.value = 'list'
          } else {
            await showAlert(response.message || '创建实验失败', '错误')
          }
        }
      } catch (error: any) {
        console.error('提交表单失败:', error)
        let errorMessage = error?.response?.data?.message || error?.message || '操作失败，请稍后重试'
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage.join('; ')
        }
        await showAlert(errorMessage, '错误')
      } finally {
        isSubmitting.value = false
      }
    }

    // 返回列表
    const backToList = () => {
      viewMode.value = 'list'
      currentExperiment.value = null
      editingExperiment.value = null
      resetForm()
    }

    // 返回详情
    const backToDetail = () => {
      viewMode.value = 'detail'
      currentGroup.value = null
      currentGroupIndex.value = -1
    }

    onMounted(() => {
      loadExperiments()
    })

    return {
      authStore,
      loading,
      isSubmitting,
      viewMode,
      experimentList,
      filteredExperiments,
      currentExperiment,
      currentGroup,
      editingExperiment,
      searchQuery,
      formData,
      errors,
      formatDate,
      getStatusLabel,
      getStatusClass,
      getWeightLabel,
      getRecallQuotaLabel,
      viewExperiment,
      createNewExperiment,
      editExperiment,
      deleteExperiment,
      enableExperiment,
      disableExperiment,
      viewGroupDetail,
      editGroup,
      deleteGroup,
      addGroup,
      removeGroup,
      editGroupConfig,
      submitForm,
      backToList,
      backToDetail,
    }
  },
}
</script>

