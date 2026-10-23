<template>
  <div class="admin-page">
    <div class="admin-panel">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'">
        <div class="admin-heading-row">
          <Header
            title="推荐实验管理"
            description="管理推荐系统的A/B测试实验配置"
            header-icon="carbon:chemistry"
          />
          <button
            class="text-white transition duration-200 flex items-center admin-button"
            :class="authStore.hasPermission('experiment:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('experiment:create') ? null : createNewExperiment()"
            :title="!authStore.hasPermission('experiment:create') ? '无权限创建' : '创建新实验'"
          >
            <AppIcon class="iconify mr-1" icon="carbon:add"></AppIcon>
            新建实验
          </button>
        </div>

        <!-- 搜索栏 -->
        <div class="mb-6">
          <div class="relative">
            <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="搜索实验名称或描述..."
              class="w-full pl-10 pr-10 admin-input"
              @input="() => {}"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-icon-button"
              @click="searchQuery = ''"
              type="button"
              title="清除搜索"
            >
              <AppIcon class="iconify" icon="carbon:close"></AppIcon>
            </button>
          </div>
          <p v-if="searchQuery" class="mt-2 text-sm text-gray-500">
            找到 {{ filteredExperiments.length }} 个匹配的实验
          </p>
        </div>

        <!-- 实验列表表格 -->
        <div v-if="loading" class="admin-state">
          <AppIcon class="iconify text-4xl text-gray-300 animate-spin" icon="carbon:circle-dash"></AppIcon>
          <p class="mt-4 text-gray-500">加载中...</p>
        </div>

        <div v-else class="admin-table-scroll">
        <table class="admin-table">
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
                      class="rounded-full hover:bg-gray-200 text-tsinghua-purple admin-icon-button"
                      @click.stop="viewExperiment(experiment)"
                      title="查看详情"
                    >
                      <AppIcon class="iconify" icon="carbon:view"></AppIcon>
                    </button>
                    <button
                      v-if="authStore.hasPermission('experiment:edit') && experiment.status !== 'completed'"
                      class="rounded-full hover:bg-gray-200 text-tsinghua-purple admin-icon-button"
                      @click.stop="editExperiment(experiment)"
                      title="编辑"
                    >
                      <AppIcon class="iconify" icon="carbon:edit"></AppIcon>
                    </button>
                    <button
                      v-if="authStore.hasPermission('experiment:delete')"
                      class="rounded-full hover:bg-gray-200 text-red-500 admin-icon-button"
                      @click.stop="deleteExperiment(experiment)"
                      title="删除"
                    >
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredExperiments.length === 0 && !loading" class="admin-state">
          <AppIcon
            class="iconify text-6xl text-gray-300 mx-auto"
            icon="carbon:chemistry"
          ></AppIcon>
          <p class="mt-4 text-gray-500">暂无实验</p>
          <button
            v-if="authStore.hasPermission('experiment:create')"
            class="mt-4 transition duration-200 admin-button admin-button-primary"
            @click="createNewExperiment()"
          >
            创建第一个实验
          </button>
        </div>
      </div>

      <!-- 详情视图 -->
      <div v-else-if="viewMode === 'detail'">
        <div class="admin-heading-row">
          <Header
            :title="currentExperiment?.name || '实验详情'"
            :description="currentExperiment?.description || '查看实验配置详情'"
            header-icon="carbon:chemistry"
          />
          <button
            class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <div v-if="loading" class="admin-state">
          <AppIcon class="iconify text-4xl text-gray-300 animate-spin" icon="carbon:circle-dash"></AppIcon>
          <p class="mt-4 text-gray-500">加载中...</p>
        </div>

        <div v-else-if="currentExperiment" class="space-y-6">
          <!-- 基本信息 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AppIcon class="iconify text-tsinghua-purple" icon="carbon:information"></AppIcon>
              基本信息
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="font-medium text-gray-600 admin-label">实验名称</label>
                <p class="mt-1 text-gray-800">{{ currentExperiment.name }}</p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">状态</label>
                <p class="mt-1">
                  <span
                    class="px-2 py-1 text-xs rounded-full"
                    :class="getStatusClass(currentExperiment.status)"
                  >
                    {{ getStatusLabel(currentExperiment.status) }}
                  </span>
                  <span 
                    v-if="getEffectiveStatus(currentExperiment)" 
                    class="ml-2 text-xs"
                    :class="getEffectiveStatus(currentExperiment) === 'active' ? 'text-green-600' : 'text-gray-500'"
                  >
                    {{ getEffectiveStatus(currentExperiment) === 'active' ? '✓ 实验生效中' : '(未在生效时间内)' }}
                  </span>
                </p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">推荐场景</label>
                <p class="mt-1 text-gray-800">{{ currentExperiment.scene || 'home' }}</p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">优先级</label>
                <p class="mt-1 text-gray-800">{{ currentExperiment.priority || 0 }}</p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">创建时间</label>
                <p class="mt-1 text-gray-800">{{ formatDate(currentExperiment.createdAt) }}</p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">生效开始时间</label>
                <p class="mt-1 text-gray-800">{{ formatDate(currentExperiment.startTime) }}</p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">生效结束时间</label>
                <p class="mt-1 text-gray-800">
                  {{ currentExperiment.endTime ? formatDate(currentExperiment.endTime) : '永久有效' }}
                </p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">流量占比</label>
                <p class="mt-1 text-gray-800">{{ (currentExperiment.trafficRatio * 100).toFixed(1) }}%</p>
              </div>
              <div v-if="currentExperiment.description" class="col-span-2">
                <label class="font-medium text-gray-600 admin-label">描述</label>
                <p class="mt-1 text-gray-800">{{ currentExperiment.description }}</p>
              </div>
            </div>
            <div class="mt-4 admin-actions">
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status !== 'completed'"
                class="transition admin-button admin-button-primary"
                @click="editExperiment(currentExperiment)"
              >
                编辑实验
              </button>
              <!-- 草稿状态：可以启动 -->
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'draft'"
                class="transition admin-button admin-button-secondary"
                @click="enableExperiment(currentExperiment)"
              >
                启动实验
              </button>
              <!-- 运行中状态：可以暂停或完成 -->
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'running'"
                class="transition admin-button admin-button-secondary"
                @click="disableExperiment(currentExperiment)"
              >
                暂停实验
              </button>
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'running'"
                class="transition admin-button admin-button-secondary"
                @click="completeExperiment(currentExperiment)"
              >
                完成实验
              </button>
              <!-- 暂停状态：可以恢复或完成 -->
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'paused'"
                class="transition admin-button admin-button-secondary"
                @click="enableExperiment(currentExperiment)"
              >
                恢复实验
              </button>
              <button
                v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'paused'"
                class="transition admin-button admin-button-secondary"
                @click="completeExperiment(currentExperiment)"
              >
                完成实验
              </button>
            </div>
          </div>

          <ExperimentMetrics :experiment-id="currentExperiment.id" :groups="currentExperiment.groups" />
          <!-- 实验分组列表 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <AppIcon class="iconify text-tsinghua-purple" icon="carbon:group"></AppIcon>
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
                      v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'draft'"
                      class="rounded-full hover:bg-gray-200 text-tsinghua-purple admin-icon-button"
                      @click.stop="editGroup(group, index)"
                      title="编辑分组"
                    >
                      <AppIcon class="iconify" icon="carbon:edit"></AppIcon>
                    </button>
                    <button
                      v-if="authStore.hasPermission('experiment:edit') && currentExperiment.status === 'draft'"
                      class="rounded-full hover:bg-gray-200 text-red-500 admin-icon-button"
                      @click.stop="deleteGroup(index)"
                      title="删除分组"
                    >
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                    <AppIcon class="iconify text-gray-400" icon="carbon:chevron-right"></AppIcon>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!currentExperiment.groups || currentExperiment.groups.length === 0" class="admin-state">
              暂无实验分组
            </div>
          </div>
        </div>
      </div>

      <!-- 分组详情视图 -->
      <div v-else-if="viewMode === 'groupDetail'">
        <div class="admin-heading-row">
          <Header
            :title="`分组详情: ${currentGroup?.name || ''}`"
            description="查看分组配置的权重和召回配额"
            header-icon="carbon:settings"
          />
          <button
            class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
            @click="backToDetail"
          >
            返回详情
          </button>
        </div>

        <div v-if="currentGroup" class="space-y-6">
          <p v-if="currentGroup.strategyRevisionId">策略版本：{{ currentGroup.strategyRevisionId }}</p>
          <!-- 分组基本信息 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AppIcon class="iconify text-tsinghua-purple" icon="carbon:information"></AppIcon>
              分组信息
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="font-medium text-gray-600 admin-label">分组名称</label>
                <p class="mt-1 text-gray-800">{{ currentGroup.name }}</p>
              </div>
              <div>
                <label class="font-medium text-gray-600 admin-label">组内占比</label>
                <p class="mt-1 text-gray-800">{{ (currentGroup.ratio * 100).toFixed(1) }}%</p>
              </div>
            </div>
          </div>

          <!-- 权重配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AppIcon class="iconify text-tsinghua-purple" icon="carbon:weight"></AppIcon>
              相对权重 (Weights)
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
            <div v-else class="admin-state">
              未配置权重
            </div>
          </div>

          <!-- 召回配额配置 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AppIcon class="iconify text-tsinghua-purple" icon="carbon:chart-line"></AppIcon>
              召回配额配置 (Recall Quota)
            </h3>
            <div v-if="currentGroup.config?.recallQuota" class="space-y-3">
              <div
                v-for="(value, key) in currentGroup.config.recallQuota"
                :key="key"
                class="flex justify-between items-center py-2 border-b border-gray-100"
              >
                <span class="text-sm font-medium text-gray-600">{{ getRecallQuotaLabel(String(key)) }}</span>
                <span class="text-sm text-gray-800 font-mono">{{ formatPercentage(value) }}%</span>
              </div>
            </div>
            <div v-else class="admin-state">
              未配置召回配额
            </div>
          </div>
        </div>
      </div>

      <!-- 创建/编辑视图 -->
      <div v-else-if="viewMode === 'edit'">
        <div class="admin-heading-row">
          <Header
            :title="editingExperiment ? '编辑实验' : '创建实验'"
            :description="editingExperiment ? '修改实验配置' : '创建新的A/B测试实验'"
            header-icon="carbon:chemistry"
          />
          <button
            class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <form class="space-y-6" @submit.prevent="submitForm">
          <p v-if="groupsLocked" role="status">实验已发布，当前可调整总流量；分组策略和分组比例通过新实验更新。</p>
          <p v-if="sceneConflicts.length" role="status" class="text-amber-800">同场景运行实验：{{ sceneConflicts.map(item => `${item.name}（优先级 ${item.priority || 0}）`).join('、') }}。每次请求按优先级选择一个实验。</p>
          <!-- 基本信息 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">基本信息</h3>
        <div class="admin-form-grid">
              <label class="admin-label">推荐场景<select v-model="formData.scene" :disabled="groupsLocked" class="admin-input w-full"><option v-for="scene in recommendationScenes" :key="scene" :value="scene">{{ scene }}</option></select></label>
              <label class="admin-label">优先级<input v-model.number="formData.priority" :disabled="groupsLocked" type="number" step="1" class="admin-input w-full" /></label>
              <div>
                <label class="block text-gray-700 font-medium mb-2 admin-label">
                  实验名称 <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  v-model="formData.name"
                  :disabled="groupsLocked"
                  class="w-full admin-input"
                  :class="{ 'border-red-400 bg-red-50': errors.name }"
                  placeholder="请输入实验名称"
                  required
                />
                <p v-if="errors.name" class="mt-1 text-xs text-red-500 admin-field-error">{{ errors.name }}</p>
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2 admin-label">描述</label>
                <input
                  type="text"
                  v-model="formData.description"
                  :disabled="groupsLocked"
                  class="w-full admin-input"
                  placeholder="请输入实验描述（可选）"
                />
              </div>
              <div>
                <label for="experiment-traffic" class="block text-gray-700 font-medium mb-2 admin-label">
                  流量占比 <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                  <input
                    id="experiment-traffic"
                    type="number"
                    :value="percentageValue(formData.trafficRatio)"
                    @input="formData.trafficRatio = readPercentage($event)"
                    min="0"
                    max="100"
                    step="0.1"
                    class="w-full admin-input pr-10 percentage-input"
                    :class="{ 'border-red-400 bg-red-50': errors.trafficRatio }"
                    :aria-invalid="!!errors.trafficRatio"
                    aria-describedby="experiment-traffic-help experiment-traffic-error"
                    placeholder="例如 10"
                    required
                  />
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">%</span>
                </div>
                <p id="experiment-traffic-help" class="mt-2 text-sm text-gray-500">参与实验的用户比例，0% 表示暂不分配流量。</p>
                <p v-if="errors.trafficRatio" id="experiment-traffic-error" class="mt-1 text-xs text-red-500 admin-field-error">{{ errors.trafficRatio }}</p>
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2 admin-label">
                  生效开始时间 <span class="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  v-model="formData.startTime"
                  :disabled="groupsLocked"
                  class="w-full admin-input"
                  :class="{ 'border-red-400 bg-red-50': errors.startTime }"
                  required
                />
                <p v-if="errors.startTime" class="mt-1 text-xs text-red-500 admin-field-error">{{ errors.startTime }}</p>
                <p class="mt-1 text-xs text-gray-500">实验启动后，只有在此时间之后才会真正生效</p>
              </div>
              <div>
                <label class="block text-gray-700 font-medium mb-2 admin-label">生效结束时间</label>
                <input
                  type="datetime-local"
                  v-model="formData.endTime"
                  :disabled="groupsLocked"
                  class="w-full admin-input"
                  placeholder="可选"
                />
                <p class="mt-1 text-xs text-gray-500">留空表示永久有效，直到手动完成实验</p>
              </div>
            </div>
          </div>

          <!-- 实验分组 -->
          <fieldset :disabled="groupsLocked" class="border border-gray-200 rounded-lg p-6">
            <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div class="flex min-w-0 flex-wrap items-center gap-3">
                <h3 class="shrink-0 text-lg font-semibold text-gray-800">实验分组</h3>
                <span 
                  v-if="formData.groups.length > 0"
                  class="text-sm px-2 py-1 rounded"
                  :class="groupRatioStatus.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                >
                  占比总和: {{ groupRatioStatus.total.toFixed(2) }}
                  <span v-if="!groupRatioStatus.isValid">(应为1.00)</span>
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-if="formData.groups.length >= 2"
                  type="button"
                  class="border border-tsinghua-purple text-tsinghua-purple hover:bg-tsinghua-purple/10 transition admin-button"
                  @click="distributeGroupRatiosEvenly"
                  title="将所有分组占比均分"
                >
                  <AppIcon class="iconify mr-1" icon="carbon:distribute-horizontal-center"></AppIcon>
                  均分占比
                </button>
                <button
                  type="button"
                  class="transition admin-button admin-button-primary"
                  @click="addGroup"
                >
                  <AppIcon class="iconify mr-1" icon="carbon:add"></AppIcon>
                  添加分组
                </button>
              </div>
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
                    class="text-red-500 hover:text-red-700 admin-icon-button"
                    @click="removeGroup(index)"
                  >
                    <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                  </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-medium text-gray-600 mb-1 admin-label">
                      分组名称 <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      v-model="group.name"
                      class="w-full admin-input"
                      placeholder="例如：对照组"
                      required
                    />
                  </div>
                  <div>
                    <label :for="`group-ratio-${index}`" class="block font-medium text-gray-600 mb-1 admin-label">
                      组内占比 <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                      <input
                        :id="`group-ratio-${index}`"
                        type="number"
                        :value="percentageValue(group.ratio)"
                        @input="group.ratio = readPercentage($event)"
                        min="0"
                        max="100"
                        step="0.1"
                        class="w-full admin-input pr-10 percentage-input"
                        placeholder="例如 50"
                        required
                      />
                      <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">%</span>
                    </div>
                  </div>
                </div>
                <div class="mt-4">
                  <button
                    type="button"
                    class="text-tsinghua-purple hover:text-tsinghua-dark admin-button"
                    @click="editGroupConfig(group, index)"
                  >
                    {{ group.strategyRevisionId ? `策略：${group.strategyRevisionId}` : '配置策略 / 权重和召回配额' }}
                  </button>
                </div>
              </div>
            </div>
            <div v-if="formData.groups.length === 0" class="admin-state">
              请至少添加一个实验分组
            </div>
          </fieldset>

          <!-- 表单按钮 -->
          <div class="flex pt-6 border-t border-gray-200 admin-actions">
            <button
              type="submit"
              class="transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed admin-button admin-button-primary"
              :disabled="isSubmitting"
            >
              <AppIcon class="iconify mr-1" icon="carbon:save"></AppIcon>
              {{ isSubmitting ? '提交中...' : editingExperiment ? '保存修改' : '创建实验' }}
            </button>
            <button
              type="button"
              class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
              @click="backToList"
            >
              取消
            </button>
          </div>
        </form>
      </div>

      <!-- 分组配置编辑弹窗 -->
      <AdminDialog
        v-if="showGroupConfigModal"
        :open="showGroupConfigModal"
        label="分组配置"
        @close="closeGroupConfigModal"
      >
        <div class="w-[600px] max-h-[80vh] overflow-auto admin-dialog-panel">
          <div class="admin-dialog-header">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold text-gray-800">
                配置分组: {{ editingGroupData?.name || '新分组' }}
              </h3>
              <button
                class="hover:bg-gray-100 rounded-full admin-icon-button"
                @click="closeGroupConfigModal"
                aria-label="关闭分组配置"
              >
                <AppIcon class="iconify" icon="carbon:close"></AppIcon>
              </button>
            </div>
          </div>
          <div class="space-y-6 admin-dialog-body">
            <label class="admin-label block">配置来源<select v-model="selectedStrategy" class="admin-input w-full"><option value="">兼容配置：权重与召回配额</option><option v-for="strategy in groupStrategies" :key="strategy.id" :value="strategy.id">{{ strategy.name }} · {{ strategy.id }}</option></select></label>
            <p class="text-sm text-gray-600">策略版本和兼容配置互斥。分配记录保持用户组别稳定；分组比例主要影响新分配用户。</p>
            <fieldset v-if="!selectedStrategy" class="space-y-6">
            <!-- 权重配置 -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AppIcon class="iconify text-tsinghua-purple" icon="carbon:weight"></AppIcon>
                相对权重 (Weights)
              </h4>
              <div class="grid grid-cols-2 gap-4">
                <div v-for="(label, key) in weightLabels" :key="key">
                  <label class="block text-gray-600 mb-1 admin-label">{{ label }}</label>
                  <input
                    type="number"
                    v-model.number="groupConfigForm.weights[key]"
                    min="0"
                    step="0.01"
                    class="w-full admin-input"
                    placeholder="留空使用场景默认值"
                  />
                </div>
              </div>
            </div>
            <p class="mt-2 text-xs text-gray-500">权重按总和归一化；留空继承场景默认值，填写 0 关闭该项。</p>
            <!-- 召回配额配置 -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AppIcon class="iconify text-tsinghua-purple" icon="carbon:chart-line"></AppIcon>
                召回配额配置 (Recall Quota)
              </h4>
              <div class="grid grid-cols-2 gap-4">
                <div v-for="(label, key) in recallQuotaLabels" :key="key">
                  <label class="block text-gray-600 mb-1 admin-label">{{ label }}</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      v-model.number="groupConfigForm.recallQuota[key]"
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full admin-input"
                      placeholder="0.0 - 1.0"
                    />
                    <span class="text-gray-500 text-sm">×100%</span>
                  </div>
                </div>
              </div>
              <p class="mt-2 text-xs text-gray-500">
                召回配额全部留空时使用默认值；配置时请填写全部三项，关闭某一路填 0，总和为 1（{{ recallQuotaTotal.toFixed(2) }}）。
              </p>
            </div>
            </fieldset>
          </div>
          <div class="flex justify-end gap-3 admin-dialog-footer">
            <button
              class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition admin-button"
              @click="closeGroupConfigModal"
            >
              取消
            </button>
            <button
              class="transition admin-button admin-button-primary"
              @click="saveGroupConfig"
            >
              保存配置
            </button>
          </div>
        </div>
      </AdminDialog>
    </div>
  </div>
</template>

<script lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import ExperimentMetrics from '@/components/ExperimentMetrics.vue'
import { recommendationApi, recommendationScenes, type RecommendationStrategy } from '@/api/modules/recommendation'
import { experimentApi } from '@/api/modules/experiment'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import { showConfirmDanger } from '@/composables/useModal'
import { useNotification } from '@/composables/useNotification'
import type {
  Experiment,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  ExperimentGroup,
} from '@/types/api'

export default {
  name: 'ExperimentManage',
  components: {
    Header,
    ExperimentMetrics,
    AdminDialog,
  },
  setup() {
    const notify = useNotification()
    const authStore = useAuthStore()
    type ViewMode = 'list' | 'detail' | 'edit' | 'groupDetail'
    const loading = ref(false)
    const isSubmitting = ref(false)
    const viewMode = ref<ViewMode>('list')
    const experimentList = ref<Experiment[]>([])
    const currentExperiment = ref<Experiment | null>(null)
    const currentGroup = ref<ExperimentGroup | null>(null)
    const currentGroupIndex = ref(-1)
    const editingExperiment = ref<Experiment | null>(null)
    const searchQuery = ref('')
    const strategies = ref<RecommendationStrategy[]>([])
    const selectedStrategy = ref('')
    const groupsLocked = computed(() => !!editingExperiment.value && editingExperiment.value.status !== 'draft')
    const groupStrategies = computed(() => strategies.value.filter(item => item.status === 'published' && item.scene === (viewMode.value === 'edit' ? formData.scene : currentExperiment.value?.scene || 'home')))
    const sceneConflicts = computed(() => experimentList.value.filter(item => item.id !== editingExperiment.value?.id && item.status === 'running' && (item.scene || 'home') === formData.scene))

    const formData = reactive<CreateExperimentRequest>({
      name: '',
      scene: 'home',
      priority: 0,
      description: '',
      trafficRatio: 0.1,
      startTime: '',
      endTime: '',
      groups: [],
    })

    const percentageValue = (ratio: number): number | string =>
      Number.isFinite(ratio) ? Number((ratio * 100).toPrecision(12)) : ''
    const readPercentage = (event: Event): number => {
      const input = event.target as HTMLInputElement
      return input.value === '' ? Number.NaN : input.valueAsNumber / 100
    }

    const errors = reactive<Record<string, string>>({
      name: '',
      trafficRatio: '',
      startTime: '',
    })

    // 分组配置编辑相关
    const showGroupConfigModal = ref(false)
    const editingGroupIndex = ref(-1)
    const editingGroupData = ref<ExperimentGroup | null>(null)
    const groupConfigForm = reactive({
      weights: {
        preferenceMatch: '',
        favoriteSimilarity: '',
        browseRelevance: '',
        dishQuality: '',
        diversity: '',
        searchRelevance: '',
      } as Record<string, number | ''>,
      recallQuota: {
        vectorQuota: '',
        ruleQuota: '',
        collaborativeQuota: '',
      } as Record<string, number | ''>,
    })

    // 权重和召回配额的标签映射
    const weightLabels: Record<string, string> = {
      preferenceMatch: '偏好匹配',
      favoriteSimilarity: '收藏相似度',
      browseRelevance: '浏览相关性',
      dishQuality: '菜品质量',
      diversity: '多样性',
      searchRelevance: '搜索相关性',
    }

    const recallQuotaLabels: Record<string, string> = {
      vectorQuota: '向量召回配额',
      ruleQuota: '规则召回配额',
      collaborativeQuota: '协同过滤召回配额',
    }

    // 计算召回配额总和
    const recallQuotaTotal = computed(() => {
      return Object.values(groupConfigForm.recallQuota).reduce<number>((sum, val) => sum + (val || 0), 0)
    })

    // 计算分组占比总和和状态
    const groupRatioStatus = computed(() => {
      const total = formData.groups.reduce((sum, group) => {
        const ratio = Number(group.ratio) || 0
        return sum + ratio
      }, 0)
      return {
        total,
        isValid: Math.abs(total - 1) <= 0.01,
      }
    })

    // 均分分组占比
    const distributeGroupRatiosEvenly = () => {
      const count = formData.groups.length
      if (count === 0) return
      const ratio = Math.round((1 / count) * 100) / 100
      // 给每个分组分配相同的占比
      formData.groups.forEach((group, index) => {
        if (index === count - 1) {
          // 最后一个分组分配剩余的占比，确保总和为1
          group.ratio = Math.round((1 - ratio * (count - 1)) * 100) / 100
        } else {
          group.ratio = ratio
        }
      })
    }

    // 过滤后的实验列表
    const filteredExperiments = computed(() => {
      // 先过滤掉无效的实验项（没有 id 或 name 的）
      const validExperiments = experimentList.value.filter(
        (exp) => exp && exp.id && exp.name
      )
      
      const query = searchQuery.value?.trim().toLowerCase()
      if (!query) {
        return validExperiments
      }
      
      return validExperiments.filter(
        (exp) =>
          exp.name?.toLowerCase().includes(query) ||
          (exp.description && exp.description.toLowerCase().includes(query))
      )
    })

    // 加载实验列表
    const loadExperiments = async () => {
      loading.value = true
      try {
        const response = await experimentApi.getExperiments()
        if (response.code === 200) {
          // 后端返回的数据格式是 { items: [...], meta: {...} }
          const data = response.data as any
          if (data && Array.isArray(data.items)) {
            experimentList.value = data.items
          } else if (Array.isArray(data)) {
            // 兼容直接返回数组的情况
            experimentList.value = data
          } else {
            experimentList.value = []
            console.warn('实验列表数据格式异常:', data)
          }
        } else {
          await notify.error(response.message || '加载实验列表失败', '错误')
        }
      } catch (error) {
        console.error('加载实验列表失败:', error)
        await notify.error('加载实验列表失败，请稍后重试', '错误')
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
          await notify.error(response.message || '加载实验详情失败', '错误')
        }
      } catch (error) {
        console.error('加载实验详情失败:', error)
        await notify.error('加载实验详情失败，请稍后重试', '错误')
      } finally {
        loading.value = false
      }
    }

    // 格式化日期
    const formatDate = (date: string | Date | undefined) => {
      if (!date) return '-'
      const d = new Date(date)
      // 检查日期是否有效
      if (isNaN(d.getTime())) return '-'
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

    // 获取实验的实际生效状态
    // 实验只有在 status=running 且在时间窗口内才会真正生效
    const getEffectiveStatus = (experiment: Experiment) => {
      if (experiment.status !== 'running') {
        return null // 非运行状态不显示
      }
      const now = new Date()
      const startTime = new Date(experiment.startTime)
      const endTime = experiment.endTime ? new Date(experiment.endTime) : null
      
      // 检查是否在时间窗口内
      const afterStart = now >= startTime
      const beforeEnd = !endTime || now <= endTime
      
      if (afterStart && beforeEnd) {
        return 'active' // 实验正在生效
      }
      return 'inactive' // 实验虽然是 running 状态，但不在时间窗口内
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

    // 格式化百分比值（避免模板中的类型断言）
    const formatPercentage = (value: unknown): string => {
      if (value == null) return '0.0'
      const numValue = Number(value)
      if (isNaN(numValue)) return '0.0'
      return (numValue * 100).toFixed(1)
    }

    // 查看实验详情
    const viewExperiment = async (experiment: Experiment) => {
      if (!experiment.id) {
        await notify.error('无效的实验数据', '错误')
        return
      }
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
      if (experiment.status === 'completed') return
      if (!experiment.id) {
        await notify.error('无效的实验数据', '错误')
        return
      }
      await loadExperimentDetail(experiment.id)
      if (currentExperiment.value) {
        editingExperiment.value = currentExperiment.value
        formData.scene = currentExperiment.value.scene || 'home'
        formData.priority = currentExperiment.value.priority || 0
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
      // 检查日期是否有效
      if (isNaN(d.getTime())) return ''
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    // 删除实验
    const deleteExperiment = async (experiment: Experiment) => {
      if (!experiment.id) {
        await notify.error('无效的实验数据，无法删除', '错误')
        return
      }
      const confirmed = await showConfirmDanger(
        `确定要删除实验"${experiment.name}"吗？此操作不可恢复。`,
        '确认删除'
      )
      if (!confirmed) return

      try {
        const response = await experimentApi.deleteExperiment(experiment.id)
        if (response.code === 200) {
          await notify.success('实验已删除', '成功')
          await loadExperiments()
        } else {
          await notify.error(response.message || '删除实验失败', '错误')
        }
      } catch (error) {
        console.error('删除实验失败:', error)
        await notify.error('删除实验失败，请稍后重试', '错误')
      }
    }

    // 启用实验
    const enableExperiment = async (experiment: Experiment) => {
      const conflicts = experimentList.value.filter(item => item.id !== experiment.id && item.status === 'running' && (item.scene || 'home') === (experiment.scene || 'home'))
      if (conflicts.length && !await showConfirmDanger(`同场景已有运行实验：${conflicts.map(item => `${item.name}（优先级 ${item.priority || 0}）`).join('、')}。每次请求按优先级选择一个实验。当前实验优先级为 ${experiment.priority || 0}。`, '确认场景流量占用')) return
      try {
        const response = await experimentApi.enableExperiment(experiment.id)
        if (response.code === 200) {
          await notify.success('实验已启用', '成功')
          await loadExperimentDetail(experiment.id)
        } else {
          await notify.error(response.message || '启用实验失败', '错误')
        }
      } catch (error) {
        console.error('启用实验失败:', error)
        await notify.error('启用实验失败，请稍后重试', '错误')
      }
    }

    // 暂停实验
    const disableExperiment = async (experiment: Experiment) => {
      const confirmed = await showConfirmDanger(`确定要暂停实验"${experiment.name}"吗？`, '确认暂停')
      if (!confirmed) return

      try {
        const response = await experimentApi.disableExperiment(experiment.id)
        if (response.code === 200) {
          await notify.success('实验已暂停', '成功')
          await loadExperimentDetail(experiment.id)
        } else {
          await notify.error(response.message || '暂停实验失败', '错误')
        }
      } catch (error) {
        console.error('暂停实验失败:', error)
        await notify.error('暂停实验失败，请稍后重试', '错误')
      }
    }

    // 完成实验
    const completeExperiment = async (experiment: Experiment) => {
      const confirmed = await showConfirmDanger(
        `确定要将实验"${experiment.name}"标记为已完成吗？完成后实验将停止运行。`,
        '确认完成'
      )
      if (!confirmed) return

      try {
        const response = await experimentApi.completeExperiment(experiment.id)
        if (response.code === 200) {
          await notify.success('实验已完成', '成功')
          await loadExperimentDetail(experiment.id)
        } else {
          await notify.error(response.message || '完成实验失败', '错误')
        }
      } catch (error) {
        console.error('完成实验失败:', error)
        await notify.error('完成实验失败，请稍后重试', '错误')
      }
    }

    // 查看分组详情
    const viewGroupDetail = (group: ExperimentGroup, index: number) => {
      currentGroup.value = group
      currentGroupIndex.value = index
      viewMode.value = 'groupDetail'
    }

    // 编辑分组（从详情页编辑已保存的分组）
    const editGroup = (group: ExperimentGroup, index: number) => {
      if ((viewMode.value === 'detail' && currentExperiment.value?.status !== 'draft') || groupsLocked.value) return
      selectedStrategy.value = group.strategyRevisionId || ''
      editingGroupIndex.value = index
      editingGroupData.value = group
      // 填充配置表单
      resetGroupConfigForm()
      if (group.config?.weights) {
        Object.assign(groupConfigForm.weights, group.config.weights)
      }
      if (group.config?.recallQuota) {
        Object.assign(groupConfigForm.recallQuota, { vectorQuota: 0, ruleQuota: 0, collaborativeQuota: 0 }, group.config.recallQuota)
      }
      showGroupConfigModal.value = true
    }

    // 删除分组
    const deleteGroup = async (index: number) => {
      if (!currentExperiment.value || currentExperiment.value.status !== 'draft') return

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
          await notify.success('分组已删除', '成功')
          await loadExperimentDetail(currentExperiment.value.id)
        } else {
          await notify.error(response.message || '删除分组失败', '错误')
        }
      } catch (error) {
        console.error('删除分组失败:', error)
        await notify.error('删除分组失败，请稍后重试', '错误')
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

    // 编辑分组配置（从表单中编辑）
    const editGroupConfig = (group: ExperimentGroup, index: number) => {
      if ((viewMode.value === 'detail' && currentExperiment.value?.status !== 'draft') || groupsLocked.value) return
      selectedStrategy.value = group.strategyRevisionId || ''
      editingGroupIndex.value = index
      editingGroupData.value = group
      // 填充配置表单
      resetGroupConfigForm()
      if (group.config?.weights) {
        Object.assign(groupConfigForm.weights, group.config.weights)
      }
      if (group.config?.recallQuota) {
        Object.assign(groupConfigForm.recallQuota, { vectorQuota: 0, ruleQuota: 0, collaborativeQuota: 0 }, group.config.recallQuota)
      }
      showGroupConfigModal.value = true
    }

    // 重置分组配置表单
    const resetGroupConfigForm = () => {
      groupConfigForm.weights = {
        preferenceMatch: '',
        favoriteSimilarity: '',
        browseRelevance: '',
        dishQuality: '',
        diversity: '',
        searchRelevance: '',
      }
      groupConfigForm.recallQuota = {
        vectorQuota: '',
        ruleQuota: '',
        collaborativeQuota: '',
      }
    }

    // 关闭分组配置弹窗
    const closeGroupConfigModal = () => {
      showGroupConfigModal.value = false
      editingGroupIndex.value = -1
      editingGroupData.value = null
      resetGroupConfigForm()
    }

    // 保存分组配置
    const saveGroupConfig = async () => {
      if (editingGroupIndex.value < 0) return

      // 构建配置对象，只包含有值的配置
      const config: Record<string, any> = {}
      
      if (!selectedStrategy.value) {
      const weights: Record<string, number> = {}
      for (const [key, value] of Object.entries(groupConfigForm.weights)) {
        if (value === '' || value === undefined || value === null) continue
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          await notify.error('权重须为有限非负数；留空使用场景默认值', '错误')
          return
        }
        weights[key] = value
      }
      if (Object.keys(weights).length > 0) {
        const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
        if (!Number.isFinite(total) || (Object.keys(weights).length === Object.keys(weightLabels).length && total <= 0)) {
          await notify.error('权重总和必须为有限正数', '错误')
          return
        }
        config.weights = weights
      }

      const quotas = Object.entries(groupConfigForm.recallQuota)
      if (quotas.some(([, value]) => value !== '' && value !== undefined && value !== null)) {
        if (quotas.some(([, value]) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
          await notify.error('请填写全部召回配额，范围为 0 到 1；关闭某一路请填 0', '错误')
          return
        }
        const recallQuota = Object.fromEntries(quotas) as Record<string, number>
        const total = Object.values(recallQuota).reduce((sum, value) => sum + value, 0)
        if (Math.abs(total - 1) > 1e-6) {
          await notify.error(`召回配额总和应为1，当前为${total.toFixed(2)}`, '错误')
          return
        }
        config.recallQuota = recallQuota
      }

      }
      const source = selectedStrategy.value ? { strategyRevisionId: selectedStrategy.value, config: undefined } : { strategyRevisionId: undefined, config }
      // 判断是在编辑表单中还是在详情页编辑
      if (viewMode.value === 'edit') {
        // 表单中编辑，更新 formData.groups
        Object.assign(formData.groups[editingGroupIndex.value], source)
        closeGroupConfigModal()
        await notify.success('分组配置已保存', '成功')
      } else if (viewMode.value === 'detail' && currentExperiment.value) {
        // 详情页编辑，需要调用API更新
        try {
          const updatedGroups = [...currentExperiment.value.groups]
          updatedGroups[editingGroupIndex.value] = {
            ...updatedGroups[editingGroupIndex.value],
            ...source,
          }
          const updateData: UpdateExperimentRequest = {
            groups: updatedGroups,
          }
          const response = await experimentApi.updateExperiment(currentExperiment.value.id, updateData)
          if (response.code === 200) {
            await notify.success('分组配置已更新', '成功')
            await loadExperimentDetail(currentExperiment.value.id)
            closeGroupConfigModal()
          } else {
            await notify.error(response.message || '更新分组配置失败', '错误')
          }
        } catch (error) {
          console.error('更新分组配置失败:', error)
          await notify.error('更新分组配置失败，请稍后重试', '错误')
        }
      }
    }

    // 重置表单
    const resetForm = () => {
      formData.scene = 'home'
      formData.priority = 0
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
      if (editingExperiment.value?.status === 'completed') return
      if (groupsLocked.value && editingExperiment.value) {
        if (!Number.isFinite(formData.trafficRatio) || formData.trafficRatio < 0 || formData.trafficRatio > 1) { await notify.error('流量占比必须在 0% 到 100% 之间', '错误'); return }
        isSubmitting.value = true
        try { const response = await experimentApi.updateExperiment(editingExperiment.value.id, { trafficRatio: formData.trafficRatio }); if (response.code !== 200) throw new Error(response.message); await loadExperiments(); viewMode.value = 'list' } catch (error) { await notify.error(error instanceof Error ? error.message : '保存失败', '错误') } finally { isSubmitting.value = false }
        return
      }
      // 清除之前的错误
      errors.name = ''
      errors.trafficRatio = ''
      errors.startTime = ''
      
      // 收集所有验证错误
      const validationErrors: string[] = []
      
      // 验证实验名称
      if (!formData.name || !formData.name.trim()) {
        errors.name = '请输入实验名称'
        validationErrors.push('请输入实验名称')
      }
      
      // 验证流量占比
      const trafficRatio = Number(formData.trafficRatio)
      if (isNaN(trafficRatio) || trafficRatio < 0 || trafficRatio > 1) {
        errors.trafficRatio = '流量占比必须在 0% 到 100% 之间'
        validationErrors.push('流量占比必须在 0% 到 100% 之间')
      }
      
      // 验证开始日期
      if (!formData.startTime) {
        errors.startTime = '请选择开始日期'
        validationErrors.push('请选择开始日期')
      }

      // 验证结束日期
      if (formData.endTime && formData.startTime) {
        const start = new Date(formData.startTime)
        const end = new Date(formData.endTime)
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          validationErrors.push('日期格式无效')
        } else if (end <= start) {
          validationErrors.push('结束日期必须晚于开始日期')
        }
      }
      
      // 验证分组
      if (formData.groups.length === 0) {
        validationErrors.push('请至少添加一个实验分组')
      } else {
        // 验证每个分组
        const groupErrors: string[] = []
        formData.groups.forEach((group, i) => {
          if (!group.name || !group.name.trim()) {
            groupErrors.push(`分组 ${i + 1} 缺少名称`)
          }
          const ratio = Number(group.ratio)
          if (isNaN(ratio) || ratio < 0 || ratio > 1) {
            groupErrors.push(`分组 ${i + 1} 的占比必须在0到1之间`)
          }
        })
        validationErrors.push(...groupErrors)

        // 验证分组占比总和（只有在没有单个分组错误时才验证）
        if (groupErrors.length === 0) {
          const totalRatio = formData.groups.reduce((sum, group) => {
            const ratio = Number(group.ratio) || 0
            return sum + ratio
          }, 0)
          if (Math.abs(totalRatio - 1) > 0.01) {
            validationErrors.push(`分组占比总和应为1，当前为${totalRatio.toFixed(2)}`)
          }
        }
      }

      // 如果有验证错误，显示所有错误并返回
      if (validationErrors.length > 0) {
        await notify.error(validationErrors.join('\n'), '表单验证失败')
        return
      }

      isSubmitting.value = true
      try {
        if (editingExperiment.value) {
          // 更新实验
          const updateData: UpdateExperimentRequest = {
            scene: formData.scene,
            priority: formData.priority,
            name: formData.name,
            description: formData.description,
            trafficRatio: formData.trafficRatio,
            startTime: new Date(formData.startTime).toISOString(),
            endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
            groups: formData.groups,
          }
          const response = await experimentApi.updateExperiment(editingExperiment.value.id, updateData)
          if (response.code === 200) {
            await notify.success('实验已更新', '成功')
            await loadExperiments()
            viewMode.value = 'list'
          } else {
            await notify.error(response.message || '更新实验失败', '错误')
          }
        } else {
          // 创建实验 - 构建请求数据
          const createData: CreateExperimentRequest = {
            scene: formData.scene,
            priority: formData.priority,
            name: formData.name.trim(),
            trafficRatio: Number(formData.trafficRatio),
            startTime: new Date(formData.startTime).toISOString(),
            groups: formData.groups.map((group) => ({
              strategyRevisionId: group.strategyRevisionId,
              name: group.name.trim(),
              ratio: Number(group.ratio),
              ...(group.config && Object.keys(group.config).length > 0 ? { config: group.config } : {}),
            })),
          }

          // 可选字段
          if (formData.description?.trim()) {
            createData.description = formData.description.trim()
          }
          if (formData.endTime) {
            createData.endTime = new Date(formData.endTime).toISOString()
          }

          const response = await experimentApi.createExperiment(createData)
          if (response.code === 200 || response.code === 201) {
            await notify.success('实验已创建', '成功')
            await loadExperiments()
            viewMode.value = 'list'
          } else {
            await notify.error(response.message || '创建实验失败', '错误')
          }
        }
      } catch (error: any) {
        console.error('提交表单失败:', error)
        let errorMessage = error?.response?.data?.message || error?.message || '操作失败，请稍后重试'
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage.join('; ')
        }
        await notify.error(errorMessage, '错误')
      } finally {
        isSubmitting.value = false
      }
    }

    // 返回列表
    const backToList = async () => {
      viewMode.value = 'list'
      currentExperiment.value = null
      editingExperiment.value = null
      resetForm()
      // 刷新列表数据
      await loadExperiments()
    }

    // 返回详情
    const backToDetail = () => {
      viewMode.value = 'detail'
      currentGroup.value = null
      currentGroupIndex.value = -1
    }

    onMounted(() => {
      recommendationApi.catalog().then(response => { if (response.code === 200) strategies.value = response.data.strategies }).catch(() => notify.error('策略目录加载失败，请刷新后重试', '错误'))
      loadExperiments()
    })

    return {
      authStore,
      recommendationScenes,
      selectedStrategy,
      groupStrategies,
      groupsLocked,
      sceneConflicts,
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
      percentageValue,
      readPercentage,
      errors,
      // 分组配置相关
      showGroupConfigModal,
      editingGroupData,
      groupConfigForm,
      weightLabels,
      recallQuotaLabels,
      recallQuotaTotal,
      groupRatioStatus,
      // 方法
      formatDate,
      distributeGroupRatiosEvenly,
      getStatusLabel,
      getStatusClass,
      getEffectiveStatus,
      getWeightLabel,
      getRecallQuotaLabel,
      formatPercentage,
      viewExperiment,
      createNewExperiment,
      editExperiment,
      deleteExperiment,
      enableExperiment,
      disableExperiment,
      completeExperiment,
      viewGroupDetail,
      editGroup,
      deleteGroup,
      addGroup,
      removeGroup,
      editGroupConfig,
      closeGroupConfigModal,
      saveGroupConfig,
      submitForm,
      backToList,
      backToDetail,
    }
  },
}
</script>


<style scoped>
.percentage-input { appearance: textfield; }
.percentage-input::-webkit-inner-spin-button,
.percentage-input::-webkit-outer-spin-button { appearance: none; margin: 0; }
</style>
