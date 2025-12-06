<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'">
        <div class="flex justify-between items-center mb-6">
          <Header
            title="食堂信息管理"
            description="管理食堂信息，包括添加、编辑和查看食堂详情"
            header-icon="carbon:restaurant"
          />
          <button
            class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
            @click="createNewCanteen"
          >
            <span class="iconify mr-1" data-icon="carbon:add"></span>
            新建食堂
          </button>
        </div>

        <!-- 搜索栏 -->
        <div class="mb-6">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索食堂名称、位置..."
            class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
          />
        </div>

        <!-- 食堂列表表格 -->
        <div class="overflow-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂信息</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">位置</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">窗口数量</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">评分</th>
                <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr
                v-for="canteen in filteredCanteens"
                :key="canteen.id"
                class="hover:bg-gray-50 cursor-pointer"
                @click="editCanteen(canteen)"
              >
                <td class="py-4 px-6">
                  <div class="flex items-center">
                    <img
                      v-if="canteen.images && canteen.images.length > 0"
                      :src="canteen.images[0]"
                      :alt="canteen.name"
                      class="w-12 h-12 rounded object-cover border mr-3"
                    />
                    <div
                      v-else
                      class="w-12 h-12 rounded bg-gray-200 flex items-center justify-center mr-3"
                    >
                      <span class="iconify text-gray-400" data-icon="carbon:building"></span>
                    </div>
                    <div>
                      <div class="font-medium">{{ canteen.name }}</div>
                      <div class="text-sm text-gray-500">
                        {{ canteen.description || '暂无描述' }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-6">{{ canteen.position || '未设置' }}</td>
                <td class="py-4 px-6">{{ canteen.windows?.length || 0 }} 个窗口</td>
                <td class="py-4 px-6">
                  <div class="flex items-center">
                    <span class="iconify text-yellow-400" data-icon="bxs:star"></span>
                    <span class="ml-1">{{ canteen.averageRating?.toFixed(1) || '暂无' }}</span>
                  </div>
                </td>
                <td class="py-4 px-6 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-2">
                    <button
                      class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                      @click="editCanteen(canteen)"
                      title="编辑"
                    >
                      <span class="iconify" data-icon="carbon:edit"></span>
                    </button>
                    <button
                      class="p-2 rounded-full hover:bg-gray-200 text-red-500"
                      @click="deleteCanteen(canteen)"
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
        <div v-if="filteredCanteens.length === 0" class="text-center py-12">
          <span class="iconify text-6xl text-gray-300 mx-auto" data-icon="carbon:building"></span>
          <p class="mt-4 text-gray-500">暂无食堂信息</p>
          <button
            class="mt-4 px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
            @click="createNewCanteen"
          >
            创建第一个食堂
          </button>
        </div>
      </div>

      <!-- 编辑/新建视图 -->
      <div v-else>
        <div class="flex justify-between items-center mb-6">
          <Header
            :title="editingCanteen ? '编辑食堂' : '新建食堂'"
            :description="editingCanteen ? '修改食堂信息' : '填写食堂信息并上传图片'"
            header-icon="carbon:restaurant"
          />
          <button
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <form class="space-y-6">
          <div class="grid grid-cols-2 gap-6">
            <!-- 左侧列 -->
            <div>
              <!-- 食堂名称 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">
                  食堂名称 <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  v-model="formData.name"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  placeholder="例如：紫荆园"
                  required
                />
              </div>

              <!-- 食堂位置 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">食堂位置</label>
                <input
                  type="text"
                  v-model="formData.position"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  placeholder="例如：清华大学紫荆公寓区"
                />
              </div>

              <!-- 楼层信息 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2"
                  >楼层信息 <span class="text-red-500">*</span></label
                >
                <input
                  type="text"
                  v-model="formData.floorInput"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  placeholder="例如：一层/二层/B1/地下二层（用/分隔）"
                  required
                />
                <p class="text-sm text-gray-500 mt-1">
                  请输入楼层信息，支持格式：一层、1F、B1、地下二层等，多层用"/"分隔
                </p>
              </div>

              <!-- 食堂描述 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">食堂描述</label>
                <textarea
                  v-model="formData.description"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple resize-none"
                  rows="4"
                  placeholder="请输入食堂描述..."
                ></textarea>
              </div>

              <!-- 食堂图片上传 -->
              <div>
                <label class="block text-gray-700 font-medium mb-2"
                  >食堂图片
                  <span class="text-sm text-gray-500 font-normal"
                    >（第一张将作为封面图，封面图将进行正方形裁剪，其他图片保留原比例）</span
                  ></label
                >

                <div class="flex gap-6 items-start">
                  <!-- 封面图（第一张） -->
                  <div class="relative group flex-shrink-0">
                    <div
                      class="w-[300px] h-[300px] border-2 border-dashed rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center"
                    >
                      <img
                        v-if="formData.imageFiles.length > 0"
                        :src="formData.imageFiles[0].url"
                        alt="封面图"
                        class="w-full h-full object-cover"
                      />
                      <div v-else class="text-center p-6 text-gray-400">
                        <span class="iconify text-4xl mx-auto" data-icon="bi:image"></span>
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
                          <span class="iconify text-xl" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </div>
                    <div class="text-center mt-2 text-sm text-gray-600 font-medium">
                      封面展示（正方形裁剪）
                    </div>
                  </div>

                  <!-- 其他图片及上传按钮（横向滚动） -->
                  <div class="flex-1 min-w-0">
                    <div
                      class="flex gap-4 overflow-x-auto pb-4 items-start"
                      style="min-height: 200px"
                    >
                      <!-- 其他图片列表 -->
                      <div
                        v-for="(img, index) in formData.imageFiles.slice(1)"
                        :key="img.id"
                        class="relative group flex-shrink-0 h-[200px]"
                      >
                        <!-- 图片：高度固定，宽度自适应 -->
                        <img
                          :src="img.url"
                          class="h-full w-auto rounded-lg border bg-gray-50 object-contain"
                        />

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
                            <span class="iconify" data-icon="carbon:image-copy"></span>
                          </button>
                          <button
                            type="button"
                            @click="removeImage(index + 1)"
                            class="p-1.5 bg-white/20 text-white rounded-full hover:bg-red-500 transition-colors"
                            title="删除图片"
                          >
                            <span class="iconify" data-icon="carbon:trash-can"></span>
                          </button>
                        </div>
                      </div>

                      <!-- 上传按钮 -->
                      <div
                        class="flex-shrink-0 w-[140px] h-[200px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-tsinghua-purple hover:border-tsinghua-purple transition-colors relative cursor-pointer bg-white"
                      >
                        <span class="iconify text-3xl mb-1" data-icon="carbon:add"></span>
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
                    <p class="text-sm text-gray-500">
                      其他图片将保持原比例展示，您可以横向滚动查看所有图片。
                    </p>
                  </div>
                </div>
                <p class="mt-2 text-sm text-gray-500">
                  建议上传清晰的图片，单张小于2MB，支持批量上传。封面图将展示为正方形，其他图片点击查看大图时保持原比例。
                </p>
              </div>
            </div>

            <!-- 右侧列 -->
            <div>
              <!-- 营业时间 -->
              <div class="mb-6">
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-gray-700 font-medium">营业时间</label>
                  <button
                    type="button"
                    class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                    @click="addOpeningHours"
                  >
                    <span class="iconify" data-icon="carbon:add-alt"></span>
                    添加营业时间
                  </button>
                </div>

                <div
                  v-if="formData.openingHours && formData.openingHours.length > 0"
                  class="space-y-3"
                >
                  <div
                    v-for="(hours, index) in formData.openingHours"
                    :key="index"
                    class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                  >
                    <div class="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">星期</label>
                        <select
                          v-model="hours.day"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        >
                          <option value="周一">周一</option>
                          <option value="周二">周二</option>
                          <option value="周三">周三</option>
                          <option value="周四">周四</option>
                          <option value="周五">周五</option>
                          <option value="周六">周六</option>
                          <option value="周日">周日</option>
                          <option value="每天">每天</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">开始时间</label>
                        <input
                          type="time"
                          v-model="hours.open"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">结束时间</label>
                        <input
                          type="time"
                          v-model="hours.close"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 px-2"
                      @click="removeOpeningHours(index)"
                      title="删除营业时间"
                    >
                      <span class="iconify" data-icon="carbon:trash-can"></span>
                    </button>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <p>可以添加多个营业时间段，例如：周一至周五 6:30-22:00</p>
                </div>
              </div>

              <!-- 窗口管理 -->
              <div class="mb-6" v-if="editingCanteen">
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-gray-700 font-medium">窗口管理</label>
                  <button
                    type="button"
                    class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                    @click="addWindow"
                  >
                    <span class="iconify" data-icon="carbon:add-alt"></span>
                    添加窗口
                  </button>
                </div>

                <div v-if="windows.length > 0" class="space-y-3">
                  <div
                    v-for="(window, index) in windows"
                    :key="window.id || index"
                    class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                  >
                    <div class="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1"
                          >窗口名称 <span class="text-red-500">*</span></label
                        >
                        <input
                          type="text"
                          v-model="window.name"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                          placeholder="例如：川湘风味"
                        />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1"
                          >窗口所在楼层 <span class="text-red-500">*</span></label
                        >
                        <select
                          v-model="window.floor"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        >
                          <option value="" disabled>请选择楼层</option>
                          <option
                            v-for="floor in availableFloors"
                            :key="floor.value"
                            :value="floor.value"
                          >
                            {{ floor.label }}
                          </option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">窗口编号</label>
                        <input
                          type="text"
                          v-model="window.number"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                          placeholder="例如：01、A01（选填）"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 px-2"
                      @click="removeWindow(index, window.id)"
                      title="删除窗口"
                    >
                      <span class="iconify" data-icon="carbon:trash-can"></span>
                    </button>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <p>点击"添加窗口"可以添加新窗口</p>
                </div>
              </div>
              <div v-else class="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div class="flex items-start">
                  <span
                    class="iconify text-blue-500 mt-1 mr-2"
                    data-icon="carbon:information"
                  ></span>
                  <div>
                    <h4 class="font-medium text-blue-800">窗口管理</h4>
                    <p class="text-sm text-blue-600 mt-1">
                      请先填写并保存食堂基本信息（包含楼层信息），保存成功后即可在此处添加和管理窗口。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 表单按钮 -->
          <div class="flex space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              @click="submitForm"
              :disabled="isSubmitting || isLoading"
            >
              <span class="iconify mr-1" data-icon="carbon:save"></span>
              {{ isSubmitting ? '提交中...' : editingCanteen ? '保存修改' : '保存食堂信息' }}
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

<script>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { canteenApi } from '@/api/modules/canteen'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'AddCanteen',
  components: {
    Header,
  },
  setup() {
    const router = useRouter()
    const isSubmitting = ref(false)
    const isLoading = ref(false)
    const viewMode = ref('list') // 'list' 或 'edit'
    const editingCanteen = ref(null) // 当前编辑的食堂
    const canteens = ref([]) // 食堂列表
    const searchQuery = ref('')

    const formData = reactive({
      name: '',
      position: '',
      description: '',
      imageFiles: [], // 替换原来的 image 和 imageUrl
      floorInput: '', // 添加楼层输入字段
      openingHours: [],
    })

    const windows = ref([]) // 窗口列表

    // 过滤后的食堂列表
    const filteredCanteens = computed(() => {
      if (!searchQuery.value) {
        return canteens.value
      }
      const query = searchQuery.value.toLowerCase()
      return canteens.value.filter(
        (canteen) =>
          canteen.name.toLowerCase().includes(query) ||
          (canteen.position && canteen.position.toLowerCase().includes(query)),
      )
    })

    // 加载食堂列表
    const loadCanteens = async () => {
      isLoading.value = true
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteens.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
        alert('加载食堂列表失败，请刷新重试')
      } finally {
        isLoading.value = false
      }
    }

    // 加载窗口列表
    const loadWindows = async (canteenId) => {
      try {
        const response = await canteenApi.getWindows(canteenId, { page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          // 转换窗口数据，将 floor 信息转换为下拉框可用的值
          windows.value = (response.data.items || []).map((w) => ({
            ...w,
            floor: w.floor ? w.floor.level || '' : '',
            floorLabel: w.floor ? w.floor.name || w.floor.level || '' : '',
          }))
        }
      } catch (error) {
        console.error('加载窗口列表失败:', error)
        windows.value = []
      }
    }

    // 创建新食堂
    const createNewCanteen = () => {
      editingCanteen.value = null
      resetForm()
      viewMode.value = 'edit'
    }

    // 编辑食堂
    const editCanteen = async (canteen) => {
      editingCanteen.value = canteen
      // 填充表单数据
      formData.name = canteen.name || ''
      formData.position = canteen.position || ''
      formData.description = canteen.description || ''

      // 处理图片
      formData.imageFiles = []
      if (canteen.images && canteen.images.length > 0) {
        formData.imageFiles = canteen.images.map((url, index) => ({
          id: `existing_${index}_${Date.now()}`,
          url: url,
          isNew: false,
        }))
      }

      // 处理楼层信息 - 从 canteen.floors 中恢复
      if (canteen.floors && Array.isArray(canteen.floors) && canteen.floors.length > 0) {
        formData.floorInput = canteen.floors.map((f) => f.name || f.level).join('/')
      } else {
        formData.floorInput = ''
      }

      // 处理营业时间 - 将 API 格式转换为表单格式
      // API 格式: { dayOfWeek, slots: [{ mealType, openTime, closeTime }], isClosed }
      // 表单格式: { day, open, close }
      if (canteen.openingHours && Array.isArray(canteen.openingHours)) {
        formData.openingHours = canteen.openingHours.map((h) => ({
          day: h.dayOfWeek || h.day || '每天',
          open: (h.slots && h.slots[0] && h.slots[0].openTime) || h.open || '06:30',
          close: (h.slots && h.slots[0] && h.slots[0].closeTime) || h.close || '22:00',
        }))
      } else {
        formData.openingHours = []
      }

      // 加载窗口列表
      await loadWindows(canteen.id)

      viewMode.value = 'edit'
    }

    // 删除食堂
    const deleteCanteen = async (canteen) => {
      if (!confirm(`确定要删除食堂"${canteen.name}"吗？此操作不可恢复！`)) {
        return
      }

      try {
        const response = await canteenApi.deleteCanteen(canteen.id)
        if (response.code === 200) {
          alert('删除成功！')
          loadCanteens()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除食堂失败:', error)
        alert(error instanceof Error ? error.message : '删除食堂失败，请重试')
      }
    }

    // 返回列表
    const backToList = () => {
      viewMode.value = 'list'
      editingCanteen.value = null
      resetForm()
    }

    // 重置表单
    const resetForm = () => {
      formData.name = ''
      formData.position = ''
      formData.description = ''
      formData.imageFiles = []
      formData.floorInput = ''
      formData.openingHours = []
      windows.value = []
    }

    const handleImageUpload = (event) => {
      const files = event.target.files
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => {
          // 验证文件大小
          if (file.size > 2 * 1024 * 1024) {
            alert(`图片 ${file.name} 大小超过2MB，已跳过`)
            return
          }

          const reader = new FileReader()
          reader.onload = (e) => {
            formData.imageFiles.push({
              id:
                window.crypto && window.crypto.randomUUID
                  ? window.crypto.randomUUID()
                  : `new_${Date.now()}_${Math.random()}`,
              file: file,
              url: e.target.result,
              isNew: true,
            })
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

    const addOpeningHours = () => {
      if (!formData.openingHours) {
        formData.openingHours = []
      }
      formData.openingHours.push({ day: '每天', open: '06:30', close: '22:00' })
    }

    const removeOpeningHours = (index) => {
      formData.openingHours.splice(index, 1)
    }

    // 添加窗口
    const addWindow = () => {
      if (!availableFloors.value.length) {
        alert('请先配置并保存楼层信息后再添加窗口')
        return
      }
      windows.value.push({
        name: '',
        number: '',
        floor: '',
        floorLabel: '',
        position: '',
        description: '',
        tags: [],
      })
    }

    // 删除窗口
    const removeWindow = async (index, windowId) => {
      if (windowId) {
        // 如果窗口已保存，需要调用删除接口
        if (!confirm('确定要删除这个窗口吗？')) {
          return
        }
        try {
          const response = await canteenApi.deleteWindow(windowId)
          if (response.code === 200) {
            windows.value.splice(index, 1)
            alert('删除成功！')
          } else {
            throw new Error(response.message || '删除失败')
          }
        } catch (error) {
          console.error('删除窗口失败:', error)
          alert(error instanceof Error ? error.message : '删除窗口失败，请重试')
        }
      } else {
        // 如果窗口未保存，直接移除
        windows.value.splice(index, 1)
      }
    }

    // 解析楼层
    const parseFloorLevel = (str) => {
      const s = str.trim()
      let multiplier = 1

      // 处理负数情况（B开头或包含地下）
      if (s.toUpperCase().startsWith('B') || s.includes('地下')) {
        multiplier = -1
      }

      // 尝试匹配数字
      const digitMatch = s.match(/\d+/)
      if (digitMatch) {
        return parseInt(digitMatch[0]) * multiplier
      }

      // 中文数字映射
      const chineseNumbers = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
      }

      // 尝试匹配中文数字
      for (const [key, val] of Object.entries(chineseNumbers)) {
        if (s.includes(key)) {
          return val * multiplier
        }
      }

      return null
    }

    // 可选楼层列表
    const availableFloors = computed(() => {
      if (!formData.floorInput) return []

      const floors = formData.floorInput
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s)
      const result = []

      for (const floorStr of floors) {
        const level = parseFloorLevel(floorStr)
        if (level !== null) {
          result.push({
            label: floorStr,
            value: level.toString(),
          })
        }
      }
      return result
    })

    const resolveWindowFloor = (value, fallbackLabel = '') => {
      if (!value) {
        return null
      }
      const match = availableFloors.value.find((f) => f.value === value)
      if (match) {
        return {
          level: match.value,
          name: match.label,
        }
      }
      const parsedLevel = parseFloorLevel(String(value))
      if (parsedLevel !== null) {
        return {
          level: parsedLevel.toString(),
          name: fallbackLabel || String(value),
        }
      }
      return null
    }

    const submitForm = async () => {
      // 表单验证
      if (!formData.name || !formData.name.trim()) {
        alert('请填写食堂名称')
        return
      }

      // 验证楼层输入
      if (!formData.floorInput || !formData.floorInput.trim()) {
        alert('请填写楼层信息')
        return
      }

      // 解析楼层
      const floorInputs = formData.floorInput
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s)
      const parsedFloors = []
      const seenLevels = new Set()

      for (const floorStr of floorInputs) {
        const level = parseFloorLevel(floorStr)

        if (level === null) {
          alert(`无法解析楼层信息: "${floorStr}"`)
          return
        }

        if (level > 5 || level < -2) {
          alert(`楼层范围必须在 -2 到 5 之间，"${floorStr}" 解析为 ${level} 层，超出范围`)
          return
        }

        if (seenLevels.has(level)) {
          // 允许同名楼层？一般不允许不同名字映射到同一层级，或者允许但提示
        }
        seenLevels.add(level)
        parsedFloors.push({
          level: level.toString(), // 转换为字符串存储
          name: floorStr,
        })
      }

      if (parsedFloors.length === 0) {
        alert('请至少输入一个有效的楼层')
        return
      }

      if (editingCanteen.value) {
        for (const window of windows.value) {
          if (!window.name || !window.name.trim()) {
            continue
          }
          if (!window.floor) {
            alert(`请先为窗口"${window.name}"选择楼层`)
            return
          }
          const floorInfo = resolveWindowFloor(window.floor, window.floorLabel || '')
          if (!floorInfo) {
            alert(`窗口"${window.name}"的楼层信息无效，请检查`)
            return
          }
        }
      }

      if (isSubmitting.value) {
        return
      }

      isSubmitting.value = true

      try {
        // 1. 上传图片（如果有新图片）
        let imageUrls = []
        if (formData.imageFiles && formData.imageFiles.length > 0) {
          try {
            const { dishApi } = await import('@/api/modules/dish')

            // 对每个图片项进行处理
            const processPromises = formData.imageFiles.map(async (imgItem) => {
              if (imgItem.isNew && imgItem.file) {
                // 新图片，需要上传
                const uploadResponse = await dishApi.uploadImage(imgItem.file)
                if (uploadResponse.code === 200 && uploadResponse.data) {
                  return uploadResponse.data.url
                } else {
                  throw new Error(uploadResponse.message || '图片上传失败')
                }
              } else {
                // 旧图片，直接使用 URL
                return imgItem.url
              }
            })

            const results = await Promise.allSettled(processPromises)

            imageUrls = results
              .filter((result) => result.status === 'fulfilled')
              .map((result) => result.value)

            if (imageUrls.length !== formData.imageFiles.length) {
              const failed = formData.imageFiles.length - imageUrls.length
              if (!confirm(`${failed}张图片处理失败，是否继续保存？`)) {
                isSubmitting.value = false
                return
              }
            }
          } catch (error) {
            console.error('图片上传失败:', error)
            alert('图片上传失败，请重试')
            isSubmitting.value = false
            return
          }
        }

        // 2. 构建窗口数据（仅用于新建食堂时）
        let windowsData = []
        if (!editingCanteen.value) {
          windowsData = windows.value
            .filter((w) => w.name && w.name.trim())
            .map((w) => ({
              name: w.name.trim(),
              number: w.number ? w.number.trim() : '',
              position: w.position || undefined,
              description: w.description || undefined,
              tags: w.tags || [],
            }))
        }

        // 3. 构建请求数据
        // 使用解析出的楼层信息，不再从窗口推导
        const requestData = {
          name: (formData.name || '').trim(),
          position: (formData.position || '').trim() || undefined,
          description: (formData.description || '').trim() || undefined,
          images: imageUrls.length > 0 ? imageUrls : [], // 必须是数组
          openingHours:
            formData.openingHours && formData.openingHours.length > 0
              ? formData.openingHours.map((hours) => ({
                  dayOfWeek: hours.day,
                  slots: [
                    {
                      mealType: 'default', // 添加必需的 mealType 字段
                      openTime: hours.open,
                      closeTime: hours.close,
                    },
                  ],
                  isClosed: false,
                }))
              : [], // 必须是数组
          floors: parsedFloors,
          ...(editingCanteen.value ? {} : { windows: windowsData }),
        }

        // 4. 创建或更新食堂
        let canteenId
        if (editingCanteen.value) {
          // 更新食堂
          const response = await canteenApi.updateCanteen(editingCanteen.value.id, requestData)
          if (response.code === 200 && response.data) {
            canteenId = response.data.id
            // 更新当前编辑对象，以防有返回的新数据
            editingCanteen.value = { ...editingCanteen.value, ...response.data }
            alert('食堂信息已更新！')
          } else {
            throw new Error(response.message || '更新食堂失败')
          }
        } else {
          // 创建食堂（窗口已包含在请求中，但现在新建时窗口部分被隐藏，所以为空）
          const response = await canteenApi.createCanteen(requestData)
          if (response.code === 200 && response.data) {
            canteenId = response.data.id
            editingCanteen.value = response.data // 设置为编辑模式
            viewMode.value = 'edit'
            alert('食堂创建成功！现在您可以添加窗口信息。')
            isSubmitting.value = false // 结束提交状态，允许继续操作
            return // 不返回列表，停留在编辑页面
          } else {
            throw new Error(response.message || '创建食堂失败')
          }
        }

        // 5. 仅在编辑模式下单独保存窗口信息（新建时流程已中断）
        if (editingCanteen.value && canteenId && windows.value.length > 0) {
          for (const window of windows.value) {
            if (!window.name || !window.name.trim()) {
              continue // 跳过未填写名称的窗口
            }

            // 解析窗口楼层
            const windowFloor = resolveWindowFloor(window.floor, window.floorLabel || '')
            if (!windowFloor) {
              console.warn(`窗口"${window.name}"无法解析楼层信息"${window.floor}"，跳过保存`)
              continue
            }

            const payload = {
              name: window.name.trim(),
              number: window.number ? window.number.trim() : '',
              floor: windowFloor,
              position: window.position || undefined,
              description: window.description || undefined,
              tags: window.tags && window.tags.length > 0 ? window.tags : undefined,
            }

            try {
              if (window.id) {
                // 更新窗口
                await canteenApi.updateWindow(window.id, payload)
              } else {
                // 创建窗口
                await canteenApi.createWindow({
                  ...payload,
                  canteenId: canteenId,
                })
              }
            } catch (error) {
              console.error('保存窗口失败:', error)
              // 继续处理其他窗口，不中断流程
            }
          }
        }

        // 5. 重新加载列表并返回
        await loadCanteens()
        backToList()
      } catch (error) {
        console.error('保存食堂失败:', error)
        alert(error instanceof Error ? error.message : '保存食堂失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    onMounted(() => {
      loadCanteens()
    })

    return {
      viewMode,
      editingCanteen,
      canteens,
      searchQuery,
      filteredCanteens,
      formData,
      windows,
      isSubmitting,
      isLoading,
      availableFloors,
      loadCanteens,
      createNewCanteen,
      editCanteen,
      deleteCanteen,
      backToList,
      handleImageUpload,
      addOpeningHours,
      removeOpeningHours,
      addWindow,
      removeWindow,
      submitForm,
      removeImage,
      setAsCover,
    }
  },
}
</script>
