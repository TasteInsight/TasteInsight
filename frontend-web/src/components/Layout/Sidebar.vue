<template>
  <div
    class="fixed left-0 top-0 w-[260px] h-screen bg-tsinghua-purple text-white flex flex-col py-6 z-[9999] pointer-events-auto"
  >
    <div class="px-6 mb-8">
      <div class="flex items-center space-x-3">
        <span class="iconify text-2xl" data-icon="noto-v1:pot-of-food"></span>
        <h1 class="text-xl font-bold">食鉴管理平台</h1>
      </div>
      <div class="text-sm opacity-75 mt-2 tracking-wide">清华大学餐饮管理中心</div>
      <div v-if="userInfo.canteenName || !userInfo.canteenId" class="text-xs opacity-70 mt-1">
        <span v-if="userInfo.canteenName">管理食堂：{{ userInfo.canteenName }}</span>
        <span v-else>管理食堂：全校食堂</span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0 sidebar-menu-scroll">
      <div v-permission="'dish:view'">
        <button
          class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
          :class="{ active: activeMenu === 'add' }"
          @click="toggleAddMenu"
        >
          <span class="iconify" data-icon="carbon:add"></span>
          <span>菜品添加</span>
        </button>
        <div v-if="showAddSubmenu" class="ml-6 border-l border-white/20 pl-3">
          <router-link
            to="/single-add"
            class="sidebar-btn w-full py-2 px-3 text-left flex items-center space-x-2 text-base font-normal"
            :class="{ active: $route.path === '/single-add' }"
          >
            <span class="iconify" data-icon="carbon:document"></span>
            <span>单项添加</span>
          </router-link>
          <router-link
            to="/batch-add"
            class="sidebar-btn w-full py-2 px-3 text-left flex items-center space-x-2 text-base font-normal"
            :class="{ active: $route.path === '/batch-add' }"
          >
            <span class="iconify" data-icon="carbon:document-multiple-02"></span>
            <span>批量添加</span>
          </router-link>
        </div>
      </div>
      <router-link
        v-permission="'dish:view'"
        to="/modify-dish"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/modify-dish' }"
      >
        <span class="iconify" data-icon="clarity:note-edit-line"></span>
        <span>菜品修改</span>
      </router-link>
      <router-link
        v-permission="'upload:approve'"
        to="/review-dish"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/review-dish' }"
      >
        <span class="iconify" data-icon="carbon:task-approved"></span>
        <span>菜品审核</span>
      </router-link>
      <router-link
        v-permission="'canteen:view'"
        to="/add-canteen"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/add-canteen' }"
      >
        <span class="iconify" data-icon="carbon:restaurant"></span>
        <span>食堂信息管理</span>
      </router-link>
      <router-link
        v-permission="'admin:view'"
        to="/user-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/user-manage' }"
      >
        <span class="iconify" data-icon="clarity:group-line"></span>
        <span>人员权限管理</span>
      </router-link>
      <router-link
        v-permission="'news:view'"
        to="/news-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/news-manage' }"
      >
        <span class="iconify" data-icon="carbon:license-draft"></span>
        <span>新闻管理</span>
      </router-link>
      <router-link
        v-if="false"
        v-permission="'admin:view'"
        to="/log-view"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/log-view' }"
      >
        <span class="iconify" data-icon="carbon:document-view"></span>
        <span>操作日志</span>
      </router-link>
      <router-link
        v-permission="'report:handle'"
        to="/report-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/report-manage' }"
      >
        <span class="iconify" data-icon="carbon:warning"></span>
        <span>举报管理</span>
      </router-link>
      <router-link
        v-permission="'review:approve'"
        to="/review-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/review-manage' }"
      >
        <span class="iconify" data-icon="carbon:task-approved"></span>
        <span>评价和评论审核</span>
      </router-link>
      <router-link
        v-permission="'review:delete'"
        to="/comment-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/comment-manage' }"
      >
        <span class="iconify" data-icon="carbon:chat"></span>
        <span>评论和评价管理</span>
      </router-link>
      <router-link
        v-permission="'config:view'"
        to="/config-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/config-manage' }"
      >
        <span class="iconify" data-icon="carbon:settings"></span>
        <span>系统配置</span>
      </router-link>
      <router-link
        v-permission="'experiment:view'"
        to="/experiment-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ active: $route.path === '/experiment-manage' || $route.path.startsWith('/experiment-manage/') }"
      >
        <span class="iconify" data-icon="carbon:chemistry"></span>
        <span>推荐配置</span>
      </router-link>
    </div>

    <div ref="userInfoSection" class="px-6 py-4 text-sm mt-auto mb-1 border-t border-white/20 relative">
      <!-- 第一行：图标、管理员名称、右侧按钮 -->
      <div class="flex items-center justify-between mb-1">
        <div
          class="flex items-center space-x-2 opacity-80 cursor-pointer hover:opacity-100 transition flex-1 min-w-0"
          @click="togglePermissionsDropdown"
        >
          <span class="iconify flex-shrink-0" data-icon="mdi:user-circle-outline"></span>
          <span class="truncate">管理员：{{ userInfo.username || userInfo.name || '管理员' }}</span>
          <span
            class="iconify text-xs transition-transform flex-shrink-0"
            :class="{ 'rotate-180': showPermissionsDropdown }"
            data-icon="carbon:chevron-down"
          ></span>
        </div>
        <button
          class="opacity-70 hover:opacity-100 transition flex-shrink-0 ml-2"
          @click="handleLogout"
          title="退出登录"
        >
          <span class="iconify" data-icon="carbon:logout"></span>
        </button>
      </div>
      <!-- 第二行：食堂信息 -->
      <div v-if="userInfo.canteenName || !userInfo.canteenId" class="pl-7 text-xs opacity-70">
        <span v-if="userInfo.canteenName">{{ userInfo.canteenName }}</span>
        <span v-else>全校食堂</span>
      </div>

      <!-- 权限下拉框 -->
      <div
        v-if="showPermissionsDropdown"
        ref="permissionsDropdown"
        class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[300px] overflow-y-auto z-50"
        @click.stop
      >
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <h4 class="text-sm font-medium text-gray-800">我的权限</h4>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="showPermissionsDropdown = false"
            >
              <span class="iconify text-sm" data-icon="carbon:close"></span>
            </button>
          </div>

          <div v-if="permissionGroups.length > 0" class="space-y-3">
            <div
              v-for="group in permissionGroups"
              :key="group.id"
              class="border-b border-gray-100 last:border-0 pb-3 last:pb-0"
            >
              <div class="flex items-center gap-2 mb-2">
                <div class="w-1 h-4 bg-tsinghua-purple"></div>
                <h5 class="text-xs font-medium text-gray-700">{{ group.name }}</h5>
              </div>
              <div class="ml-3 space-y-1">
                <div
                  v-for="permission in group.permissions"
                  :key="permission.id"
                  class="flex items-center gap-2 text-xs"
                >
                  <span
                    class="iconify text-xs"
                    :class="hasPermission(permission.id) ? 'text-green-500' : 'text-gray-300'"
                    :data-icon="
                      hasPermission(permission.id) ? 'carbon:checkmark-filled' : 'carbon:close'
                    "
                  ></span>
                  <span
                    :class="
                      hasPermission(permission.id) ? 'text-gray-800' : 'text-gray-400 line-through'
                    "
                  >
                    {{ permission.label }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-xs text-gray-500 text-center py-4">
            <p>暂无权限信息</p>
          </div>

          <!-- 修改密码按钮 - 放在权限列表最下方 -->
          <button
            class="w-full mt-4 px-3 py-2 text-sm bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition flex items-center justify-center gap-2"
            @click="openChangePasswordModal"
          >
            <span class="iconify" data-icon="carbon:password"></span>
            修改我的密码
          </button>
        </div>
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <div v-if="showChangePasswordModal" class="fixed inset-0 z-[10000] flex items-center justify-center text-gray-900" @click.stop>
      <div class="absolute inset-0 bg-black/50" @click="closeChangePasswordModal"></div>
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4" @click.stop>
        <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span class="iconify text-tsinghua-purple" data-icon="carbon:password"></span>
          修改我的密码
        </h3>
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label class="block text-gray-700 font-medium mb-2">
              当前密码 <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                :type="showCurrentPassword ? 'text' : 'password'"
                :value="passwordForm.currentPassword"
                @input="handlePasswordInput('currentPassword', $event)"
                class="password-input w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-tsinghua-purple focus:border-tsinghua-purple focus:outline-none"
                :class="{ 'border-red-400 bg-red-50': passwordError }"
                placeholder="请输入当前密码"
                autocomplete="current-password"
              />
              <button
                type="button"
                @click="showCurrentPassword = !showCurrentPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span
                  class="iconify text-lg"
                  :data-icon="showCurrentPassword ? 'carbon:view-off' : 'carbon:view'"
                ></span>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-gray-700 font-medium mb-2">
              新密码 <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                :type="showNewPassword ? 'text' : 'password'"
                :value="passwordForm.newPassword"
                @input="handlePasswordInput('newPassword', $event)"
                class="password-input w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-tsinghua-purple focus:border-tsinghua-purple focus:outline-none"
                :class="{ 'border-red-400 bg-red-50': passwordError }"
                placeholder="请输入新密码"
                autocomplete="new-password"
              />
              <button
                type="button"
                @click="showNewPassword = !showNewPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span
                  class="iconify text-lg"
                  :data-icon="showNewPassword ? 'carbon:view-off' : 'carbon:view'"
                ></span>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-gray-700 font-medium mb-2">
              确认新密码 <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                :type="showConfirmPassword ? 'text' : 'password'"
                :value="passwordForm.confirmPassword"
                @input="handlePasswordInput('confirmPassword', $event)"
                class="password-input w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-tsinghua-purple focus:border-tsinghua-purple focus:outline-none"
                :class="{ 'border-red-400 bg-red-50': passwordError }"
                placeholder="请再次输入新密码"
                autocomplete="new-password"
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span
                  class="iconify text-lg"
                  :data-icon="showConfirmPassword ? 'carbon:view-off' : 'carbon:view'"
                ></span>
              </button>
            </div>
          </div>
          <!-- 密码要求提示 - 动态显示 -->
          <div class="text-xs bg-gray-50 rounded-lg p-3">
            <p class="font-medium text-gray-600 mb-2">密码要求：</p>
            <ul class="space-y-1">
              <li class="flex items-center gap-2" :class="passwordChecks.length ? 'text-green-600' : 'text-gray-400'">
                <span class="iconify text-sm" :data-icon="passwordChecks.length ? 'carbon:checkmark-filled' : 'carbon:close'"></span>
                至少 8 个字符
              </li>
              <li class="flex items-center gap-2" :class="passwordChecks.uppercase ? 'text-green-600' : 'text-gray-400'">
                <span class="iconify text-sm" :data-icon="passwordChecks.uppercase ? 'carbon:checkmark-filled' : 'carbon:close'"></span>
                包含大写字母（A-Z）
              </li>
              <li class="flex items-center gap-2" :class="passwordChecks.lowercase ? 'text-green-600' : 'text-gray-400'">
                <span class="iconify text-sm" :data-icon="passwordChecks.lowercase ? 'carbon:checkmark-filled' : 'carbon:close'"></span>
                包含小写字母（a-z）
              </li>
              <li class="flex items-center gap-2" :class="passwordChecks.number ? 'text-green-600' : 'text-gray-400'">
                <span class="iconify text-sm" :data-icon="passwordChecks.number ? 'carbon:checkmark-filled' : 'carbon:close'"></span>
                包含数字（0-9）
              </li>
              <li class="flex items-center gap-2" :class="passwordChecks.special ? 'text-green-600' : 'text-gray-400'">
                <span class="iconify text-sm" :data-icon="passwordChecks.special ? 'carbon:checkmark-filled' : 'carbon:close'"></span>
                包含特殊符号（如 !@#$%^&amp;*）
              </li>
            </ul>
          </div>
          <p v-if="passwordError" class="text-sm text-red-500 flex items-center gap-1">
            <span class="iconify" data-icon="carbon:warning"></span>
            {{ passwordError }}
          </p>
          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="closeChangePasswordModal"
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="isChangingPassword"
              class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isChangingPassword ? '修改中...' : '确认修改' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { permissionApi } from '@/api/modules/permission'
import { showConfirm, showAlert } from '@/composables/useModal'

export default {
  name: 'Sidebar',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    const showAddSubmenu = ref(false)
    const activeMenu = ref('')
    const showPermissionsDropdown = ref(false)
    const userInfoSection = ref(null)
    const permissionsDropdown = ref(null)

    const userInfo = computed(() => authStore.user || { username: '管理员' })
    const userPermissions = computed(() => authStore.permissions || [])

    // 密码修改相关状态
    const showChangePasswordModal = ref(false)
    const isChangingPassword = ref(false)
    const passwordError = ref('')
    const showCurrentPassword = ref(false)
    const showNewPassword = ref(false)
    const showConfirmPassword = ref(false)
    const passwordForm = reactive({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })

    // 密码强度动态检查
    const passwordChecks = computed(() => ({
      length: passwordForm.newPassword.length >= 8,
      uppercase: /[A-Z]/.test(passwordForm.newPassword),
      lowercase: /[a-z]/.test(passwordForm.newPassword),
      number: /\d/.test(passwordForm.newPassword),
      special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(passwordForm.newPassword),
    }))

    // 权限分组定义（与 UserManage 保持一致）
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
          { id: 'comment:delete', label: '删除评论' },
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
      {
        id: 'config',
        name: '配置管理',
        permissions: [
          { id: 'config:view', label: '查看配置' },
          { id: 'config:edit', label: '编辑配置' },
        ],
      },
      {
        id: 'experiment',
        name: '推荐管理',
        permissions: [
          { id: 'experiment:view', label: '浏览实验' },
          { id: 'experiment:create', label: '创建实验' },
          { id: 'experiment:edit', label: '编辑实验' },
          { id: 'experiment:delete', label: '删除实验' },
        ],
      },
    ]

    // 检查是否拥有某个权限
    const hasPermission = (permissionId) => {
      return authStore.hasPermission(permissionId)
    }

    // 切换权限下拉框
    const togglePermissionsDropdown = () => {
      showPermissionsDropdown.value = !showPermissionsDropdown.value
    }

    // 点击外部关闭下拉框
    const handleClickOutside = (event) => {
      if (
        showPermissionsDropdown.value &&
        userInfoSection.value &&
        permissionsDropdown.value &&
        !userInfoSection.value.contains(event.target) &&
        !permissionsDropdown.value.contains(event.target)
      ) {
        showPermissionsDropdown.value = false
      }
    }

    const toggleAddMenu = () => {
      showAddSubmenu.value = !showAddSubmenu.value
      activeMenu.value = showAddSubmenu.value ? 'add' : ''
    }

    const handleLogout = async () => {
      const confirmed = await showConfirm('确定要退出登录吗？', '退出登录', '确定', '取消')
      if (confirmed) {
        authStore.logout()
        router.replace('/login')
      }
    }

    // ======== 密码修改相关方法 ========
    const openChangePasswordModal = () => {
      passwordForm.currentPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
      passwordError.value = ''
      showCurrentPassword.value = false
      showNewPassword.value = false
      showConfirmPassword.value = false
      showChangePasswordModal.value = true
      showPermissionsDropdown.value = false // 关闭权限下拉框
    }

    const closeChangePasswordModal = () => {
      showChangePasswordModal.value = false
      passwordError.value = ''
      passwordForm.currentPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
      showCurrentPassword.value = false
      showNewPassword.value = false
      showConfirmPassword.value = false
    }

    // 处理密码输入，同时清除错误状态
    const handlePasswordInput = (field, event) => {
      passwordForm[field] = event.target.value
      // 清除错误状态
      if (passwordError.value) {
        passwordError.value = ''
      }
    }

    const validatePassword = (password) => {
      if (password.length < 8) {
        return '密码长度至少为8位'
      }
      if (!/[a-z]/.test(password)) {
        return '密码必须包含小写字母'
      }
      if (!/[A-Z]/.test(password)) {
        return '密码必须包含大写字母'
      }
      if (!/\d/.test(password)) {
        return '密码必须包含数字'
      }
      if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
        return '密码必须包含特殊符号'
      }
      return null
    }

    const handleChangePassword = async () => {
      passwordError.value = ''
      
      if (!passwordForm.currentPassword) {
        passwordError.value = '请输入当前密码'
        return
      }
      if (!passwordForm.newPassword) {
        passwordError.value = '请输入新密码'
        return
      }
      
      const validationError = validatePassword(passwordForm.newPassword)
      if (validationError) {
        passwordError.value = validationError
        return
      }
      
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        passwordError.value = '两次输入的新密码不一致'
        return
      }
      
      isChangingPassword.value = true
      
      try {
        const response = await permissionApi.changeOwnPassword(
          passwordForm.currentPassword,
          passwordForm.newPassword
        )
        
        if (response.code === 200) {
          showAlert('密码修改成功！请使用新密码重新登录。')
          closeChangePasswordModal()
        } else {
          passwordError.value = response.message || '密码修改失败'
        }
      } catch (error) {
        console.error('修改密码失败:', error)
        passwordError.value = error?.response?.data?.message || '密码修改失败，请重试'
      } finally {
        isChangingPassword.value = false
      }
    }

    // 监听路由变化，自动展开对应菜单
    watch(
      () => route.path,
      (newPath) => {
        if (newPath === '/single-add' || newPath === '/batch-add') {
          showAddSubmenu.value = true
          activeMenu.value = 'add'
        } else {
          showAddSubmenu.value = false
          activeMenu.value = ''
        }
      },
      { immediate: true },
    )

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      showAddSubmenu,
      activeMenu,
      userInfo,
      userPermissions,
      permissionGroups,
      showPermissionsDropdown,
      userInfoSection,
      permissionsDropdown,
      hasPermission,
      togglePermissionsDropdown,
      toggleAddMenu,
      handleLogout,
      // 密码修改相关
      showChangePasswordModal,
      isChangingPassword,
      passwordError,
      passwordForm,
      passwordChecks,
      showCurrentPassword,
      showNewPassword,
      showConfirmPassword,
      openChangePasswordModal,
      closeChangePasswordModal,
      handlePasswordInput,
      handleChangePassword,
    }
  },
}
</script>

<style scoped>
/* 自定义滚动条样式 */
.sidebar-menu-scroll::-webkit-scrollbar {
  width: 6px;
}

.sidebar-menu-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-menu-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.sidebar-menu-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

/* Firefox 滚动条样式 */
.sidebar-menu-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

/* 隐藏浏览器默认的密码显示按钮 */
.password-input::-ms-reveal,
.password-input::-ms-clear,
.password-input::-webkit-credentials-auto-fill-button {
  display: none !important;
}

input[type="password"]::-ms-reveal,
input[type="password"]::-ms-clear {
  display: none !important;
}

/* 覆盖浏览器自动填充的背景色 */
.password-input:-webkit-autofill,
.password-input:-webkit-autofill:hover,
.password-input:-webkit-autofill:focus,
.password-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px white inset !important;
  -webkit-text-fill-color: #111827 !important;
  background-color: white !important;
}
</style>
