<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header title="添加新菜品" description="填写菜品信息并上传图片" header-icon="carbon:document" />

      <p v-if="parentUploadId" role="status" class="mt-6 text-sm text-gray-600">
        父菜品已提交审核，信息已锁定。可继续填写子项，完成后点击“完成录入”。
      </p>

      <form class="mt-6 space-y-6">
        <div class="grid grid-cols-2 gap-6">
          <!-- 左侧列 -->
          <fieldset :disabled="Boolean(parentUploadId) || isSubmitting" class="min-w-0">
            <!-- 食堂信息组 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2"
                >食堂信息 <span class="text-red-500">*</span></label
              >
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-600 mb-1"
                    >食堂名称 <span class="text-red-500">*</span></label
                  >
                  <select
                    v-model="formData.canteenId"
                    @change="onCanteenChange"
                    @input="errors.canteenId = ''"
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                    :class="{
                      'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.canteenId,
                    }"
                    required
                  >
                    <option value="" disabled>选择食堂</option>
                    <option v-for="canteen in canteens" :key="canteen.id" :value="canteen.id">
                      {{ canteen.name }}
                    </option>
                  </select>
                  <p v-if="errors.canteenId" class="mt-1 text-xs text-red-500 flex items-center">
                    <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                    {{ errors.canteenId }}
                  </p>
                </div>
                <div v-if="formData.floor">
                  <label class="block text-sm text-gray-600 mb-1">食堂楼层</label>
                  <input
                    type="text"
                    v-model="formData.floor"
                    class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                    placeholder="自动填充"
                    readonly
                  />
                </div>
              </div>
            </div>

            <!-- 窗口信息 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2">窗口信息</label>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-600 mb-1"
                    >窗口名称 <span class="text-red-500">*</span></label
                  >
                  <select
                    v-model="formData.windowId"
                    @change="onWindowChange"
                    @input="errors.windowId = ''"
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                    :class="{
                      'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.windowId,
                    }"
                    :disabled="!formData.canteenId"
                    required
                  >
                    <option value="" disabled>选择窗口</option>
                    <option v-for="window in windows" :key="window.id" :value="window.id">
                      {{ window.name }}
                    </option>
                  </select>
                  <p v-if="errors.windowId" class="mt-1 text-xs text-red-500 flex items-center">
                    <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                    {{ errors.windowId }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm text-gray-600 mb-1">窗口编号</label>
                  <input
                    type="text"
                    v-model="formData.windowNumber"
                    class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                    placeholder="自动填充"
                    readonly
                  />
                </div>
              </div>
            </div>

            <!-- 菜品名称 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2"
                >菜品名称 <span class="text-red-500">*</span></label
              >
              <input
                type="text"
                v-model="formData.name"
                @input="errors.name = ''"
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                :class="{
                  'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.name,
                }"
                placeholder="例如：水煮肉片"
              />
              <p v-if="errors.name" class="mt-1 text-xs text-red-500 flex items-center">
                <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                {{ errors.name }}
              </p>
            </div>

            <!-- 菜品价格 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2">菜品价格（元）</label>
              <input
                type="number"
                v-model.number="formData.price"
                @input="errors.price = ''"
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                :class="{
                  'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.price,
                }"
                placeholder="例如：15.00（默认为0）"
                step="0.01"
                min="0"
              />
              <p v-if="errors.price" class="mt-1 text-xs text-red-500 flex items-center">
                <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                {{ errors.price }}
              </p>
              <p v-else class="mt-1 text-sm text-gray-500">如不填写，默认为0</p>
            </div>

            <!-- 菜品描述 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2">菜品描述</label>
              <textarea
                v-model="formData.description"
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple resize-none"
                rows="4"
                placeholder="请输入菜品描述..."
              ></textarea>
            </div>

            <!-- 菜品图片上传 -->
            <div>
              <label class="block text-gray-700 font-medium mb-2"
                >菜品图片
                <span class="text-sm text-gray-500 font-normal"
                  >（第一张将作为封面图，支持多图上传）</span
                ></label
              >

              <div class="flex gap-4 items-start">
                <!-- 封面图（第一张） -->
                <div class="relative group flex-shrink-0">
                  <div
                    class="w-[300px] h-[300px] border-2 border-dashed rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center"
                  >
                    <img
                      v-if="formData.imageFiles[0]?.preview"
                      :src="formData.imageFiles[0].preview"
                      alt="封面图"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="text-center p-6 text-gray-400">
                      <AppIcon class="iconify text-4xl mx-auto" icon="bi:image"></AppIcon>
                      <div class="mt-2 font-medium">封面图</div>
                      <p class="text-xs mt-1">点击右侧按钮添加</p>
                    </div>

                    <!-- 删除遮罩 -->
                    <div
                      v-if="formData.imageFiles.length > 0"
                      class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center gap-3 transition-all duration-200"
                    >
                      <button
                        type="button"
                        @click="removeImage(0)"
                        class="p-2 bg-white/20 text-white rounded-full hover:bg-red-500 transition-colors"
                        title="删除图片"
                      >
                        <AppIcon class="iconify text-xl" icon="carbon:trash-can"></AppIcon>
                      </button>
                    </div>
                  </div>
                  <div class="text-center mt-2 text-sm text-gray-600 font-medium">封面展示</div>
                </div>

                <!-- 其他图片及上传按钮 -->
                <div class="flex-1 flex flex-wrap gap-4 content-start">
                  <!-- 其他图片列表 -->
                  <div
                    v-for="(img, index) in formData.imageFiles.slice(1)"
                    :key="img.id"
                    class="relative group w-[140px] h-[140px]"
                  >
                    <div class="w-full h-full border rounded-lg overflow-hidden bg-gray-50">
                      <img v-if="img.preview" :src="img.preview" class="w-full h-full object-cover" />
                    </div>

                    <!-- 操作遮罩 -->
                    <div
                      class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center gap-2 rounded-lg transition-all duration-200"
                    >
                      <button
                        type="button"
                        @click="setAsCover(index + 1)"
                        class="p-1.5 bg-white/20 text-white rounded-full hover:bg-tsinghua-purple transition-colors"
                        title="设为封面"
                      >
                        <AppIcon class="iconify" icon="carbon:image-copy"></AppIcon>
                      </button>
                      <button
                        type="button"
                        @click="removeImage(index + 1)"
                        class="p-1.5 bg-white/20 text-white rounded-full hover:bg-red-500 transition-colors"
                        title="删除图片"
                      >
                        <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                      </button>
                    </div>
                  </div>

                  <!-- 上传按钮 -->
                  <div
                    class="w-[140px] h-[140px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-tsinghua-purple hover:border-tsinghua-purple transition-colors relative cursor-pointer bg-white"
                  >
                    <AppIcon class="iconify text-3xl mb-1" icon="carbon:add"></AppIcon>
                    <span class="text-sm">添加图片</span>
                    <input
                      type="file"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      @change="handleImageUpload"
                      accept="image/*"
                      multiple
                    />
                  </div>
                </div>
              </div>
              <p class="mt-2 text-sm text-gray-500">
                建议尺寸800x800像素，单张小于10MB，支持批量上传
              </p>
            </div>
          </fieldset>

          <!-- 右侧列 -->
          <div>
            <!-- 菜品子项（可选） -->
            <div class="mb-6">
              <div class="flex justify-between items-center mb-2">
                <label class="block text-gray-700 font-medium">
                  菜品子项
                  <span class="text-sm text-gray-500 font-normal ml-1"
                    >（可选，用于有多个规格的菜品）</span
                  >
                </label>
                <button
                  type="button"
                  class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                  @click="addSubItem"
                >
                  <AppIcon class="iconify" icon="carbon:add-alt"></AppIcon>
                  添加子项
                </button>
              </div>

              <div v-if="formData.subItems.length > 0" class="space-y-3">
                <!-- 子项行 -->
                <div
                  v-for="(item, index) in formData.subItems"
                  :key="index"
                  class="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div class="flex-1">
                    <input
                      type="text"
                      v-model="item.name"
                      class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                      placeholder="子项名称（如：小份、中份、大份）"
                      @blur="updateSubItemName(index, item.name)"
                      :disabled="Boolean(item.uploadId) || item.isSubmitting || isSubmitting"
                    />
                  </div>
                  <div class="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center text-sm"
                      @click="goToSubItemDetail(index)"
                      :disabled="Boolean(item.uploadId) || isSubmitting || !item.name || !item.name.trim()"
                    >
                      <AppIcon class="iconify mr-1" icon="carbon:view"></AppIcon>
                      {{ item.uploadId ? '已提交审核' : item.isSubmitting ? '提交中...' : '填写详情' }}
                    </button>
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 px-2"
                      @click="removeSubItem(index)"
                      title="删除子项"
                      :disabled="Boolean(item.uploadId) || item.isSubmitting || isSubmitting"
                    >
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <p>
                  如果菜品有多个规格、套餐或麻辣烫类型，可以添加子项。输入子项名称后，点击"填写详情"进入子项详情页面。
                </p>
              </div>
            </div>

            <fieldset :disabled="Boolean(parentUploadId) || isSubmitting" class="min-w-0">
            <!-- 供应信息组 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2">供应信息</label>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm text-gray-600 mb-1">菜系TAG</label>
                  <div class="space-y-2">
                    <!-- TAG 输入和添加按钮 -->
                    <div class="flex gap-2">
                      <input
                        type="text"
                        v-model="newTag"
                        class="flex-1 px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                        placeholder="输入TAG，例如：麻辣、油腻、日料等"
                        @keyup.enter="addTag"
                      />
                      <button
                        type="button"
                        @click="addTag"
                        class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                      >
                        <AppIcon class="iconify mr-1" icon="carbon:add-alt"></AppIcon>
                        添加
                      </button>
                    </div>
                    <!-- TAG 列表显示 -->
                    <div
                      v-if="formData.tags && formData.tags.length > 0"
                      class="flex flex-wrap gap-2"
                    >
                      <span
                        v-for="(tag, index) in formData.tags"
                        :key="index"
                        class="inline-flex items-center px-3 py-1 bg-tsinghua-purple/10 text-tsinghua-purple rounded-full text-sm"
                      >
                        #{{ tag }}
                        <button
                          type="button"
                          @click="removeTag(index)"
                          class="ml-2 text-tsinghua-purple hover:text-tsinghua-dark"
                        >
                          <AppIcon class="iconify text-xs" icon="carbon:close"></AppIcon>
                        </button>
                      </span>
                    </div>
                    <p v-else class="text-sm text-gray-500">
                      暂无TAG，可以添加如 #麻辣 #油腻 #日料 等标签
                    </p>
                  </div>
                </div>
                <div>
                  <label class="block text-sm text-gray-600 mb-1"
                    >口味指标（0-5分，0为无，5为最高，默认为0）</label
                  >
                  <div class="grid grid-cols-4 gap-3">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">辣度</label>
                      <input
                        type="number"
                        v-model.number="formData.spicyLevel"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                        placeholder="0"
                        min="0"
                        max="5"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">咸度</label>
                      <input
                        type="number"
                        v-model.number="formData.saltiness"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                        placeholder="0"
                        min="0"
                        max="5"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">甜度</label>
                      <input
                        type="number"
                        v-model.number="formData.sweetness"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                        placeholder="0"
                        min="0"
                        max="5"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">油度</label>
                      <input
                        type="number"
                        v-model.number="formData.oiliness"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                        placeholder="0"
                        min="0"
                        max="5"
                        step="0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 供应时间 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2">供应时间</label>
              <div class="space-y-2">
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    id="breakfast"
                    v-model="formData.servingTime.breakfast"
                    class="mr-2 h-4 w-4 text-tsinghua-purple"
                  />
                  <label for="breakfast">早餐</label>
                </div>
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    id="lunch"
                    v-model="formData.servingTime.lunch"
                    class="mr-2 h-4 w-4 text-tsinghua-purple"
                  />
                  <label for="lunch">午餐</label>
                </div>
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    id="dinner"
                    v-model="formData.servingTime.dinner"
                    class="mr-2 h-4 w-4 text-tsinghua-purple"
                  />
                  <label for="dinner">晚餐</label>
                </div>
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    id="night-food"
                    v-model="formData.servingTime.night"
                    class="mr-2 h-4 w-4 text-tsinghua-purple"
                  />
                  <label for="night-food">夜宵</label>
                </div>
              </div>
            </div>

            <!-- 供应日期段 -->
            <div class="mb-6">
              <div class="flex justify-between items-center mb-2">
                <label class="block text-gray-700 font-medium">供应日期段</label>
                <button
                  type="button"
                  class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                  @click="addDateRange"
                >
                  <AppIcon class="iconify" icon="carbon:add-alt"></AppIcon>
                  添加日期段
                </button>
              </div>
              <div
                v-if="formData.availableDates && formData.availableDates.length > 0"
                class="space-y-3"
              >
                <div
                  v-for="(dateRange, index) in formData.availableDates"
                  :key="index"
                  class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                >
                  <div class="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">开始日期</label>
                      <input
                        type="date"
                        v-model="dateRange.startDate"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">结束日期</label>
                      <input
                        type="date"
                        v-model="dateRange.endDate"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        :min="dateRange.startDate"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    class="text-red-500 hover:text-red-700 px-2"
                    @click="removeDateRange(index)"
                    title="删除日期段"
                  >
                    <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                  </button>
                </div>
              </div>
              <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <p>可以添加多个供应日期段，例如：2024-01-01 至 2024-03-31</p>
              </div>
            </div>

            <!-- 过敏原 -->
            <div class="mb-6">
              <label class="block text-gray-700 font-medium mb-2">过敏原</label>
              <input
                type="text"
                v-model="formData.allergens"
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                placeholder="例如：花生、牛奶、鸡蛋等"
              />
            </div>

            <!-- 原辅料 -->
            <div>
              <label class="block text-gray-700 font-medium mb-2">原辅料</label>
              <input
                type="text"
                v-model="formData.ingredients"
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                placeholder="例如：猪肉、豆芽、辣椒、花椒等"
              />
            </div>
            </fieldset>
          </div>
        </div>

        <!-- 表单按钮 -->
        <div class="flex space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            class="px-6 py-2 text-white rounded-lg transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            :class="authStore.hasPermission('dish:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="submitForm()"
            :disabled="isSubmitting || !authStore.hasPermission('dish:create')"
            :title="!authStore.hasPermission('dish:create') ? '无权限创建' : '保存菜品信息'"
          >
            <AppIcon class="iconify mr-1" icon="carbon:save"></AppIcon>
            {{ isSubmitting ? '提交中...' : parentUploadId ? '完成录入' : '保存菜品信息' }}
          </button>
          <button
            type="button"
            class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="resetForm"
            :disabled="isSubmitting"
          >
            {{ parentUploadId ? '开始新菜品' : '重置表单' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { reactive, ref, toRef, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { dishApi } from '@/api/modules/dish'
import { canteenApi } from '@/api/modules/canteen'
import Header from '@/components/Layout/Header.vue'
import { showAlert, showConfirm } from '@/composables/useModal'
import { dishComposition, getDishCompositionVersion, resetDishComposition } from '@/composables/dish-composition'
import { getAuthSessionVersion } from '@/utils/auth-session'

export default {
  name: 'SingleAdd',
  components: {
    Header,
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const isSubmitting = ref(false)
    const parentUploadId = toRef(dishComposition, 'parentUploadId')
    const formData = dishComposition.formData
    const viewSession = getAuthSessionVersion()
    let active = true
    onBeforeUnmount(() => { active = false })
    const isCurrent = (version) => active && viewSession === getAuthSessionVersion() && version === getDishCompositionVersion()

    const newTag = ref('')
    const canteens = ref([])
    const windows = ref([])

    // 表单错误状态
    const errors = reactive({
      name: '',
      canteenId: '',
      windowId: '',
      price: '',
    })

    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteens.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      }
    }

    let windowRequest = 0
    const loadWindows = async (canteenId) => {
      const version = getDishCompositionVersion()
      if (!isCurrent(version)) return
      const request = ++windowRequest
      const ownsRequest = () => isCurrent(version) && request === windowRequest && formData.canteenId === canteenId
      windows.value = []
      if (!canteenId) return
      try {
        const response = await canteenApi.getWindows(canteenId, { page: 1, pageSize: 100 })
        if (!ownsRequest()) return
        if (response.code === 200 && response.data) {
          windows.value = response.data.items || []
        }
      } catch (error) {
        if (!ownsRequest()) return
        console.error('加载窗口列表失败:', error)
        windows.value = []
      }
    }

    const onCanteenChange = () => {
      const selectedCanteen = canteens.value.find((c) => c.id === formData.canteenId)
      if (selectedCanteen) {
        formData.canteen = selectedCanteen.name
      } else {
        formData.canteen = ''
      }
      loadWindows(selectedCanteen ? formData.canteenId : '')
      // 重置窗口选择
      formData.windowId = ''
      formData.windowName = ''
      formData.windowNumber = ''
      formData.floor = ''
    }

    const onWindowChange = () => {
      const selectedWindow = windows.value.find((w) => w.id === formData.windowId)
      if (selectedWindow) {
        formData.windowName = selectedWindow.name
        formData.windowNumber = selectedWindow.number
        // 如果窗口有楼层信息，自动填充（虽然不需要提交，但可能用于展示）
        if (selectedWindow.floor) {
          formData.floor = selectedWindow.floor.name || selectedWindow.floor.level || ''
        }
      } else {
        formData.windowName = ''
        formData.windowNumber = ''
        formData.floor = ''
      }
    }

    onMounted(() => {
      loadCanteens()
      if (formData.canteenId) loadWindows(formData.canteenId)
    })

    const addSubItem = () => {
      formData.subItems.push({
        name: '',
        tempId: `temp_${Date.now()}_${Math.random()}`, // 临时ID用于标识
      })
    }

    const removeSubItem = (index) => {
      formData.subItems.splice(index, 1)
    }

    const updateSubItemName = (index, name) => {
      if (formData.subItems[index]) {
        formData.subItems[index].name = name
      }
    }

    const goToSubItemDetail = async (index) => {
      const version = getDishCompositionVersion()
      if (!isCurrent(version) || isSubmitting.value) return
      const subItem = formData.subItems[index]
      if (!subItem || !subItem.name || !subItem.name.trim()) {
        showAlert('请先输入子项名称')
        return
      }
      if (subItem.uploadId) return

      // 先提交父项的待审记录，再关联子项。
      if (!parentUploadId.value) {
        // 先保存父菜品，不进行跳转
        await submitForm(false)
        // 如果保存失败，submitForm 会显示错误，这里直接返回
        if (!isCurrent(version) || !parentUploadId.value) {
          return
        }
      }

      router.push({
        path: '/add-sub-dish',
        query: {
          parentUploadId: parentUploadId.value,
          subItemName: subItem.name,
          subItemTempId: subItem.tempId,
          subItemIndex: index,
        },
      })
    }

    const addDateRange = () => {
      if (!formData.availableDates) {
        formData.availableDates = []
      }
      formData.availableDates.push({ startDate: '', endDate: '' })
    }

    const removeDateRange = (index) => {
      formData.availableDates.splice(index, 1)
    }

    const addTag = () => {
      const tag = newTag.value.trim()
      if (tag && !formData.tags.includes(tag)) {
        formData.tags.push(tag)
        newTag.value = ''
      } else if (formData.tags.includes(tag)) {
        showAlert('该TAG已存在')
      }
    }

    const removeTag = (index) => {
      formData.tags.splice(index, 1)
    }

    const handleImageUpload = (event) => {
      const version = getDishCompositionVersion()
      const files = event.target.files
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => {
          // 验证文件大小
          if (file.size > 10 * 1024 * 1024) {
            showAlert(`图片 ${file.name} 大小超过10MB，已跳过`)
            return
          }

          const image = reactive({
            id: window.crypto?.randomUUID?.() || `img_${Date.now()}_${Math.random()}`,
            file,
            preview: '',
          })
          formData.imageFiles.push(image)
          const reader = new FileReader()
          reader.onload = (e) => {
            if (viewSession !== getAuthSessionVersion() || version !== getDishCompositionVersion()) return
            image.preview = e.target.result
          }
          reader.readAsDataURL(file)
        })
      }
      // 清空 input value 以允许重复上传同一文件
      event.target.value = ''
    }

    const removeImage = (index) => {
      formData.imageFiles.splice(index, 1)
    }

    const setAsCover = (index) => {
      if (index > 0 && index < formData.imageFiles.length) {
        const item = formData.imageFiles.splice(index, 1)[0]
        formData.imageFiles.unshift(item)
      }
    }

    const submitForm = async (redirect = true) => {
      const version = getDishCompositionVersion()
      if (!isCurrent(version) || isSubmitting.value) return
      if (!authStore.hasPermission('dish:create')) {
        showAlert('您没有权限创建菜品')
        return
      }
      if (parentUploadId.value) {
        if (redirect) await finishComposition()
        return
      }
      
      // 清除之前的错误
      errors.name = ''
      errors.canteenId = ''
      errors.windowId = ''
      errors.price = ''
      
      // 表单验证
      let hasError = false
      
      if (!formData.name || !formData.name.trim()) {
        errors.name = '请输入菜品名称'
        hasError = true
      }
      
      if (!formData.canteenId) {
        errors.canteenId = '请选择食堂'
        hasError = true
      }
      
      if (!formData.windowId) {
        errors.windowId = '请选择窗口'
        hasError = true
      }

      // 验证价格：必须为数字，默认为0
      let dishPrice = 0

      if (formData.price !== null && formData.price !== undefined && formData.price !== '') {
        dishPrice = parseFloat(formData.price)
        if (isNaN(dishPrice) || dishPrice < 0) {
          errors.price = '价格必须为有效的数字（大于等于0）'
          hasError = true
        }
      }
      
      if (hasError) {
        return
      }
      // 如果都没有，使用默认值0

      if (isSubmitting.value) {
        return
      }

      isSubmitting.value = true

      try {
        // 1. 上传所有图片
        let imageUrls = []
        if (formData.imageFiles && formData.imageFiles.length > 0) {
          try {
            // 并行上传所有图片
            const uploadPromises = formData.imageFiles.map((imgItem) =>
              dishApi.uploadImage(imgItem.file),
            )
            const results = await Promise.all(uploadPromises)
            if (!isCurrent(version)) return

            // 收集成功上传的 URL
            imageUrls = results
              .filter((res) => res.code === 200 && res.data)
              .map((res) => res.data.url)

            const failed = formData.imageFiles.length - imageUrls.length
            if (failed > 0) {
              const confirmed = await showConfirm(
                `${failed}张图片上传失败，是否继续？`,
                '图片上传失败'
              )
              if (!isCurrent(version)) return
              if (!confirmed) {
                isSubmitting.value = false
                return
              }
            }
          } catch (error) {
            if (!isCurrent(version)) return
            console.error('图片上传失败:', error)
            showAlert('图片上传失败，请重试')
            isSubmitting.value = false
            return
          }
        }

        // 2. 构建请求数据
        // 处理TAG（使用formData.tags数组）
        const tags = formData.tags && formData.tags.length > 0 ? formData.tags : undefined

        // 处理供应时间
        const availableMealTime = []
        if (formData.servingTime.breakfast) availableMealTime.push('breakfast')
        if (formData.servingTime.lunch) availableMealTime.push('lunch')
        if (formData.servingTime.dinner) availableMealTime.push('dinner')
        if (formData.servingTime.night) availableMealTime.push('nightsnack')

        // 处理原辅料和过敏原（转换为数组）
        const ingredients = formData.ingredients
          ? formData.ingredients
              .split(/[，,、]/)
              .map((item) => item.trim())
              .filter((item) => item)
          : []

        const allergens = formData.allergens
          ? formData.allergens
              .split(/[，,、]/)
              .map((item) => item.trim())
              .filter((item) => item)
          : []

        // 处理供应日期段（过滤掉空的日期段）
        const availableDates =
          formData.availableDates && formData.availableDates.length > 0
            ? formData.availableDates
                .filter((range) => range.startDate && range.endDate)
                .map((range) => ({
                  startDate: range.startDate,
                  endDate: range.endDate,
                }))
            : undefined

        // 构建菜品创建请求
        const dishData = {
          name: formData.name,
          canteenId: formData.canteenId,
          windowId: formData.windowId,
          canteenName: formData.canteen,
          windowName: formData.windowName,
          windowNumber: formData.windowNumber || formData.windowName, // 如果没有编号，使用窗口名称
          price: dishPrice,
          description: formData.description || undefined,
          images: imageUrls.length > 0 ? imageUrls : undefined,
          tags: tags,
          ingredients: ingredients.length > 0 ? ingredients : undefined,
          allergens: allergens.length > 0 ? allergens : undefined,
          spicyLevel:
            formData.spicyLevel !== null && formData.spicyLevel !== undefined
              ? formData.spicyLevel
              : 0,
          saltiness:
            formData.saltiness !== null && formData.saltiness !== undefined
              ? formData.saltiness
              : 0,
          sweetness:
            formData.sweetness !== null && formData.sweetness !== undefined
              ? formData.sweetness
              : 0,
          oiliness:
            formData.oiliness !== null && formData.oiliness !== undefined ? formData.oiliness : 0,
          availableMealTime: availableMealTime.length > 0 ? availableMealTime : undefined,
          availableDates: availableDates,
        }

        // 3. 调用 API 创建菜品
        const response = await dishApi.createDish(dishData)
        if (!isCurrent(version)) return

        if (response.code === 200 || response.code === 201) {
          if (response.data) {
            parentUploadId.value = response.data.id
          }

          if (redirect && formData.subItems.length === 0) {
            showAlert('菜品提交成功，已进入审核列表！')
            clearForm()
            router.push(authStore.hasPermission('upload:approve') ? '/review-dish' : '/single-add')
          } else {
            showAlert('父菜品已提交审核！')
          }
        } else {
          throw new Error(response.message || '创建菜品失败')
        }
      } catch (error) {
        if (!isCurrent(version)) return
        console.error('创建菜品失败:', error)
        showAlert(error instanceof Error ? error.message : '创建菜品失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    const clearForm = () => {
      resetDishComposition()
      newTag.value = ''
      windows.value = []
      Object.keys(errors).forEach((key) => { errors[key] = '' })
    }

    const resetForm = async () => {
      const version = getDishCompositionVersion()
      if (!isCurrent(version) || isSubmitting.value) return false
      const unfinished = formData.subItems.filter((item) => !item.uploadId).length
      if (parentUploadId.value && unfinished > 0) {
        const confirmed = await showConfirm(`还有${unfinished}个子项未提交，结束录入将清除这些子项草稿。是否继续？`, '结束录入')
        if (!confirmed || !isCurrent(version)) return false
      }
      clearForm()
      return true
    }

    const finishComposition = async () => {
      if (await resetForm() && active && viewSession === getAuthSessionVersion()) {
        router.push(authStore.hasPermission('upload:approve') ? '/review-dish' : '/single-add')
      }
    }

    return {
      formData,
      errors,
      canteens,
      windows,
      newTag,
      isSubmitting,
      parentUploadId,
      loadCanteens,
      onCanteenChange,
      onWindowChange,
      addSubItem,
      removeSubItem,
      updateSubItemName,
      goToSubItemDetail,
      addDateRange,
      removeDateRange,
      addTag,
      removeTag,
      handleImageUpload,
      removeImage,
      setAsCover,
      submitForm,
      resetForm,
      authStore,
    }
  },
}
</script>
