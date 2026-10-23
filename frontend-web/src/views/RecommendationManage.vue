<template>
  <div class="admin-page">
    <div class="admin-panel">
      <div class="admin-heading-row">
        <Header
          title="推荐策略与模型"
          description="管理场景策略版本、模型和索引，使用用户预览验证推荐结果。"
          header-icon="carbon:settings"
        /><button class="admin-button admin-button-secondary" :disabled="busy" @click="refresh">
          刷新状态
        </button>
      </div>
      <p v-if="error" role="alert" class="admin-field-error mb-4">{{ error }}</p>
      <nav class="admin-tabs mb-6" aria-label="推荐管理">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          class="admin-tab"
          :aria-pressed="tab === item.key"
          @click="tab = item.key"
        >
          {{ item.label }}
        </button>
      </nav>
      <p v-if="!catalog" class="admin-state">
        {{ loading ? '正在加载配置…' : '配置尚未加载，请刷新重试。' }}
      </p>
      <template v-else>
        <section v-if="tab === 'strategies'" class="space-y-6">
          <h2 class="text-lg font-semibold">场景默认策略</h2>
          <div class="admin-form-grid">
            <label v-for="scene in recommendationScenes" :key="scene" class="admin-label"
              >{{ sceneLabels[scene] }}
              <select
                class="admin-input w-full"
                :value="defaultSelections[scene] || ''"
                :disabled="!canEdit || busy"
                @change="defaultSelections[scene] = ($event.target as HTMLSelectElement).value"
              >
                <option value="">选择已发布版本</option>
                <option
                  v-for="strategy in published.filter((item) => item.scene === scene)"
                  :key="strategy.id"
                  :value="strategy.id"
                >
                  {{ strategy.name }}
                </option>
              </select>
              <button
                class="admin-button admin-button-secondary mt-2"
                :disabled="
                  !canEdit ||
                  busy ||
                  !defaultSelections[scene] ||
                  defaultSelections[scene] === currentDefault(scene)
                "
                @click="switchDefault(scene)"
              >
                切换 / 回滚至所选版本
              </button>
            </label>
          </div>
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold">策略版本</h2>
            <button v-if="canCreate" class="admin-button admin-button-primary" @click="newDraft">
              新建草稿
            </button>
          </div>
          <div class="admin-table-scroll">
            <table class="admin-table">
              <thead class="bg-gray-50">
                <tr>
                  <th>名称 / 版本</th>
                  <th>场景</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="strategy in catalog.strategies" :key="strategy.id">
                  <td>
                    {{ strategy.name }}<small class="block text-gray-500">{{ strategy.id }}</small>
                  </td>
                  <td>{{ sceneLabels[strategy.scene] }}</td>
                  <td>
                    <span class="recommendation-status" :class="statusClass(strategy.status)">{{
                      statusLabel(strategy.status)
                    }}</span>
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        class="admin-icon-button rounded-full hover:bg-gray-200 text-tsinghua-purple"
                        :title="strategy.status === 'draft' ? '编辑' : '查看 / 复制'"
                        @click="editDraft(strategy)"
                      >
                        <AppIcon
                          :icon="strategy.status === 'draft' ? 'carbon:edit' : 'carbon:view'"
                          aria-hidden="true"
                        />
                        <span class="sr-only">{{
                          strategy.status === 'draft' ? '编辑' : '查看 / 复制'
                        }}</span>
                      </button>
                      <button
                        v-if="strategy.status === 'draft' && canEdit"
                        type="button"
                        class="admin-icon-button rounded-full hover:bg-gray-200 text-tsinghua-purple"
                        :disabled="busy"
                        title="发布"
                        @click="publishStrategy(strategy.id)"
                      >
                        <AppIcon icon="carbon:upload" aria-hidden="true" /><span class="sr-only"
                          >发布</span
                        >
                      </button>
                      <button
                        v-if="strategy.status === 'published' && canEdit"
                        type="button"
                        class="admin-icon-button rounded-full hover:bg-red-50 text-red-600"
                        :disabled="busy"
                        title="退役"
                        @click="retireStrategy(strategy.id)"
                      >
                        <AppIcon icon="carbon:archive" aria-hidden="true" /><span class="sr-only"
                          >退役</span
                        >
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!catalog.strategies.length" class="admin-state">
            创建规则基线草稿，发布后即可设置场景默认策略。
          </p>
          <form v-if="editor" class="space-y-4 border-t pt-6" @submit.prevent="saveDraft">
            <h2 ref="editorHeading" tabindex="-1" class="editor-heading text-lg font-semibold">
              {{ editor.status !== 'draft' ? '已发布版本' : '策略草稿' }}
            </h2>
            <fieldset
              :disabled="busy || editor.status !== 'draft' || !(editor.id ? canEdit : canCreate)"
              class="space-y-4"
            >
              <div class="admin-form-grid">
                <label class="admin-label"
                  >策略名称<input
                    v-model="editor.name"
                    class="admin-input w-full"
                    required /></label
                ><label class="admin-label"
                  >推荐场景<select
                    v-model="editor.scene"
                    :disabled="!!editor.id"
                    class="admin-input w-full"
                  >
                    <option v-for="scene in recommendationScenes" :key="scene" :value="scene">
                      {{ sceneLabels[scene] }}
                    </option>
                  </select></label
                >
              </div>
              <h3 class="font-semibold">召回</h3>
              <div class="admin-form-grid">
                <label v-for="(label, key) in sourceLabels" :key="key" class="admin-label"
                  >{{ label
                  }}<input
                    v-model.number="editor.config.recall.sources[key]"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    required
                    class="admin-input w-full" /></label
                ><label class="admin-label"
                  >候选上限<input
                    v-model.number="editor.config.recall.candidateLimit"
                    type="number"
                    min="10"
                    max="1000"
                    required
                    class="admin-input w-full" /></label
                ><label class="admin-label"
                  >向量索引<select
                    v-model="editor.config.recall.indexId"
                    class="admin-input w-full"
                  >
                    <option :value="undefined">规则基线</option>
                    <option
                      v-for="index in catalog.indexes.filter((item) => item.status === 'ready')"
                      :key="index.id"
                      :value="index.id"
                    >
                      {{ index.name }} · {{ index.id }}
                    </option>
                  </select></label
                >
              </div>
              <h3 class="font-semibold">排序</h3>
              <div class="admin-form-grid">
                <label class="admin-label"
                  >排序方式<select
                    :value="editor.config.ranking.type"
                    class="admin-input w-full"
                    @change="
                      switchRanking(
                        ($event.target as HTMLSelectElement)
                          .value as StrategyConfig['ranking']['type'],
                      )
                    "
                  >
                    <option value="weighted_rules">规则权重</option>
                    <option value="model_endpoint">模型服务</option>
                  </select></label
                ><label v-if="editor.config.ranking.type === 'model_endpoint'" class="admin-label"
                  >排序模型<select
                    :value="editor.config.ranking.modelVersionId"
                    @change="switchRankingModel(($event.target as HTMLSelectElement).value)"
                    required
                    class="admin-input w-full"
                  >
                    <option value="">选择已验证模型</option>
                    <option
                      v-for="model in catalog.models.filter(
                        (item) => item.kind === 'ranking' && item.status === 'ready',
                      )"
                      :key="model.id"
                      :value="model.id"
                    >
                      {{ model.name }} · {{ model.serviceVersion }}
                    </option>
                  </select></label
                ><label v-if="editor.config.ranking.type === 'model_endpoint'" class="admin-label"
                  >超时预算（毫秒）<input
                    v-model.number="editor.config.ranking.timeoutMs"
                    type="number"
                    min="50"
                    max="5000"
                    required
                    class="admin-input w-full" /></label
                ><template v-if="editor.config.ranking.type === 'weighted_rules'"
                  ><label v-for="(label, key) in weightLabels" :key="key" class="admin-label"
                    >{{ label
                    }}<input
                      v-model.number="editor.config.ranking.weights[key]"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      class="admin-input w-full" /></label
                ></template>
              </div>
              <section v-if="editor.config.ranking.type === 'model_endpoint'" class="space-y-3">
                <h4 class="font-medium">排序模型参数</h4>
                <ModelParameterFields
                  v-if="rankingModel"
                  :key="rankingModel.id"
                  v-model="editor.config.ranking.parameters"
                  :schema="rankingModel.parameterSchema"
                  id-prefix="ranking-parameter"
                />
                <p v-else class="text-sm text-gray-500">选择排序模型后显示该模型声明的参数。</p>
              </section>
              <label class="admin-label flex items-center gap-2"
                ><input
                  v-model="editor.config.rerank.diversityEnabled"
                  type="checkbox"
                />启用多样性重排</label
              >
              <label class="admin-label block"
                >故障回退规则基线<select
                  v-model="editor.config.fallbackStrategyRevisionId"
                  class="admin-input w-full"
                >
                  <option :value="undefined">基线自身无需回退</option>
                  <option v-for="strategy in baselines" :key="strategy.id" :value="strategy.id">
                    {{ strategy.name }}
                  </option>
                </select></label
              >
              <details>
                <summary class="cursor-pointer font-medium">高级 JSON（与表单同步）</summary>
                <label class="admin-label block mt-2"
                  >完整策略配置<textarea
                    :value="JSON.stringify(editor.config, null, 2)"
                    rows="24"
                    spellcheck="false"
                    wrap="off"
                    class="admin-textarea block w-full mt-2 font-mono"
                    @change="applyJson(($event.target as HTMLTextAreaElement).value)"
                  />
                </label>
                <p v-if="jsonError" role="alert" class="admin-field-error">{{ jsonError }}</p>
              </details>
            </fieldset>
            <details>
              <summary>比较同场景策略版本</summary>
              <label class="admin-label block mt-3"
                >对比基线版本
                <select v-model="comparisonId" class="admin-input w-full">
                  <option value="">选择同场景已发布版本</option>
                  <option
                    v-for="strategy in comparisonStrategies"
                    :key="strategy.id"
                    :value="strategy.id"
                  >
                    {{ strategy.name }}
                  </option>
                </select>
              </label>
              <template v-if="comparisonConfig">
                <p class="text-sm text-gray-600 my-3">
                  展示配置变化；— 表示该字段在对应版本中未配置。
                </p>
                <div v-if="configurationChanges.length" class="admin-table-scroll">
                  <table class="admin-table" aria-label="策略字段差异">
                    <thead class="bg-gray-50">
                      <tr>
                        <th>字段</th>
                        <th>基线版本</th>
                        <th>当前版本</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="change in configurationChanges" :key="change.path">
                        <th scope="row">
                          {{ change.label
                          }}<small class="block font-normal">{{ change.path }}</small>
                        </th>
                        <td>{{ displayConfigValue(change.before) }}</td>
                        <td>{{ displayConfigValue(change.after) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="text-sm text-gray-600">两个版本的策略配置一致。</p>
              </template>
              <p v-else-if="!comparisonStrategies.length" class="mt-3 text-sm text-gray-600">
                当前场景暂无可比较的已发布版本。
              </p>
            </details>
            <div class="admin-actions">
              <button
                v-if="editor.status === 'draft'"
                type="submit"
                :disabled="
                  busy ||
                  !!jsonError ||
                  !!rankingParameterError ||
                  !(editor.id ? canEdit : canCreate)
                "
                class="admin-button admin-button-primary"
              >
                保存草稿</button
              ><button
                v-if="editor.status !== 'draft' && canCreate"
                type="button"
                class="admin-button admin-button-primary"
                @click="copyDraft"
              >
                复制为新草稿</button
              ><button
                type="button"
                class="admin-button admin-button-secondary"
                @click="editor = null"
              >
                关闭编辑
              </button>
            </div>
          </form>
        </section>
        <section v-if="tab === 'models'" class="space-y-6">
          <h2 class="text-lg font-semibold">模型版本与契约验证</h2>
          <p class="text-sm text-gray-600">
            登记后点击验证契约，从模型服务读取参数声明。已验证版本的参数声明随模型版本固定。
          </p>
          <div class="admin-table-scroll">
            <table class="admin-table model-catalog-table">
              <colgroup>
                <col style="width: 40%" />
                <col style="width: 18%" />
                <col style="width: 30%" />
                <col style="width: 12%" />
              </colgroup>
              <thead class="bg-gray-50">
                <tr>
                  <th>模型 / 服务版本</th>
                  <th>类型 / 维度</th>
                  <th>部署 / 状态</th>
                  <th>验证</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <template v-for="model in catalog.models" :key="model.id">
                  <tr>
                    <td>
                      <p class="font-medium">{{ model.name }}</p>
                      <p class="text-sm text-gray-500">{{ model.serviceVersion }}</p>
                      <button
                        type="button"
                        class="model-details-toggle text-tsinghua-purple"
                        aria-haspopup="dialog"
                        :aria-label="`查看 ${model.name} 的参数详情`"
                        @click="selectedDetails = { model }"
                      >
                        参数详情
                      </button>
                    </td>
                    <td>
                      {{ model.kind === 'ranking' ? '排序模型' : '向量模型'
                      }}<small v-if="model.dimension" class="block text-gray-500"
                        >{{ model.dimension }} 维</small
                      >
                    </td>
                    <td>
                      <p>{{ model.deploymentId || '本地' }}</p>
                      <span class="recommendation-status mt-1" :class="statusClass(model.status)">{{
                        model.status === 'draft' ? '待验证' : statusLabel(model.status)
                      }}</span>
                      <small class="block mt-1 text-gray-500">{{
                        model.verifiedAt ? formatDate(model.verifiedAt) : '尚未验证'
                      }}</small>
                    </td>
                    <td>
                      <button
                        v-if="canEdit"
                        :disabled="busy"
                        class="admin-icon-button rounded-full hover:bg-gray-200 text-tsinghua-purple"
                        title="验证契约"
                        @click="verifyModel(model.id)"
                      >
                        <AppIcon icon="carbon:checkmark-outline" aria-hidden="true" /><span
                          class="sr-only"
                          >验证契约</span
                        >
                      </button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <form v-if="canCreate" class="border-t pt-6 space-y-4" @submit.prevent="registerModel">
            <h3 class="font-semibold">登记模型版本</h3>
            <div class="admin-form-grid">
              <label class="admin-label"
                >名称<input v-model="modelForm.name" required class="admin-input w-full" /></label
              ><label class="admin-label"
                >类型<select v-model="modelForm.kind" class="admin-input w-full">
                  <option value="embedding">向量模型</option>
                  <option value="ranking">排序模型</option>
                </select></label
              ><label class="admin-label"
                >提供方<select v-model="modelForm.provider" class="admin-input w-full">
                  <option v-if="modelForm.kind === 'embedding'" value="local">内置 local-v1</option>
                  <option value="http">已部署 HTTP 服务</option>
                </select></label
              ><template v-if="modelForm.provider === 'http'"
                ><label class="admin-label"
                  >部署<select v-model="modelForm.deploymentId" required class="admin-input w-full">
                    <option
                      v-for="deployment in catalog.deployments"
                      :key="deployment"
                      :value="deployment"
                    >
                      {{ deployment }}
                    </option>
                  </select></label
                ><label class="admin-label"
                  >服务版本<input
                    v-model="modelForm.serviceVersion"
                    required
                    class="admin-input w-full" /></label
                ><label class="admin-label"
                  >制品摘要<input
                    v-model="modelForm.artifactDigest"
                    required
                    class="admin-input w-full" /></label
                ><label class="admin-label"
                  >特征 schema 版本<input
                    v-model="modelForm.featureSchemaVersion"
                    required
                    class="admin-input w-full" /></label
                ><label v-if="modelForm.kind === 'embedding'" class="admin-label"
                  >向量维度<input
                    v-model.number="modelForm.dimension"
                    type="number"
                    min="1"
                    required
                    class="admin-input w-full" /></label
              ></template>
            </div>
            <p v-if="modelForm.provider === 'local'" class="text-sm text-gray-600">
              local-v1 · {{ modelForm.featureSchemaVersion
              }}{{ modelForm.kind === 'embedding' ? ' · 128 维' : '' }}
            </p>
            <button :disabled="busy" class="admin-button admin-button-primary">登记模型</button>
          </form>
        </section>
        <section v-if="tab === 'indexes'" class="space-y-6">
          <h2 class="text-lg font-semibold">向量索引</h2>
          <p role="status">
            推荐库：{{ catalog.storeConfigured ? '已配置' : '待配置连接' }}。构建和增量同步状态每 5
            秒更新。
          </p>
          <div class="admin-table-scroll">
            <table class="admin-table">
              <thead class="bg-gray-50">
                <tr>
                  <th>索引 / 模型</th>
                  <th>状态与覆盖率</th>
                  <th>待处理 / 失败</th>
                  <th>最近同步 / 错误</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="index in catalog.indexes" :key="index.id">
                  <td>
                    {{ index.name }}<small class="block">{{ index.modelVersionId }}</small
                    ><small class="block">策略引用：{{ indexReferences(index.id) }}</small>
                    <button
                      type="button"
                      class="model-details-toggle text-tsinghua-purple"
                      aria-haspopup="dialog"
                      :aria-label="`查看 ${index.name} 的固定参数`"
                      @click="openIndexDetails(index)"
                    >
                      固定参数
                    </button>
                  </td>
                  <td>
                    <span class="recommendation-status mr-2" :class="statusClass(index.status)">{{
                      statusLabel(index.status)
                    }}</span>
                    {{
                      index.total ? ((index.applied / index.total) * 100).toFixed(1) : '0.0'
                    }}%<progress
                      :value="index.applied"
                      :max="Math.max(index.total, 1)"
                      class="block my-2 accent-tsinghua-purple"
                      :aria-label="`${index.name} 构建进度`"
                    />{{ index.applied }} / {{ index.total }}
                  </td>
                  <td>{{ index.pending }} / {{ index.failed }}</td>
                  <td>
                    {{ index.lastSyncedAt ? formatDate(index.lastSyncedAt) : '尚未同步' }}
                    <p class="admin-field-error">{{ index.lastError }}</p>
                  </td>
                  <td>
                    <div
                      v-if="canEdit && index.status !== 'retired'"
                      class="flex items-center gap-1"
                    >
                      <button
                        type="button"
                        class="admin-icon-button rounded-full hover:bg-gray-200 text-tsinghua-purple"
                        :disabled="busy"
                        title="构建 / 重试"
                        @click="buildIndex(index.id)"
                      >
                        <AppIcon icon="carbon:renew" aria-hidden="true" /><span class="sr-only"
                          >构建 / 重试</span
                        >
                      </button>
                      <button
                        type="button"
                        class="admin-icon-button rounded-full hover:bg-red-50 text-red-600"
                        :disabled="busy"
                        title="退役"
                        @click="retireIndex(index.id)"
                      >
                        <AppIcon icon="carbon:archive" aria-hidden="true" /><span class="sr-only"
                          >退役</span
                        >
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <form v-if="canCreate" @submit.prevent="createIndex()" class="admin-form-grid">
            <label class="admin-label"
              >索引名称<input v-model="indexForm.name" required class="admin-input w-full" /></label
            ><label class="admin-label"
              >已验证向量模型<select
                :value="indexForm.modelVersionId"
                @change="switchIndexModel(($event.target as HTMLSelectElement).value)"
                required
                class="admin-input w-full"
              >
                <option value="">选择已验证模型</option>
                <option
                  v-for="model in catalog.models.filter(
                    (item) => item.kind === 'embedding' && item.status === 'ready',
                  )"
                  :key="model.id"
                  :value="model.id"
                >
                  {{ model.name }} · {{ model.serviceVersion }}
                </option>
              </select></label
            >
            <section class="space-y-3 col-span-full">
              <h3 class="font-medium">索引模型参数</h3>
              <ModelParameterFields
                v-if="indexModel"
                :key="indexModel.id"
                v-model="indexForm.parameters"
                :schema="indexModel.parameterSchema"
                id-prefix="index-parameter"
              />
              <p v-else class="text-sm text-gray-500">选择向量模型后显示该模型声明的参数。</p>
              <p class="text-sm text-gray-500">
                参数在索引创建时固定，构建与在线查询使用同一配置。调整参数时创建新索引。
              </p>
            </section>
            <button
              :disabled="busy || !catalog.storeConfigured || !indexModel || !!indexParameterError"
              class="admin-button admin-button-primary"
            >
              创建并构建索引
            </button>
          </form>
        </section>
        <section v-if="tab === 'preview'" class="space-y-6">
          <h2 class="text-lg font-semibold">用户预览</h2>
          <p class="text-sm text-gray-600">
            选择用户与策略，查看推荐顺序、菜品信息和评分详情。预览独立于在线实验统计。
          </p>
          <form class="admin-form-grid" @submit.prevent="preview">
            <label class="admin-label"
              >用户 ID<input
                id="recommendation-preview-user"
                v-model="previewForm.userId"
                placeholder="输入预览用户 ID"
                required
                class="admin-input w-full" /></label
            ><label class="admin-label"
              >策略版本<select
                id="recommendation-preview-strategy"
                v-model="previewForm.strategyRevisionId"
                required
                class="admin-input w-full"
              >
                <option
                  v-for="strategy in catalog.strategies"
                  :key="strategy.id"
                  :value="strategy.id"
                >
                  {{ strategy.name }} · {{ statusLabel(strategy.status) }}
                </option>
              </select></label
            ><button :disabled="busy" class="admin-button admin-button-primary">生成预览</button>
          </form>
          <section v-if="previewResult" aria-label="推荐结果" class="border-t border-gray-200 pt-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-base font-semibold text-gray-900">
                推荐结果
                <span class="text-sm font-normal text-gray-500"
                  >{{ previewResult.items.length }} 道菜品</span
                >
              </h3>
              <span class="recommendation-status bg-purple-50 text-tsinghua-purple">预览</span>
            </div>
            <p class="mt-2 text-sm text-gray-600">
              {{ previewStrategyName }} ·
              {{
                previewResult.rankerVersionId
                  ? modelName(previewResult.rankerVersionId)
                  : '规则排序'
              }}
            </p>
            <p class="mt-1 text-sm text-gray-500">
              {{
                previewResult.rankerVersionId
                  ? '按模型评分与重排后的最终顺序展示；模型评分用于比较候选菜品。'
                  : '按最终推荐顺序展示；得分用于比较排序，详情中的各项分数为加权前评分。'
              }}
            </p>
            <p v-if="previewResult.fallbackReason" class="mt-3 admin-field-error" role="status">
              已使用回退策略：{{ previewResult.fallbackReason }}
            </p>
            <details class="preview-runtime mt-3 text-sm">
              <summary class="text-tsinghua-purple cursor-pointer">运行详情</summary>
              <dl class="mt-3 grid gap-3 sm:grid-cols-2 text-gray-600">
                <div>
                  <dt class="font-medium text-gray-800">策略版本</dt>
                  <dd>{{ previewStrategyName }}</dd>
                  <dd class="break-all text-xs text-gray-500">
                    {{ previewResult.strategyRevisionId || '内置规则基线' }}
                  </dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-800">向量索引</dt>
                  <dd>{{ indexName(previewResult.indexId) }}</dd>
                  <dd v-if="previewResult.indexId" class="break-all text-xs text-gray-500">
                    {{ previewResult.indexId }}
                  </dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-800">向量模型</dt>
                  <dd>
                    {{
                      previewResult.modelVersionId
                        ? modelName(previewResult.modelVersionId)
                        : '规则召回'
                    }}
                  </dd>
                  <dd v-if="previewResult.modelVersionId" class="break-all text-xs text-gray-500">
                    {{ previewResult.modelVersionId }}
                  </dd>
                </div>
                <div>
                  <dt class="font-medium text-gray-800">排序模型</dt>
                  <dd>
                    {{
                      previewResult.rankerVersionId
                        ? modelName(previewResult.rankerVersionId)
                        : '规则排序'
                    }}
                  </dd>
                  <dd v-if="previewResult.rankerVersionId" class="break-all text-xs text-gray-500">
                    {{ previewResult.rankerVersionId }}
                  </dd>
                </div>
              </dl>
            </details>
            <ol
              v-if="previewResult.items.length"
              class="mt-4 divide-y divide-gray-200"
              aria-label="推荐菜品"
            >
              <li
                v-for="(item, position) in previewResult.items"
                :key="item.id"
                class="py-4"
                data-testid="preview-dish"
              >
                <div class="preview-dish-row">
                  <span class="text-gray-500 tabular-nums" :aria-label="`第 ${position + 1} 位`">{{
                    position + 1
                  }}</span>
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900 break-words">
                      {{ item.dish?.name || '菜品信息暂不可用' }}
                    </p>
                    <p v-if="item.dish" class="mt-1 text-sm text-gray-500">
                      {{ item.dish.canteenName }} · {{ item.dish.windowName }}
                    </p>
                    <p v-if="item.dish" class="mt-1 text-sm text-gray-600 tabular-nums">
                      ¥{{ item.dish.price.toFixed(2)
                      }}<span v-if="item.dish.priceUnit"> / {{ item.dish.priceUnit }}</span>
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-gray-500">推荐得分</p>
                    <p
                      class="font-semibold text-tsinghua-purple tabular-nums"
                      data-testid="preview-score"
                    >
                      {{ formatScore(item.score) }}
                    </p>
                  </div>
                </div>
                <details class="preview-score-details mt-2 text-sm">
                  <summary class="text-tsinghua-purple cursor-pointer">
                    评分详情<span class="sr-only"> · {{ item.dish?.name || item.id }}</span>
                  </summary>
                  <dl
                    v-if="item.scoreBreakdown && Object.keys(item.scoreBreakdown).length"
                    class="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3"
                  >
                    <div
                      v-for="(value, key) in item.scoreBreakdown"
                      :key="key"
                      class="flex flex-wrap items-baseline justify-between gap-2"
                    >
                      <dt class="text-gray-600">{{ scoreLabels[key] || key }}</dt>
                      <dd class="tabular-nums text-gray-900">{{ formatScore(value) }}</dd>
                    </div>
                  </dl>
                  <p v-else class="mt-3 text-gray-500">此排序方式未提供分项评分。</p>
                  <p class="mt-3 break-all text-xs text-gray-500">菜品 ID：{{ item.id }}</p>
                </details>
              </li>
            </ol>
            <p v-else class="admin-state">该用户当前条件下暂无推荐菜品。</p>
          </section>
        </section>
      </template>
    </div>
    <ParameterDetailsDrawer
      :model="selectedDetails?.model ?? null"
      :index="selectedDetails?.index"
      @close="selectedDetails = null"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, reactive, ref, watch } from 'vue'
import ParameterDetailsDrawer from '@/components/Recommendation/ParameterDetailsDrawer.vue'
import Header from '@/components/Layout/Header.vue'
import AppIcon from '@/components/Common/AppIcon.vue'
import ModelParameterFields from '@/components/Recommendation/ModelParameterFields.vue'
import {
  modelParameterDefaults,
  modelParameterErrors,
} from '@/components/Recommendation/modelParameters'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { showConfirmDanger } from '@/composables/useModal'
import {
  baselineConfig,
  recommendationApi,
  recommendationScenes,
  type ModelParameters,
  type RecommendationCatalog,
  type RecommendationModel,
  type RecommendationIndex,
  type RecommendationPreview,
  type RecommendationScene,
  type RecommendationStrategy,
  type StrategyConfig,
} from '@/api/modules/recommendation'
import type { ApiResponse } from '@/types/api'
const auth = useAuthStore()
const notify = useNotification()
const canEdit = computed(() => auth.hasPermission('experiment:edit'))
const canCreate = computed(() => auth.hasPermission('experiment:create'))
const tabs = [
  { key: 'strategies', label: '策略版本' },
  { key: 'models', label: '模型登记' },
  { key: 'indexes', label: '索引构建' },
  { key: 'preview', label: '用户预览' },
]
const tab = ref('strategies'),
  busy = ref(false),
  loading = ref(false),
  error = ref(''),
  jsonError = ref('')
const catalog = ref<RecommendationCatalog | null>(null)
const editor = ref<RecommendationStrategy | null>(null)
const defaultSelections = reactive<Partial<Record<RecommendationScene, string>>>({})
const sceneLabels = {
  home: '首页',
  search: '搜索',
  similar: '相似菜品',
  guess_like: '猜你喜欢',
  today: '今日推荐',
}
const sourceLabels = {
  vectorQuota: '向量召回配额',
  ruleQuota: '规则召回配额',
  collaborativeQuota: '协同召回配额',
}
const weightLabels = {
  preferenceMatch: '偏好匹配',
  favoriteSimilarity: '收藏相似度',
  browseRelevance: '浏览相关性',
  dishQuality: '菜品质量',
  diversity: '多样性',
  searchRelevance: '搜索相关性',
}
const statusLabel = (status: string) =>
  ({
    draft: '草稿',
    ready: '就绪',
    building: '构建中',
    failed: '失败',
    retired: '已退役',
    published: '已发布',
  })[status] || status
const statusClass = (status: string) =>
  ({
    draft: 'bg-gray-100 text-gray-700',
    ready: 'bg-green-100 text-green-700',
    published: 'bg-green-100 text-green-700',
    building: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    retired: 'bg-gray-100 text-gray-600',
  })[status] || 'bg-gray-100 text-gray-700'
const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })
const formatScore = (value: number | undefined) => (value === undefined ? '—' : value.toFixed(3))
const scoreLabels: Record<string, string> = {
  preferenceScore: '偏好匹配',
  favoriteScore: '收藏相似度',
  browseScore: '浏览相关性',
  qualityScore: '菜品质量',
  diversityScore: '多样性',
  searchScore: '搜索相关性',
}
const parameterTitle = (modelId: string, name: string) =>
  catalog.value?.models.find((item) => item.id === modelId)?.parameterSchema?.properties[name]
    ?.title || name
const modelName = (id: string) => catalog.value?.models.find((item) => item.id === id)?.name || id
const indexName = (id?: string) =>
  id ? catalog.value?.indexes.find((item) => item.id === id)?.name || id : '规则召回'
const previewStrategyName = computed(
  () =>
    catalog.value?.strategies.find((item) => item.id === previewResult.value?.strategyRevisionId)
      ?.name || '内置规则基线',
)
const published = computed(
  () =>
    catalog.value?.strategies.filter(
      (item) =>
        item.status === 'published' &&
        (!item.config.recall.indexId ||
          catalog.value?.indexes.some(
            (index) => index.id === item.config.recall.indexId && index.status === 'ready',
          )),
    ) || [],
)
const baselines = computed(() =>
  published.value.filter(
    (item) =>
      item.scene === editor.value?.scene &&
      item.config.recall.sources.vectorQuota === 0 &&
      item.config.ranking.type === 'weighted_rules' &&
      !item.config.recall.indexId &&
      !item.config.fallbackStrategyRevisionId,
  ),
)
const currentDefault = (scene: RecommendationScene) =>
  catalog.value?.defaults.find((item) => item.scene === scene)?.strategyRevisionId
const comparisonId = ref('')
const comparisonStrategies = computed(
  () =>
    catalog.value?.strategies.filter(
      (item) =>
        item.status === 'published' &&
        item.scene === editor.value?.scene &&
        item.id !== editor.value?.id,
    ) || [],
)
const comparisonConfig = computed(
  () => comparisonStrategies.value.find((item) => item.id === comparisonId.value)?.config,
)
watch(comparisonStrategies, (strategies) => {
  if (strategies.some((item) => item.id === comparisonId.value)) return
  const preferred = editor.value ? currentDefault(editor.value.scene) : undefined
  comparisonId.value =
    strategies.find((item) => item.id === preferred)?.id || strategies[0]?.id || ''
})
type ConfigValue = string | number | boolean | undefined
function comparableFields(
  config: StrategyConfig,
): { path: string; label: string; value: ConfigValue }[] {
  const rules = config.ranking.type === 'weighted_rules' ? config.ranking : undefined
  const model = config.ranking.type === 'model_endpoint' ? config.ranking : undefined
  return [
    { path: 'schemaVersion', label: '配置版本', value: config.schemaVersion },
    ...Object.entries(sourceLabels).map(([key, label]) => ({
      path: `recall.sources.${key}`,
      label,
      value: config.recall.sources[key as keyof typeof sourceLabels],
    })),
    { path: 'recall.candidateLimit', label: '候选上限', value: config.recall.candidateLimit },
    { path: 'recall.indexId', label: '向量索引', value: config.recall.indexId },
    { path: 'ranking.type', label: '排序方式', value: config.ranking.type },
    ...Object.entries(weightLabels).map(([key, label]) => ({
      path: `ranking.weights.${key}`,
      label,
      value: rules?.weights[key as keyof typeof weightLabels],
    })),
    { path: 'ranking.modelVersionId', label: '排序模型', value: model?.modelVersionId },
    { path: 'ranking.timeoutMs', label: '超时预算（毫秒）', value: model?.timeoutMs },
    ...Object.entries(model?.parameters ?? {}).map(([key, value]) => ({
      path: `ranking.parameters.${key}`,
      label: parameterTitle(model!.modelVersionId, key),
      value,
    })),
    { path: 'rerank.diversityEnabled', label: '多样性重排', value: config.rerank.diversityEnabled },
    {
      path: 'fallbackStrategyRevisionId',
      label: '故障回退版本',
      value: config.fallbackStrategyRevisionId,
    },
  ]
}
const configurationChanges = computed(() => {
  if (!comparisonConfig.value || !editor.value) return []
  const before = new Map(
    comparableFields(comparisonConfig.value).map((field) => [field.path, field]),
  )
  const after = new Map(comparableFields(editor.value.config).map((field) => [field.path, field]))
  return [...new Set([...before.keys(), ...after.keys()])].flatMap((path) => {
    const previous = before.get(path),
      current = after.get(path)
    return previous?.value === current?.value
      ? []
      : [{ ...(current ?? previous)!, before: previous?.value, after: current?.value }]
  })
})
const displayConfigValue = (value: ConfigValue) =>
  value === undefined || value === ''
    ? '—'
    : typeof value === 'boolean'
      ? value
        ? '启用'
        : '关闭'
      : value === 'weighted_rules'
        ? '规则权重'
        : value === 'model_endpoint'
          ? '模型服务'
          : value
const modelForm = reactive<Omit<RecommendationModel, 'id' | 'status' | 'parameterSchema'>>({
  name: '',
  kind: 'embedding',
  provider: 'local',
  serviceVersion: 'local-v1',
  artifactDigest: 'local-v1',
  featureSchemaVersion: 'dish-user-v1',
  dimension: 128,
  deploymentId: '',
})
watch(
  () => modelForm.kind,
  (kind) => {
    modelForm.featureSchemaVersion = kind === 'ranking' ? 'ranking-numeric-v1' : 'dish-user-v1'
    if (kind === 'ranking') modelForm.provider = 'http'
  },
)
const indexForm = reactive({ name: '', modelVersionId: '', parameters: {} as ModelParameters })
const indexModel = computed(() =>
  catalog.value?.models.find((model) => model.id === indexForm.modelVersionId),
)
const rankingModel = computed(() => {
  const ranking = editor.value?.config.ranking
  return ranking?.type === 'model_endpoint'
    ? catalog.value?.models.find((model) => model.id === ranking.modelVersionId)
    : undefined
})
const rankingParameterError = computed(() => {
  const ranking = editor.value?.config.ranking
  return ranking?.type === 'model_endpoint'
    ? Object.values(
        modelParameterErrors(rankingModel.value?.parameterSchema, ranking.parameters),
      ).join('；')
    : ''
})
const indexParameterError = computed(() =>
  Object.values(modelParameterErrors(indexModel.value?.parameterSchema, indexForm.parameters)).join(
    '；',
  ),
)
function switchIndexModel(id: string) {
  indexForm.modelVersionId = id
  indexForm.parameters = modelParameterDefaults(indexModel.value?.parameterSchema)
  error.value = ''
}
function switchRankingModel(id: string) {
  const ranking = editor.value?.config.ranking
  if (ranking?.type !== 'model_endpoint') return
  ranking.modelVersionId = id
  ranking.parameters = modelParameterDefaults(rankingModel.value?.parameterSchema)
  jsonError.value = ''
  error.value = ''
}
const previewForm = reactive({ userId: '', strategyRevisionId: '', pageSize: 10 })
const previewResult = ref<RecommendationPreview | null>(null)
let poll: ReturnType<typeof setInterval> | undefined
let disposed = false
function checked<T>(response: ApiResponse<T>): T {
  if (response.code !== 200 && response.code !== 201)
    throw new Error(response.message || '请求失败')
  return response.data
}
function message(reason: unknown) {
  const value = reason as {
    response?: { data?: { message?: string | string[] } }
    message?: string
  }
  const detail = value.response?.data?.message || value.message || '操作失败，请重试'
  return Array.isArray(detail) ? detail.join('；') : detail
}
async function refresh() {
  if (loading.value) return
  loading.value = true
  try {
    const next = checked(await recommendationApi.catalog())
    if (disposed) return
    catalog.value = next
    for (const item of next.defaults)
      if (!defaultSelections[item.scene]) defaultSelections[item.scene] = item.strategyRevisionId
  } catch (reason) {
    error.value = message(reason)
  } finally {
    loading.value = false
  }
}
async function run(action: () => Promise<ApiResponse<unknown>>, success: string) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    checked(await action())
    notify.success(success)
    await refresh()
    return true
  } catch (reason) {
    error.value = message(reason)
    return false
  } finally {
    busy.value = false
  }
}
const editorHeading = ref<HTMLElement | null>(null)
const selectedDetails = ref<{ model: RecommendationModel; index?: RecommendationIndex } | null>(
  null,
)
function openIndexDetails(index: RecommendationIndex) {
  const model = catalog.value?.models.find((item) => item.id === index.modelVersionId)
  if (model) selectedDetails.value = { model, index }
}
async function focusEditor() {
  await nextTick()
  editorHeading.value?.focus({ preventScroll: true })
  editorHeading.value?.scrollIntoView({ block: 'start' })
}
function newDraft() {
  editor.value = { id: '', name: '', scene: 'home', config: baselineConfig(), status: 'draft' }
  jsonError.value = ''
  void focusEditor()
}
function editDraft(strategy: RecommendationStrategy) {
  const draft = JSON.parse(JSON.stringify(strategy)) as RecommendationStrategy
  if (draft.config.ranking.type === 'model_endpoint') {
    const ranking = draft.config.ranking
    const model = catalog.value?.models.find((item) => item.id === ranking.modelVersionId)
    ranking.parameters = {
      ...modelParameterDefaults(model?.parameterSchema),
      ...ranking.parameters,
    }
  }
  editor.value = draft
  jsonError.value = ''
  void focusEditor()
}
function copyDraft() {
  if (editor.value)
    editor.value = { ...editor.value, id: '', name: `${editor.value.name} 副本`, status: 'draft' }
}
function switchRanking(type: StrategyConfig['ranking']['type']) {
  if (!editor.value || editor.value.config.ranking.type === type) return
  editor.value.config.ranking =
    type === 'model_endpoint'
      ? { type, modelVersionId: '', timeoutMs: 1000, parameters: {} }
      : baselineConfig().ranking
  jsonError.value = ''
}
function applyJson(raw: string) {
  try {
    const config = JSON.parse(raw) as StrategyConfig
    if (config.schemaVersion !== 1 || !config.recall?.sources || !config.ranking || !config.rerank)
      throw new Error('请保留 schemaVersion、recall、ranking 和 rerank 字段')
    const ranking = config.ranking
    if (ranking.type === 'weighted_rules') {
      if (
        Object.keys(ranking).some((key) => !['type', 'weights'].includes(key)) ||
        !ranking.weights ||
        typeof ranking.weights !== 'object' ||
        Array.isArray(ranking.weights)
      )
        throw new Error('规则排序配置仅包含 type 和 weights')
    } else if (ranking.type === 'model_endpoint') {
      if (
        Object.keys(ranking).some(
          (key) => !['type', 'modelVersionId', 'timeoutMs', 'parameters'].includes(key),
        ) ||
        typeof ranking.modelVersionId !== 'string' ||
        !ranking.modelVersionId ||
        typeof ranking.timeoutMs !== 'number' ||
        !Number.isFinite(ranking.timeoutMs)
      )
        throw new Error('模型排序配置仅包含 type、modelVersionId、timeoutMs 和 parameters')
      const model = catalog.value?.models.find((item) => item.id === ranking.modelVersionId)
      if (!model || model.kind !== 'ranking') throw new Error('请选择已登记的排序模型')
      const parameterError = Object.values(
        modelParameterErrors(model.parameterSchema, ranking.parameters),
      ).join('；')
      if (parameterError) throw new Error(parameterError)
      ranking.parameters = {
        ...modelParameterDefaults(model.parameterSchema),
        ...ranking.parameters,
      }
    } else throw new Error('请选择 weighted_rules 或 model_endpoint 排序类型')
    if (editor.value) editor.value.config = config
    jsonError.value = ''
  } catch (reason) {
    jsonError.value = message(reason)
  }
}
async function saveDraft() {
  const draft = editor.value
  if (!draft || jsonError.value || rankingParameterError.value) return
  await run(async () => {
    const response = draft.id
      ? await recommendationApi.updateStrategy(draft.id, { name: draft.name, config: draft.config })
      : await recommendationApi.createStrategy({
          name: draft.name,
          scene: draft.scene,
          config: draft.config,
        })
    const saved = checked(response)
    editor.value = saved
    return response
  }, '草稿已保存并通过服务端校验')
}
async function switchDefault(scene: RecommendationScene) {
  const id = defaultSelections[scene]
  if (
    id &&
    (await showConfirmDanger(
      `将${sceneLabels[scene]}默认策略切换至 ${id}，新推荐请求将使用该版本。`,
      '切换默认策略',
    ))
  )
    await run(() => recommendationApi.setDefault(scene, id), '默认策略已切换')
}
async function registerModel() {
  const data = { ...modelForm }
  if (data.provider === 'local')
    Object.assign(data, {
      serviceVersion: 'local-v1',
      artifactDigest: 'local-v1',
      featureSchemaVersion: data.kind === 'ranking' ? 'ranking-numeric-v1' : 'dish-user-v1',
      dimension: 128,
      deploymentId: undefined,
    })
  if (data.kind === 'ranking') delete data.dimension
  await run(() => recommendationApi.registerModel(data), '模型已登记，请验证契约')
}
const indexReferences = (id: string) =>
  catalog.value?.strategies
    .filter((item) => item.config.recall.indexId === id)
    .map((item) => item.name)
    .join('、') || '暂无'
const publishStrategy = (id: string) =>
  run(() => recommendationApi.publishStrategy(id), '策略已发布')
const verifyModel = (id: string) => run(() => recommendationApi.verifyModel(id), '模型契约验证通过')
const buildIndex = (id: string) => run(() => recommendationApi.buildIndex(id), '已提交构建 / 重试')
async function createIndex() {
  if (!indexModel.value || indexParameterError.value) return
  const data = { ...indexForm, parameters: { ...indexForm.parameters } }
  await run(() => recommendationApi.createIndex(data), '索引开始构建')
}
async function retireStrategy(id: string) {
  if (
    await showConfirmDanger(
      '退役后该策略退出发布目录，服务端会检查默认场景和实验引用。',
      '退役策略',
    )
  )
    await run(() => recommendationApi.retireStrategy(id), '策略已退役')
}
async function retireIndex(id: string) {
  if (await showConfirmDanger('退役后该索引停止服务，服务端会检查策略引用。', '退役索引'))
    await run(() => recommendationApi.retireIndex(id), '索引已退役')
}
async function preview() {
  previewResult.value = null
  await run(async () => {
    const response = await recommendationApi.preview(previewForm)
    previewResult.value = checked(response)
    return response
  }, '预览已生成')
}
onMounted(() => {
  void refresh()
  poll = setInterval(() => {
    if (tab.value === 'indexes') void refresh()
  }, 5000)
})
onScopeDispose(() => {
  disposed = true
  clearInterval(poll)
})
</script>

<style scoped>
.model-catalog-table {
  table-layout: fixed;
}
.model-catalog-table td {
  overflow-wrap: anywhere;
  vertical-align: top;
}
.model-details-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 40px;
  text-align: left;
}
.model-details-toggle:focus-visible,
.editor-heading:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
  border-radius: 4px;
}
.editor-heading {
  scroll-margin-top: 96px;
}

.recommendation-status {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 9999px;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}
.preview-dish-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
}
.preview-score-details {
  margin-left: 36px;
}
.preview-runtime summary,
.preview-score-details summary {
  padding-block: 8px;
}
.preview-runtime summary:focus-visible,
.preview-score-details summary:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
  border-radius: 4px;
}
</style>
