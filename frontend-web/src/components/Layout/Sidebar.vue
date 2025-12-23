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
    </div>

    <div ref="userInfoSection" class="px-6 py-4 text-sm mt-auto border-t border-white/20 relative">
      <div class="flex items-center justify-between">
        <div
          class="flex items-center space-x-2 opacity-80 cursor-pointer hover:opacity-100 transition"
          @click="togglePermissionsDropdown"
        >
          <span class="iconify" data-icon="mdi:user-circle-outline"></span>
          <span>管理员：{{ userInfo.username || userInfo.name || '管理员' }}</span>
          <span
            class="iconify text-xs transition-transform"
            :class="{ 'rotate-180': showPermissionsDropdown }"
            data-icon="carbon:chevron-down"
          ></span>
        </div>
        <button
          class="opacity-70 hover:opacity-100 transition"
          @click="handleLogout"
          title="退出登录"
        >
          <span class="iconify" data-icon="carbon:logout"></span>
        </button>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'

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

    const handleLogout = () => {
      if (confirm('确定要退出登录吗？')) {
        authStore.logout()
        router.push('/login')
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
</style>
