<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'">
        <div class="flex justify-between items-center mb-6">
          <Header
            title="人员权限管理"
            description="管理子管理员账号和权限分配"
            header-icon="clarity:group-line"
          />
          <button
            class="px-6 py-2 text-white rounded-lg transition duration-200 flex items-center"
            :class="authStore.hasPermission('admin:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('admin:create') ? null : createNewAdmin()"
            :title="!authStore.hasPermission('admin:create') ? '无权限创建' : '创建子管理员'"
          >
            <span class="iconify mr-1" data-icon="carbon:add"></span>
            创建子管理员
          </button>
        </div>

        <!-- 搜索栏 -->
        <div class="mb-6">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索用户名、角色（权限组合）..."
            class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
          />
        </div>

        <!-- 管理员列表表格 -->
        <div class="overflow-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">用户名</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">角色（权限组合）</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">管理范围</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">创建时间</th>
                <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="admin in filteredAdmins" :key="admin.id" class="hover:bg-gray-50">
                <td class="py-4 px-6">
                  <div class="font-medium">{{ admin.username }}</div>
                </td>
                <td class="py-4 px-6">
                  <span
                    class="px-2 py-1 text-xs rounded-full bg-tsinghua-purple/10 text-tsinghua-purple"
                  >
                    {{ getRoleLabel(admin.role) }}
                  </span>
                </td>
                <td class="py-4 px-6 text-sm">{{ getCanteenName(admin.canteenId) }}</td>
                <td class="py-4 px-6 text-sm text-gray-500">{{ formatDate(admin.createdAt) }}</td>
                <td class="py-4 px-6 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-2">
                    <button
                      class="p-2 rounded-full hover:bg-gray-200"
                      :class="authStore.hasPermission('admin:edit') ? 'text-tsinghua-purple' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('admin:edit') ? null : editAdmin(admin)"
                      :title="!authStore.hasPermission('admin:edit') ? '无权限编辑' : '编辑权限'"
                    >
                      <span class="iconify" data-icon="carbon:edit"></span>
                    </button>
                    <button
                      class="p-2 rounded-full hover:bg-gray-200"
                      :class="authStore.hasPermission('admin:delete') ? 'text-red-500' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('admin:delete') ? null : deleteAdmin(admin)"
                      :title="!authStore.hasPermission('admin:delete') ? '无权限删除' : '删除'"
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
        <div v-if="filteredAdmins.length === 0 && !loading" class="text-center py-12">
          <span
            class="iconify text-6xl text-gray-300 mx-auto"
            data-icon="clarity:group-line"
          ></span>
          <p class="mt-4 text-gray-500">暂无子管理员</p>
          <button
            class="mt-4 px-6 py-2 text-white rounded-lg transition duration-200"
            :class="authStore.hasPermission('admin:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('admin:create') ? null : createNewAdmin()"
            :title="!authStore.hasPermission('admin:create') ? '无权限创建' : '创建第一个子管理员'"
          >
            创建第一个子管理员
          </button>
        </div>

        <!-- 分页 -->
        <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
          <button
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <button
            v-for="page in totalPages"
            :key="page"
            @click="changePage(page)"
            class="px-4 py-2 border rounded-lg transition"
            :class="
              currentPage === page
                ? 'bg-tsinghua-purple text-white border-tsinghua-purple'
                : 'border-gray-300 hover:bg-gray-50'
            "
          >
            {{ page }}
          </button>
          <button
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      </div>

      <!-- 创建/编辑视图 -->
      <div v-else>
        <div class="flex justify-between items-center mb-6">
          <Header
            :title="editingAdmin ? '编辑子管理员' : '创建子管理员'"
            :description="
              editingAdmin ? '修改子管理员信息和权限' : '创建新的子管理员账号并分配权限'
            "
            header-icon="clarity:group-line"
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
              <!-- 用户名 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">
                  用户名 <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  v-model="formData.username"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  placeholder="例如：admin001"
                  :disabled="!!editingAdmin"
                  required
                />
                <p v-if="editingAdmin" class="mt-1 text-sm text-gray-500">用户名创建后不可修改</p>
              </div>

              <!-- 密码 -->
              <div v-if="!editingAdmin" class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">
                  初始密码 <span class="text-red-500">*</span>
                </label>
                <div class="flex gap-2">
                  <input
                    v-model="formData.password"
                    type="text"
                    class="flex-1 px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    @click="generatePassword"
                    class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    随机生成
                  </button>
                </div>
                <div class="h-1 bg-gray-200 rounded mt-2 overflow-hidden">
                  <div
                    class="h-full transition-all"
                    :class="passwordStrengthClass"
                    :style="{ width: passwordStrengthWidth }"
                  ></div>
                </div>
                <div class="text-xs text-gray-500 mt-1">{{ passwordStrengthText }}</div>
              </div>

              <!-- 角色 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">
                  角色（权限组合）
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="role in roles"
                    :key="role.value"
                    @click="selectRole(role.value)"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="
                      formData.role === role.value
                        ? 'border-tsinghua-purple bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    "
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        :value="role.value"
                        v-model="formData.role"
                        class="text-tsinghua-purple"
                      />
                      <div>
                        <div class="font-medium text-sm">{{ role.label }}</div>
                        <div class="text-xs text-gray-500">{{ role.desc }}</div>
                      </div>
                    </div>
                  </div>
                  <!-- 自定义角色选项 -->
                  <div
                    @click="selectRole('custom')"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="
                      formData.role === 'custom'
                        ? 'border-tsinghua-purple bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    "
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        value="custom"
                        v-model="formData.role"
                        class="text-tsinghua-purple"
                      />
                      <div>
                        <div class="font-medium text-sm">自定义角色</div>
                        <div class="text-xs text-gray-500">输入自定义角色名称</div>
                      </div>
                    </div>
                  </div>
                  <!-- 不选择角色选项 -->
                  <div
                    @click="selectRole('')"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="
                      !formData.role
                        ? 'border-tsinghua-purple bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    "
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        :value="''"
                        v-model="formData.role"
                        class="text-tsinghua-purple"
                      />
                      <div>
                        <div class="font-medium text-sm">不选择角色</div>
                        <div class="text-xs text-gray-500">仅手动选择权限，不设置角色</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 自定义角色输入框 -->
                <div v-if="formData.role === 'custom'" class="mt-3">
                  <label class="block text-sm text-gray-600 mb-1">
                    自定义角色名称
                  </label>
                  <input
                    type="text"
                    v-model="formData.customRole"
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                    placeholder="请输入自定义角色名称，例如：数据分析师、运营专员等"
                    maxlength="50"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    自定义角色不会自动分配权限，请手动选择所需权限
                  </p>
                </div>
              </div>

              <!-- 管理范围 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">管理范围（食堂）</label>
                <select
                  v-model="formData.canteenId"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple bg-white"
                >
                  <option value="">全校食堂 (所有权限)</option>
                  <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
                <p class="mt-1 text-sm text-gray-500">
                  选择管理的食堂，留空则代表管理所有食堂。
                  <span class="text-xs text-gray-400">目前仅支持单选，如需多选请联系系统管理员。</span>
                </p>
              </div>
            </div>

            <!-- 右侧列 -->
            <div>
              <!-- 权限配置 -->
              <div class="mb-6">
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-gray-700 font-medium">权限配置</label>
                  <button
                    type="button"
                    class="text-sm flex items-center transition-colors"
                    :class="isAllPermissionsSelected ? 'text-red-500 hover:text-red-700' : 'text-tsinghua-purple hover:text-tsinghua-dark'"
                    @click="toggleAllPermissions"
                  >
                    <span class="iconify mr-1" :data-icon="isAllPermissionsSelected ? 'carbon:checkbox-checked-filled' : 'carbon:checkbox'"></span>
                    {{ isAllPermissionsSelected ? '取消全选' : '全部全选' }}
                  </button>
                </div>

                <div class="space-y-4 max-h-[500px] overflow-y-auto border rounded-lg p-4">
                  <div
                    v-for="permissionGroup in permissionGroups"
                    :key="permissionGroup.id"
                    class="mb-4"
                  >
                    <div class="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded">
                      <div class="flex items-center gap-2">
                        <div class="w-1 h-5 bg-tsinghua-purple rounded-full"></div>
                        <h4 class="text-sm font-medium text-gray-800">{{ permissionGroup.name }}</h4>
                      </div>
                      <button
                        type="button"
                        class="text-xs px-2 py-1 rounded transition-colors flex items-center gap-1"
                        :class="isGroupSelected(permissionGroup) ? 'text-red-500 hover:bg-red-50' : 'text-tsinghua-purple hover:bg-purple-50'"
                        @click="toggleGroupPermissions(permissionGroup)"
                        :title="isGroupSelected(permissionGroup) ? '取消全选该组' : '全选该组'"
                      >
                        <span class="iconify" :data-icon="isGroupSelected(permissionGroup) ? 'carbon:checkbox-checked-filled' : 'carbon:checkbox'"></span>
                        {{ isGroupSelected(permissionGroup) ? '取消全选' : '全选' }}
                      </button>
                    </div>

                    <div class="grid grid-cols-1 gap-2 ml-3">
                      <div
                        v-for="permission in permissionGroup.permissions"
                        :key="permission.id"
                        class="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          :id="permission.id"
                          :checked="isPermissionChecked(permission.id)"
                          @change="togglePermission(permission.id)"
                          class="w-4 h-4 text-tsinghua-purple border-gray-300 rounded focus:ring-tsinghua-purple"
                        />
                        <label :for="permission.id" class="text-sm text-gray-700 cursor-pointer">
                          {{ permission.label }}
                        </label>
                      </div>
                    </div>
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
              :disabled="isSubmitting"
            >
              <span class="iconify mr-1" data-icon="carbon:save"></span>
              {{ isSubmitting ? '提交中...' : editingAdmin ? '保存修改' : '创建子管理员' }}
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
import { permissionApi } from '@/api/modules/permission'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'UserManage',
  components: {
    Header,
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const isSubmitting = ref(false)
    const loading = ref(false)
    const viewMode = ref('list') // 'list' 或 'edit'
    const editingAdmin = ref(null) // 当前编辑的管理员
    const adminList = ref([]) // 子管理员列表
    const canteenList = ref([]) // 食堂列表
    const searchQuery = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const totalPages = ref(1)

    const formData = reactive({
      username: '',
      password: '',
      role: '',
      customRole: '',
      canteenId: '',
      permissions: [],
    })

    const roles = [
      { value: 'super_admin', label: '超级管理员', desc: '系统所有权限' },
      { value: 'canteen_manager', label: '食堂主管', desc: '管理多个食堂' },
      { value: 'restaurant_manager', label: '餐厅经理', desc: '单个食堂管理' },
      { value: 'kitchen_operator', label: '后厨操作员', desc: '菜品与库存管理' },
      { value: 'news_editor', label: '新闻编辑', desc: '发布和管理新闻' },
      { value: 'auditor', label: '内容审核员', desc: '审核评论和评价' },
    ]

    const permissionGroups = [
      {
        id: 'dishes',
        name: '菜品管理',
        permissions: [
          { id: 'dish:view', label: '浏览菜品列表' },
          { id: 'dish:create', label: '新建菜品' },
          { id: 'dish:edit', label: '编辑菜品' },
          { id: 'dish:delete', label: '删除菜品' },
        ],
      },
      {
        id: 'canteen',
        name: '食堂与窗口管理',
        permissions: [
          { id: 'canteen:view', label: '浏览食堂/窗口' },
          { id: 'canteen:create', label: '创建食堂/窗口' },
          { id: 'canteen:edit', label: '编辑食堂/窗口' },
          { id: 'canteen:delete', label: '删除食堂/窗口' },
        ],
      },
      {
        id: 'review',
        name: '内容审核',
        permissions: [
          { id: 'review:approve', label: '审核评价' },
          { id: 'review:delete', label: '删除评价' },
          { id: 'comment:approve', label: '审核评论' },
          { id: 'report:handle', label: '处理举报' },
          { id: 'upload:approve', label: '审核菜品上传' },
        ],
      },
      {
        id: 'news',
        name: '新闻管理',
        permissions: [
          { id: 'news:view', label: '浏览新闻' },
          { id: 'news:create', label: '创建新闻' },
          { id: 'news:edit', label: '编辑新闻' },
          { id: 'news:publish', label: '发布新闻' },
          { id: 'news:revoke', label: '撤销新闻' },
          { id: 'news:delete', label: '删除新闻' },
        ],
      },
      {
        id: 'admin',
        name: '子管理员管理',
        permissions: [
          { id: 'admin:view', label: '浏览子管理员' },
          { id: 'admin:create', label: '创建子管理员' },
          { id: 'admin:edit', label: '编辑子管理员' },
          { id: 'admin:delete', label: '删除子管理员' },
        ],
      },
    ]

    // 权限依赖关系配置
    const permissionDependencies = {
      'dish:create': ['canteen:view'],
      'dish:edit': ['dish:view', 'canteen:view'],
      'dish:delete': ['dish:view'],
      'canteen:create': ['canteen:view'],
      'canteen:edit': ['canteen:view'],
      'canteen:delete': ['canteen:view'],
      'review:approve': ['dish:view', 'canteen:view'], // 审核评价可能需要查看菜品和食堂
      'upload:approve': ['dish:view', 'canteen:view'], // 审核上传需要查看菜品
      'news:create': ['news:view'],
      'news:edit': ['news:view'],
      'news:publish': ['news:view'],
      'news:revoke': ['news:view'],
      'news:delete': ['news:view'],
      'admin:create': ['admin:view', 'canteen:view'], // 创建管理员可能需要分配食堂
      'admin:edit': ['admin:view'],
      'admin:delete': ['admin:view'],
    }

    // 过滤后的管理员列表
    const filteredAdmins = computed(() => {
      if (!searchQuery.value) {
        return adminList.value
      }
      const query = searchQuery.value.toLowerCase()
      return adminList.value.filter(
        (admin) =>
          admin.username.toLowerCase().includes(query) ||
          (admin.role && admin.role.toLowerCase().includes(query)),
      )
    })

    // 密码强度计算
    const passwordStrength = computed(() => {
      const password = formData.password
      if (!password) return 0
      let strength = 0
      if (password.length >= 8) strength++
      if (/[a-z]/.test(password)) strength++
      if (/[A-Z]/.test(password)) strength++
      if (/[0-9]/.test(password)) strength++
      if (/[^a-zA-Z0-9]/.test(password)) strength++
      return strength
    })

    const passwordStrengthClass = computed(() => {
      if (passwordStrength.value <= 2) return 'bg-red-500'
      if (passwordStrength.value <= 4) return 'bg-orange-500'
      return 'bg-green-500'
    })

    const passwordStrengthWidth = computed(() => {
      return (passwordStrength.value / 5) * 100 + '%'
    })

    const passwordStrengthText = computed(() => {
      if (passwordStrength.value <= 2) return '密码强度：弱'
      if (passwordStrength.value <= 4) return '密码强度：中'
      return '密码强度：强'
    })

    // 获取角色标签
    const getRoleLabel = (role) => {
      if (!role) return '未设置'
      const roleObj = roles.find((r) => r.value === role)
      return roleObj ? roleObj.label : role
    }

    // 加载食堂列表
    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteenList.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      }
    }

    // 获取食堂名称
    const getCanteenName = (canteenId) => {
      if (!canteenId) return '全校食堂'
      const canteen = canteenList.value.find((c) => c.id === canteenId)
      return canteen ? canteen.name : canteenId
    }

    // 加载子管理员列表
    const loadAdmins = async () => {
      loading.value = true
      try {
        const response = await permissionApi.getAdmins({
          page: currentPage.value,
          pageSize: pageSize.value,
        })

        if (response.code === 200 && response.data) {
          adminList.value = response.data.items || []
          totalPages.value = response.data.meta?.totalPages || 1
        } else {
          throw new Error(response.message || '获取管理员列表失败')
        }
      } catch (error) {
        console.error('加载子管理员列表失败:', error)
        alert('加载子管理员列表失败，请刷新重试')
        adminList.value = []
      } finally {
        loading.value = false
      }
    }

    // 创建新管理员
    const createNewAdmin = () => {
      editingAdmin.value = null
      resetForm()
      viewMode.value = 'edit'
    }

    // 编辑管理员
    const editAdmin = async (admin) => {
      editingAdmin.value = admin
      // 填充表单数据
      formData.username = admin.username || ''
      
      // 判断是否为预设角色
      if (admin.role) {
        const presetRoleValues = roles.map(r => r.value)
        const isPresetRole = presetRoleValues.includes(admin.role)
        
        if (isPresetRole) {
          formData.role = admin.role
          formData.customRole = ''
        } else {
          // 如果不是预设角色，则视为自定义角色
          formData.role = 'custom'
          formData.customRole = admin.role
        }
      } else {
        // 如果没有角色，保持为空
        formData.role = ''
        formData.customRole = ''
      }
      
      formData.canteenId = admin.canteenId || ''

      // 加载权限信息
      // 如果admin对象中没有permissions字段，可能需要单独请求或从admin列表项中获取
      // 假设admin对象包含了permissions数组
      if (admin.permissions && Array.isArray(admin.permissions)) {
         formData.permissions = admin.permissions.map(p => typeof p === 'string' ? p : p.permission)
      } else {
         formData.permissions = []
      }

      viewMode.value = 'edit'
    }

    // 删除管理员
    const deleteAdmin = async (admin) => {
      if (!confirm(`确定要删除子管理员"${admin.username}"吗？此操作不可恢复！`)) {
        return
      }

      try {
        const response = await permissionApi.deleteAdmin(admin.id)
        if (response.code === 200) {
          alert('删除成功！')
          loadAdmins()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除子管理员失败:', error)
        alert(error instanceof Error ? error.message : '删除子管理员失败，请重试')
      }
    }

    // 返回列表
    const backToList = () => {
      viewMode.value = 'list'
      editingAdmin.value = null
      resetForm()
    }

    // 重置表单
    const resetForm = () => {
      formData.username = ''
      formData.password = 'Tsinghua@2025'
      formData.role = ''
      formData.customRole = ''
      formData.canteenId = ''
      formData.permissions = []
    }

    // 生成随机密码
    const generatePassword = () => {
      const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      formData.password = password
    }

    // 选择角色
    const selectRole = (role) => {
      // 如果点击已选中的角色，则取消选择
      if (formData.role === role) {
        formData.role = ''
        formData.customRole = ''
        return
      }
      
      formData.role = role
      if (role === 'custom') {
        // 自定义角色不清空权限，让用户手动选择
        formData.customRole = ''
      } else if (role) {
        // 根据角色设置默认权限
        formData.permissions = getDefaultPermissionsByRole(role)
        formData.customRole = ''
      } else {
        // 不选择角色，不清空权限，让用户手动选择
        formData.customRole = ''
      }
    }

    // 根据角色获取默认权限
    const getDefaultPermissionsByRole = (role) => {
      const permissionMap = {
        super_admin: permissionGroups.flatMap((g) => g.permissions.map((p) => p.id)),
        canteen_manager: [
          'dish:view',
          'dish:create',
          'dish:edit',
          'dish:delete',
          'canteen:view',
          'upload:approve',
          'news:view',
          'news:create',
          'review:approve',
          'comment:approve',
        ],
        restaurant_manager: [
          'dish:view',
          'dish:create',
          'dish:edit',
          'canteen:view',
          'upload:approve',
        ],
        kitchen_operator: ['dish:view', 'dish:create', 'dish:edit', 'canteen:view'],
        news_editor: [
          'news:view',
          'news:create',
          'news:edit',
          'news:publish',
          'news:revoke',
          'news:delete',
          'canteen:view', // 新闻可能关联食堂
        ],
        auditor: [
          'review:approve',
          'review:delete',
          'comment:approve',
          'report:handle',
          'upload:approve',
          'dish:view', // 审核需要查看菜品
          'canteen:view', // 审核需要查看食堂
        ],
      }
      return permissionMap[role] || []
    }

    // 切换权限
    const togglePermission = (permissionId) => {
      const index = formData.permissions.indexOf(permissionId)
      if (index > -1) {
        // 取消选中
        formData.permissions.splice(index, 1)
      } else {
        // 选中
        formData.permissions.push(permissionId)
        
        // 处理依赖：自动选中所需的权限
        const dependencies = permissionDependencies[permissionId]
        if (dependencies) {
          dependencies.forEach(dep => {
            if (!formData.permissions.includes(dep)) {
              formData.permissions.push(dep)
            }
          })
        }
      }
    }

    // 检查权限是否选中
    const isPermissionChecked = (permissionId) => {
      return formData.permissions.includes(permissionId)
    }

    // 检查是否全选了某组权限
    const isGroupSelected = (group) => {
      return group.permissions.every(p => formData.permissions.includes(p.id))
    }

    // 检查是否全选了所有权限
    const isAllPermissionsSelected = computed(() => {
      const allPermissions = permissionGroups.flatMap((g) => g.permissions.map((p) => p.id))
      return allPermissions.every(p => formData.permissions.includes(p)) && allPermissions.length > 0
    })

    // 切换某组权限全选/取消
    const toggleGroupPermissions = (group) => {
      const allGroupPermissions = group.permissions.map(p => p.id)
      const isSelected = isGroupSelected(group)

      if (isSelected) {
        // 取消全选：移除该组所有权限
        formData.permissions = formData.permissions.filter(p => !allGroupPermissions.includes(p))
      } else {
        // 全选：添加该组未选中的权限
        allGroupPermissions.forEach(p => {
          if (!formData.permissions.includes(p)) {
            formData.permissions.push(p)
          }
        })
      }
    }

    // 切换所有权限全选/取消
    const toggleAllPermissions = () => {
      const allPermissions = permissionGroups.flatMap((g) => g.permissions.map((p) => p.id))
      
      if (isAllPermissionsSelected.value) {
        // 取消全选：清空所有权限
        formData.permissions = []
      } else {
        // 全选：添加所有权限
        formData.permissions = [...allPermissions]
      }
    }

    // 提交表单
    const submitForm = async () => {
      // 表单验证
      if (!formData.username || !formData.username.trim()) {
        alert('请填写用户名')
        return
      }

      if (!editingAdmin.value && (!formData.password || !formData.password.trim())) {
        alert('请填写初始密码')
        return
      }

      // 验证自定义角色（如果选择了自定义角色，则验证名称长度）
      if (formData.role === 'custom' && formData.customRole && formData.customRole.trim()) {
        if (formData.customRole.trim().length > 50) {
          alert('自定义角色名称不能超过50个字符')
          return
        }
      }

      if (isSubmitting.value) {
        return
      }

      isSubmitting.value = true

      try {
        if (editingAdmin.value) {
          // 更新管理员权限
          const response = await permissionApi.updateAdminPermissions(
            editingAdmin.value.id,
            formData.permissions,
          )

          if (response.code === 200) {
            alert('权限配置已更新！')
            await loadAdmins()
            backToList()
          } else {
            throw new Error(response.message || '更新权限失败')
          }
        } else {
          // 创建新管理员
          // 注意：后端暂时不支持 role 字段，所以不发送该字段
          // 当后端支持时，可以添加 role 字段
          const createData = {
            username: formData.username.trim(),
            password: formData.password.trim(),
            canteenId: formData.canteenId.trim() || undefined,
            permissions: formData.permissions,
            // role 字段暂时不发送，等待后端支持后再添加
            // const finalRole = formData.role === 'custom' ? formData.customRole.trim() : formData.role
            // role: finalRole,
          }

          const response = await permissionApi.createAdmin(createData)

          if (response.code === 200 && response.data) {
            alert('子管理员创建成功！')
            await loadAdmins()
            backToList()
          } else {
            throw new Error(response.message || '创建子管理员失败')
          }
        }
      } catch (error) {
        console.error('保存失败:', error)
        alert(error instanceof Error ? error.message : '保存失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    // 切换页码
    const changePage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        loadAdmins()
      }
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    }

    onMounted(() => {
      loadCanteens()
      loadAdmins()
    })

    return {
      viewMode,
      editingAdmin,
      adminList,
      searchQuery,
      filteredAdmins,
      formData,
      roles,
      permissionGroups,
      isSubmitting,
      loading,
      currentPage,
      totalPages,
      passwordStrengthClass,
      passwordStrengthWidth,
      passwordStrengthText,
      loadAdmins,
      createNewAdmin,
      editAdmin,
      deleteAdmin,
      backToList,
      generatePassword,
      selectRole,
      togglePermission,
      isPermissionChecked,
      toggleAllPermissions,
      isGroupSelected,
      toggleGroupPermissions,
      isAllPermissionsSelected,
      submitForm,
      changePage,
      formatDate,
      getRoleLabel,
      getCanteenName,
      canteenList,
      authStore,
    }
  },
}
</script>
