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
            class="px-6 py-2 text-white rounded-lg transition duration-200 flex items-center"
            :class="authStore.hasPermission('canteen:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('canteen:create') ? null : createNewCanteen()"
            :title="!authStore.hasPermission('canteen:create') ? '无权限新建' : '新建食堂'"
          >
            <AppIcon class="iconify mr-1" icon="carbon:add"></AppIcon>
            新建食堂
          </button>
        </div>

        <!-- 搜索栏 -->
        <div class="mb-6">
          <div class="relative">
            <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="搜索食堂名称、位置..."
              class="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
            />
            <button
              v-if="searchQuery"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              @click="searchQuery = ''"
              type="button"
              title="清除搜索"
            >
              <AppIcon class="iconify" icon="carbon:close"></AppIcon>
            </button>
          </div>
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
                      <AppIcon class="iconify text-gray-400" icon="carbon:building"></AppIcon>
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
                    <AppIcon class="iconify text-yellow-400" icon="bxs:star"></AppIcon>
                    <span class="ml-1">{{ canteen.averageRating?.toFixed(1) || '暂无' }}</span>
                  </div>
                </td>
                <td class="py-4 px-6 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-2">
                    <button
                      class="p-2 rounded-full hover:bg-gray-200"
                      :class="authStore.hasPermission('canteen:edit') ? 'text-tsinghua-purple' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('canteen:edit') ? null : editCanteen(canteen)"
                      :title="!authStore.hasPermission('canteen:edit') ? '无权限编辑' : '编辑'"
                    >
                      <AppIcon class="iconify" icon="carbon:edit"></AppIcon>
                    </button>
                    <button
                      class="p-2 rounded-full hover:bg-gray-200"
                      :class="authStore.hasPermission('canteen:delete') ? 'text-red-500' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('canteen:delete') ? null : deleteCanteen(canteen)"
                      :title="!authStore.hasPermission('canteen:delete') ? '无权限删除' : '删除'"
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
        <div v-if="filteredCanteens.length === 0" class="text-center py-12">
          <AppIcon class="iconify text-6xl text-gray-300 mx-auto" icon="carbon:building"></AppIcon>
          <p class="mt-4 text-gray-500">暂无食堂信息</p>
          <button
            class="mt-4 px-6 py-2 text-white rounded-lg transition duration-200"
            :class="authStore.hasPermission('canteen:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('canteen:create') ? null : createNewCanteen()"
            :title="!authStore.hasPermission('canteen:create') ? '无权限新建' : '创建第一个食堂'"
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
          <fieldset :disabled="isSubmitting" class="grid grid-cols-2 gap-6">
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
                  @input="errors.name = ''"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  :class="{
                    'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.name,
                  }"
                  placeholder="例如：紫荆园"
                  required
                />
                <p v-if="errors.name" class="mt-1 text-xs text-red-500 flex items-center">
                  <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                  {{ errors.name }}
                </p>
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
                <div class="space-y-3">
                  <div v-for="(floor, index) in formData.floors" :key="floor.key" class="flex items-end gap-3">
                    <label class="w-24 flex-shrink-0 text-xs text-gray-500">
                      层级
                      <input
                        type="text"
                        :value="floor.level"
                        @change="changeFloorLevel(floor, $event)"
                        aria-label="楼层层级"
                        class="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        placeholder="例如：1"
                        required
                      />
                    </label>
                    <label class="flex-1 text-xs text-gray-500">
                      名称
                      <input
                        type="text"
                        v-model="floor.name"
                        aria-label="楼层名称"
                        class="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        placeholder="例如：自选餐厅"
                      />
                    </label>
                    <button type="button" class="text-red-500 p-2" title="删除楼层" @click="removeFloor(index)">
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                  </div>
                  <button type="button" class="text-tsinghua-purple text-sm" @click="addFloor">添加楼层</button>
                </div>
                <p v-if="errors.floors" class="mt-1 text-xs text-red-500 flex items-center">
                  <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                  {{ errors.floors }}
                </p>
                <p v-else class="text-sm text-gray-500 mt-1">
                  每层单独填写层级和名称，例如层级 1、名称“一层”；地下楼层可填写 -1。
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
                        class="flex-shrink-0 w-[140px] h-[200px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-tsinghua-purple hover:border-tsinghua-purple transition-colors relative cursor-pointer bg-white"
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
                    <p class="text-sm text-gray-500">
                      其他图片将保持原比例展示，您可以横向滚动查看所有图片。
                    </p>
                  </div>
                </div>
                <p class="mt-2 text-sm text-gray-500">
                  建议上传清晰的图片，单张小于10MB，支持批量上传。封面图将展示为正方形，其他图片点击查看大图时保持原比例。
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
                  v-if="editingCanteen"
                  type="button"
                  class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                  @click="addOpeningHours"
                >
                  <AppIcon class="iconify" icon="carbon:add-alt"></AppIcon>
                  添加营业时间
                </button>
              </div>

              <div v-if="editingCanteen">
                <div
                  v-if="formData.openingHours && formData.openingHours.length > 0"
                  class="space-y-3"
                >
                  <div
                    v-for="(hours, index) in formData.openingHours"
                    :key="index"
                    class="flex items-start gap-3 p-3 border rounded-lg bg-gray-50"
                  >
                    <div class="flex-1 space-y-3">
                    <div class="grid grid-cols-3 gap-3 items-end">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">楼层</label>
                        <select
                          v-model="hours.floor"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        >
                          <option value="">通用</option>
                          <option v-if="hours.floor === 'default'" value="default">通用</option>
                          <option v-if="isUnresolvedFloor(hours.floor)" :value="hours.floor" disabled>
                            原层级 {{ hours.floor.level }}（请选择具体楼层）
                          </option>
                          <option
                            v-for="floor in availableFloors"
                            :key="floor.key"
                            :value="floor.value"
                          >
                            {{ floor.label }}
                          </option>
                        </select>
                      </div>
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
                      <label class="flex items-center gap-2 py-2 text-sm text-gray-700">
                        <input type="checkbox" v-model="hours.isClosed" aria-label="当日休息" />
                        当日休息
                      </label>
                    </div>
                    <div v-for="(slot, slotIndex) in hours.slots" :key="slotIndex" class="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">餐次</label>
                        <select
                          v-model="slot.mealType"
                          :disabled="hours.isClosed"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        >
                          <option value="breakfast">早餐</option>
                          <option value="lunch">午餐</option>
                          <option value="dinner">晚餐</option>
                          <option value="nightsnack">夜宵</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">开始时间</label>
                        <input
                          type="time"
                          v-model="slot.openTime"
                          :disabled="hours.isClosed"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">结束时间</label>
                        <input
                          type="time"
                          v-model="slot.closeTime"
                          :disabled="hours.isClosed"
                          class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                        />
                      </div>
                      <button type="button" class="text-red-500 p-2" title="删除餐次" @click="hours.slots.splice(slotIndex, 1)">
                        <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                      </button>
                    </div>
                    <button type="button" class="text-tsinghua-purple text-sm" :disabled="hours.isClosed" @click="addMealSlot(hours)">添加餐次</button>
                    </div>
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 px-2"
                      @click="removeOpeningHours(index)"
                      title="删除营业时间"
                    >
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <p>点击"添加营业时间"设置不同楼层的营业时间，例如：一层 周一至周五 6:30-22:00</p>
                </div>
              </div>
              <div v-else class="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div class="flex items-start">
                  <AppIcon
                    class="iconify text-blue-500 mt-1 mr-2"
                    icon="carbon:information"
                  ></AppIcon>
                  <div>
                    <h4 class="font-medium text-blue-800">营业时间管理</h4>
                    <p class="text-sm text-blue-600 mt-1">
                      请先填写并保存食堂基本信息（包含楼层信息），保存成功后即可在此处添加和管理营业时间。
                    </p>
                  </div>
                </div>
              </div>
            </div>

              <!-- 窗口管理 -->
              <div class="mb-6" v-if="editingCanteen">
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-gray-700 font-medium">窗口管理</label>
                  <button
                    type="button"
                    class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                    :disabled="isWindowsLoading || windowsLoadError"
                    @click="addWindow"
                  >
                    <AppIcon class="iconify" icon="carbon:add-alt"></AppIcon>
                    添加窗口
                  </button>
                </div>

                <p v-if="isWindowsLoading" role="status" class="text-sm text-gray-500">正在加载窗口...</p>
                <div v-else-if="windowsLoadError" role="alert" class="text-sm text-red-500">
                  窗口加载失败，请重试后保存。
                  <button type="button" class="underline" @click="retryLoadWindows">重试</button>
                </div>
                <div v-else-if="windows.length > 0" class="max-h-[400px] overflow-y-auto space-y-3 pr-2">
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
                            :key="floor.key"
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
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <p>点击"添加窗口"可以添加新窗口</p>
                </div>
              </div>
              <div v-else class="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div class="flex items-start">
                  <AppIcon
                    class="iconify text-blue-500 mt-1 mr-2"
                    icon="carbon:information"
                  ></AppIcon>
                  <div>
                    <h4 class="font-medium text-blue-800">窗口管理</h4>
                    <p class="text-sm text-blue-600 mt-1">
                      请先填写并保存食堂基本信息（包含楼层信息），保存成功后即可在此处添加和管理窗口。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- 表单按钮 -->
          <div class="flex space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              @click="submitForm"
              :disabled="isSubmitting || isLoading || isWindowsLoading || windowsLoadError"
            >
              <AppIcon class="iconify mr-1" icon="carbon:save"></AppIcon>
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
import { reactive, ref, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount, watch } from 'vue'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import { showAlert, showConfirm, showConfirmDanger } from '@/composables/useModal'
import { authSessionVersion, getAuthSessionVersion } from '@/utils/auth-session'
import { toOpeningHoursForm, fromOpeningHoursForm } from '@/utils/canteen-opening-hours'

export default {
  name: 'AddCanteen',
  components: {
    Header,
  },
  setup() {
    const authStore = useAuthStore()
    const editorSession = ref(null)
    const isSubmitting = computed(() => editorSession.value?.submitting || false)
    const isWindowsLoading = computed(() => editorSession.value?.loading || false)
    const windowsLoadError = computed(() => editorSession.value?.loadError || false)
    const viewSession = getAuthSessionVersion()
    let active = true
    let viewVersion = 0
    let listRequest = 0
    const ownsSession = () => viewSession === getAuthSessionVersion()
    const ownsEditor = (owner) => owner && editorSession.value === owner && ownsSession()
    const isCurrentEditor = (owner, version = viewVersion) =>
      ownsEditor(owner) && active && version === viewVersion
    const beginEditor = (canteenId = null) => {
      editorSession.value = { canteenId, loading: false, loadError: false, submitting: false }
      return editorSession.value
    }
    const isLoading = ref(false)
    const viewMode = ref('list') // 'list' 或 'edit'
    const editingCanteen = ref(null) // 当前编辑的食堂
    const canteens = ref([]) // 食堂列表
    const searchQuery = ref('')
    let floorKey = 0
    const toFloorDrafts = (floors) => floors.map(({ id, level, name }) => ({
      key: ++floorKey, id, level, name,
    }))

    const formData = reactive({
      name: '',
      position: '',
      description: '',
      imageFiles: [], // 替换原来的 image 和 imageUrl
      floors: [],
      openingHours: [],
    })

    const windows = ref([]) // 窗口列表

    const isUnresolvedFloor = (floor) => typeof floor === 'object' && !formData.floors.includes(floor)

    const applySavedFloors = (floors, submittedFloors) => {
      const levelCounts = new Map()
      for (const floor of floors) levelCounts.set(floor.level, (levelCounts.get(floor.level) || 0) + 1)
      formData.floors = floors.map(({ id, level, name }) => {
        const submitted = submittedFloors.find(({ payload }) =>
          payload.id ? payload.id === id : payload.level === level && levelCounts.get(level) === 1)
        if (submitted) return Object.assign(submitted.draft, { id, level, name })
        return toFloorDrafts([{ id, level, name }])[0]
      })
    }

    // 表单错误状态
    const errors = reactive({
      name: '',
      floors: '',
    })

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
      if (!active || !ownsSession()) return
      const request = ++listRequest
      const version = viewVersion
      const isCurrent = () => active && ownsSession() && request === listRequest && version === viewVersion
      isLoading.value = true
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (!isCurrent()) return
        if (response.code === 200 && response.data) {
          canteens.value = response.data.items || []
        }
      } catch (error) {
        if (!isCurrent()) return
        console.error('加载食堂列表失败:', error)
        showAlert('加载食堂列表失败，请刷新重试')
      } finally {
        if (isCurrent()) isLoading.value = false
      }
    }

    // 加载窗口列表
    const loadWindows = async (owner) => {
      const version = viewVersion
      owner.loading = true
      owner.loadError = false
      try {
        const response = await canteenApi.getWindows(owner.canteenId, { page: 1, pageSize: 100 })
        if (!isCurrentEditor(owner, version)) return
        if (response.code === 200 && response.data) {
          windows.value = (response.data.items || []).map((w) => {
            const floor = w.floor && formData.floors.find(floor => floor.id === w.floor.id)
            return { ...w, floor: floor || '' }
          })
        } else {
          throw new Error(response.message || '加载窗口列表失败')
        }
      } catch (error) {
        if (!isCurrentEditor(owner, version)) return
        console.error('加载窗口列表失败:', error)
        owner.loadError = true
      } finally {
        if (isCurrentEditor(owner, version)) owner.loading = false
      }
    }

    const retryLoadWindows = () => {
      const owner = editorSession.value
      if (isCurrentEditor(owner) && !owner.loading) return loadWindows(owner)
    }

    // 创建新食堂
    const createNewCanteen = () => {
      if (!authStore.hasPermission('canteen:create')) {
        showAlert('您没有权限创建食堂')
        return
      }
      if (!active || !ownsSession()) return
      beginEditor()
      editingCanteen.value = null
      resetForm()
      viewMode.value = 'edit'
    }

    // 编辑食堂
    const editCanteen = async (canteen) => {
      if (!authStore.hasPermission('canteen:edit')) {
        showAlert('您没有权限编辑食堂')
        return
      }
      if (!active || !ownsSession()) return
      const owner = beginEditor(canteen.id)
      resetForm()
      editingCanteen.value = canteen
      viewMode.value = 'edit'
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

      formData.floors = toFloorDrafts(canteen.floors || [])

      formData.openingHours = toOpeningHoursForm(canteen.openingHours).map(hours => {
        if (hours.floor === '' || hours.floor === 'default') return hours
        const floors = formData.floors.filter(floor => floor.level === hours.floor)
        return { ...hours, floor: floors.length === 1 ? floors[0] : { level: hours.floor } }
      })

      // 加载窗口列表
      await loadWindows(owner)
    }

    // 删除食堂
    const deleteCanteen = async (canteen) => {
      if (!authStore.hasPermission('canteen:delete')) {
        showAlert('您没有权限删除食堂')
        return
      }
      const confirmed = await showConfirmDanger(
        `确定要删除食堂"${canteen.name}"吗？此操作不可恢复！`,
        '确认删除'
      )
      if (!confirmed) {
        return
      }

      try {
        const response = await canteenApi.deleteCanteen(canteen.id)
        if (response.code === 200) {
          showAlert('删除成功！')
          loadCanteens()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除食堂失败:', error)
        showAlert(error instanceof Error ? error.message : '删除食堂失败，请重试')
      }
    }

    // 返回列表
    const backToList = () => {
      editorSession.value = null
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
      formData.floors = []
      formData.openingHours = []
      windows.value = []
      errors.name = ''
      errors.floors = ''
    }

    const handleImageUpload = (event) => {
      const owner = editorSession.value
      const version = viewVersion
      const files = event.target.files
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => {
          // 验证文件大小
          if (file.size > 10 * 1024 * 1024) {
            showAlert(`图片 ${file.name} 大小超过10MB，已跳过`)
            return
          }

          const reader = new FileReader()
          reader.onload = (e) => {
            if (!isCurrentEditor(owner, version)) return
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
      formData.openingHours.push({ day: '每天', floor: '', isClosed: false, slots: [{ mealType: 'breakfast', openTime: '06:30', closeTime: '22:00' }] })
    }

    const addMealSlot = (hours) => {
      hours.slots.push({ mealType: 'breakfast', openTime: '06:30', closeTime: '22:00' })
    }

    const removeOpeningHours = (index) => {
      formData.openingHours.splice(index, 1)
    }

    const addFloor = () => {
      formData.floors.push(...toFloorDrafts([{ level: '', name: '' }]))
      errors.floors = ''
    }

    const removeFloor = (index) => {
      const floor = formData.floors[index]
      if (windows.value.some(window => window.floor === floor) ||
        formData.openingHours.some(hours => hours.floor === floor)) {
        showAlert(`楼层"${floor.name || floor.level}"仍被窗口或营业时间引用，请先重新选择楼层或删除对应条目`)
        return
      }
      formData.floors.splice(index, 1)
      errors.floors = ''
    }

    const floorLevelError = (level, currentFloor) => {
      if (!level.trim()) return '请填写楼层层级'
      if (level === 'default') return 'default 是通用营业时间的保留值，请填写实际楼层层级'
      if (formData.floors.some(floor => floor !== currentFloor && floor.level === level)) return '楼层层级不能重复'
      return ''
    }

    const changeFloorLevel = (floor, event) => {
      const level = event.target.value
      errors.floors = floorLevelError(level, floor)
      if (errors.floors) {
        event.target.value = floor.level
        return
      }
      floor.level = level
    }

    // 添加窗口
    const addWindow = () => {
      if (isWindowsLoading.value || windowsLoadError.value) return
      if (!availableFloors.value.length) {
        showAlert('请先配置并保存楼层信息后再添加窗口')
        return
      }
      windows.value.push({
        name: '',
        number: '',
        floor: '',
        position: '',
        description: '',
        tags: [],
      })
    }

    // 删除窗口
    const removeWindow = async (index, windowId) => {
      const owner = editorSession.value
      const version = viewVersion
      const target = windows.value[index]
      if (windowId) {
        // 如果窗口已保存，需要调用删除接口
        const confirmed = await showConfirm('确定要删除这个窗口吗？', '确认删除')
        if (!confirmed || !isCurrentEditor(owner, version)) {
          return
        }
        try {
          const response = await canteenApi.deleteWindow(windowId)
          if (!ownsEditor(owner)) return
          if (response.code === 200) {
            const currentIndex = windows.value.indexOf(target)
            if (currentIndex !== -1) windows.value.splice(currentIndex, 1)
            if (isCurrentEditor(owner, version)) showAlert('删除成功！')
          } else {
            throw new Error(response.message || '删除失败')
          }
        } catch (error) {
          if (!isCurrentEditor(owner, version)) return
          console.error('删除窗口失败:', error)
          showAlert(error instanceof Error ? error.message : '删除窗口失败，请重试')
        }
      } else {
        // 如果窗口未保存，直接移除
        windows.value.splice(index, 1)
      }
    }

    // 可选楼层列表
    const availableFloors = computed(() => formData.floors
      .filter(floor => floor.level.trim() && floor.level !== 'default')
      .map(floor => ({
        key: floor.key,
        value: floor,
        label: floor.name ? `${floor.name}（${floor.level}层）` : `${floor.level}层`,
      })))

    const resolveWindowFloor = (floor) => {
      return formData.floors.includes(floor) ? { level: floor.level, name: floor.name } : null
    }

    const submitForm = async () => {
      const owner = editorSession.value
      const version = viewVersion
      if (!isCurrentEditor(owner, version) || owner.submitting || owner.loading || owner.loadError) return
      // 清除之前的错误
      errors.name = ''
      errors.floors = ''
      
      // 表单验证
      let hasError = false
      
      if (!formData.name || !formData.name.trim()) {
        errors.name = '请填写食堂名称'
        hasError = true
      }

      errors.floors = formData.floors.length
        ? formData.floors.map(floor => floorLevelError(floor.level, floor)).find(Boolean) || ''
        : '请填写楼层信息'
      if (errors.floors) hasError = true
      
      if (hasError) {
        return
      }
      
      for (const hours of formData.openingHours) {
        if (isUnresolvedFloor(hours.floor)) {
          showAlert(`营业时间的原楼层"${hours.floor.level}"无法确定，请重新选择楼层或删除该营业时间`)
          return
        }
      }

      if (owner.canteenId) {
        for (const window of windows.value) {
          if (!window.name || !window.name.trim()) {
            continue
          }
          if (!window.floor) {
            showAlert(`请先为窗口"${window.name}"选择楼层`)
            return
          }
          const floorInfo = resolveWindowFloor(window.floor)
          if (!floorInfo) {
            showAlert(`窗口"${window.name}"的楼层信息无效，请检查`)
            return
          }
        }
      }

      let openingHours
      try {
        openingHours = fromOpeningHoursForm(formData.openingHours.map(hours => ({
          ...hours, floor: typeof hours.floor === 'string' ? hours.floor : hours.floor.level,
        })))
      } catch (error) {
        showAlert(error.message)
        return
      }

      // Freeze the submitted resource and payloads before the first async boundary.
      const canteenId = owner.canteenId
      const imageFiles = formData.imageFiles.map(image => ({ ...image }))
      const floorChanges = formData.floors.map(draft => ({
        draft,
        payload: { ...(draft.id ? { id: draft.id } : {}), level: draft.level, name: draft.name },
      }))
      const windowChanges = windows.value.filter(window => window.name?.trim()).map(window => ({
        id: window.id,
        draft: window,
        payload: {
          name: window.name.trim(),
          number: window.number?.trim() || '',
          floor: resolveWindowFloor(window.floor),
          position: window.position || undefined,
          description: window.description || undefined,
          tags: window.tags?.length ? [...window.tags] : undefined,
        },
      }))
      const requestData = {
        name: formData.name.trim(),
        position: formData.position.trim() || undefined,
        description: formData.description.trim() || undefined,
        images: [],
        openingHours,
        floors: floorChanges.map(({ payload }) => payload),
        ...(canteenId ? {} : { windows: [] }),
      }
      owner.submitting = true

      try {
        // 1. 上传图片（如果有新图片）
        let imageUrls = []
        if (imageFiles.length > 0) {
          try {
            const { dishApi } = await import('@/api/modules/dish')
            if (!isCurrentEditor(owner, version)) return

            // 对每个图片项进行处理
            const processPromises = imageFiles.map(async (imgItem) => {
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
            if (!isCurrentEditor(owner, version)) return

            imageUrls = results
              .filter((result) => result.status === 'fulfilled')
              .map((result) => result.value)

            if (imageUrls.length !== imageFiles.length) {
              const failed = imageFiles.length - imageUrls.length
              const confirmed = await showConfirm(
                `${failed}张图片处理失败，是否继续保存？`,
                '图片处理失败'
              )
              if (!confirmed || !isCurrentEditor(owner, version)) {
                return
              }
            }
          } catch (error) {
            if (!isCurrentEditor(owner, version)) return
            console.error('图片上传失败:', error)
            showAlert('图片上传失败，请重试')
            return
          }
        }

        if (!isCurrentEditor(owner, version)) return
        requestData.images = imageUrls

        // 4. 创建或更新食堂
        const response = canteenId
          ? await canteenApi.updateCanteen(canteenId, requestData)
          : await canteenApi.createCanteen(requestData)
        if (!ownsSession()) return
        if (response.code !== 200 || !response.data) {
          throw new Error(response.message || (canteenId ? '更新食堂失败' : '创建食堂失败'))
        }
        if (ownsEditor(owner)) {
          if (!canteenId) owner.canteenId = response.data.id
          editingCanteen.value = { ...editingCanteen.value, ...response.data }
          applySavedFloors(response.data.floors, floorChanges)
        }
        const savedLevels = response.data.floors.map(floor => floor.level)
        if (new Set(savedLevels).size !== savedLevels.length) {
          throw new Error('食堂已保存，但返回了重复的楼层层级；请修正层级并重新选择窗口或营业时间的楼层后保存')
        }
        if (!canteenId) {
          if (isCurrentEditor(owner, version)) showAlert('食堂创建成功！现在您可以添加窗口信息。')
          await loadCanteens()
          return
        }

        // 5. 仅在编辑模式下单独保存窗口信息（新建时流程已中断）
        if (canteenId) {
          for (const { id, draft, payload } of windowChanges) {
            if (!ownsSession()) return
            try {
              if (id) {
                // 更新窗口
                await canteenApi.updateWindow(id, payload)
              } else {
                // 创建窗口
                const response = await canteenApi.createWindow({
                  ...payload,
                  canteenId: canteenId,
                })
                // Persist identity in the owning draft even while its view is hidden.
                if (response.code === 200 && response.data && ownsEditor(owner)) {
                  draft.id = response.data.id
                }
              }
            } catch (error) {
              console.error('保存窗口失败:', error)
              // 继续处理其他窗口，不中断流程
            }
          }
        }

        // 5. 重新加载列表并返回
        await loadCanteens()
        if (isCurrentEditor(owner, version)) {
          showAlert('食堂信息已更新！')
          backToList()
        }
      } catch (error) {
        if (!isCurrentEditor(owner, version)) return
        console.error('保存食堂失败:', error)
        showAlert(error instanceof Error ? error.message : '保存食堂失败，请重试')
      } finally {
        owner.submitting = false
      }
    }

    const deactivate = () => {
      active = false
      viewVersion += 1
      listRequest += 1
      isLoading.value = false
    }
    onDeactivated(deactivate)
    onBeforeUnmount(deactivate)
    watch(authSessionVersion, () => {
      deactivate()
      backToList()
      canteens.value = []
    }, { flush: 'sync' })

    onMounted(() => {
      loadCanteens()
    })

    onActivated(() => {
      active = true
      loadCanteens()
      if (editorSession.value?.loading && ownsSession()) loadWindows(editorSession.value)
    })

    return {
      viewMode,
      editingCanteen,
      canteens,
      searchQuery,
      filteredCanteens,
      formData,
      errors,
      windows,
      isSubmitting,
      isLoading,
      isWindowsLoading,
      windowsLoadError,
      availableFloors,
      loadCanteens,
      createNewCanteen,
      editCanteen,
      deleteCanteen,
      backToList,
      handleImageUpload,
      addOpeningHours,
      addMealSlot,
      removeOpeningHours,
      addFloor,
      removeFloor,
      changeFloorLevel,
      isUnresolvedFloor,
      addWindow,
      removeWindow,
      retryLoadWindows,
      submitForm,
      removeImage,
      setAsCover,
      authStore,
    }
  },
}
</script>
