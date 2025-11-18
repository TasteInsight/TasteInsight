<template>
  <div class="fixed left-0 top-0 w-[260px] h-screen bg-tsinghua-purple text-white flex flex-col py-6 z-[9999] pointer-events-auto">
    <div class="px-6 mb-8">
      <div class="flex items-center space-x-3">
        <span class="iconify text-2xl" data-icon="noto-v1:pot-of-food"></span>
        <h1 class="text-xl font-bold">食鉴管理平台</h1>
      </div>
      <div class="text-sm opacity-75 mt-2 tracking-wide">清华大学餐饮管理中心</div>
    </div>
    
    <div class="flex-1">
      <div>
        <button 
          class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
          :class="{ 'active': activeMenu === 'add' }"
          @click="toggleAddMenu"
        >
          <span class="iconify" data-icon="carbon:add"></span>
          <span>菜品添加</span>
        </button>
        <div v-if="showAddSubmenu" class="ml-6 border-l border-white/20 pl-3">
          <router-link 
            to="/single-add"
            class="sidebar-btn w-full py-2 px-3 text-left flex items-center space-x-2 text-base font-normal"
            :class="{ 'active': $route.path === '/single-add' }"
          >
            <span class="iconify" data-icon="carbon:document"></span>
            <span>单项添加</span>
          </router-link>
          <router-link 
            to="/batch-add"
            class="sidebar-btn w-full py-2 px-3 text-left flex items-center space-x-2 text-base font-normal"
            :class="{ 'active': $route.path === '/batch-add' }"
          >
            <span class="iconify" data-icon="carbon:document-multiple-02"></span>
            <span>批量添加</span>
          </router-link>
        </div>
      </div>
      <router-link 
        to="/modify-dish"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ 'active': $route.path === '/modify-dish' }"
      >
        <span class="iconify" data-icon="clarity:note-edit-line"></span>
        <span>菜品修改</span>
      </router-link>
      <router-link 
        to="/review-dish"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ 'active': $route.path === '/review-dish' }"
      >
        <span class="iconify" data-icon="carbon:task-approved"></span>
        <span>菜品审核</span>
      </router-link>
      <router-link 
        to="/add-canteen"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ 'active': $route.path === '/add-canteen' }"
      >
        <span class="iconify" data-icon="carbon:restaurant"></span>
        <span>食堂信息管理</span>
      </router-link>
      <router-link 
        to="/user-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ 'active': $route.path === '/user-manage' }"
      >
        <span class="iconify" data-icon="clarity:group-line"></span>
        <span>人员权限管理</span>
      </router-link>
      <router-link 
        to="/news-manage"
        class="sidebar-btn w-full py-3 px-6 text-left flex items-center space-x-3 text-lg font-medium"
        :class="{ 'active': $route.path === '/news-manage' }"
      >
        <span class="iconify" data-icon="carbon:license-draft"></span>
        <span>新闻管理</span>
      </router-link>
    </div>
    
    <div class="px-6 py-4 text-sm flex items-center justify-between mt-auto border-t border-white/20">
      <div class="flex items-center space-x-2 opacity-80">
        <span class="iconify" data-icon="mdi:user-circle-outline"></span>
        <span>管理员：{{ userInfo.username || userInfo.name || '管理员' }}</span>
      </div>
      <button 
        class="opacity-70 hover:opacity-100 transition"
        @click="handleLogout"
        title="退出登录"
      >
        <span class="iconify" data-icon="carbon:logout"></span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
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
    
    const userInfo = computed(() => authStore.user || { username: '管理员' })
    
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
    watch(() => route.path, (newPath) => {
      if (newPath === '/single-add' || newPath === '/batch-add') {
        showAddSubmenu.value = true
        activeMenu.value = 'add'
      } else {
        showAddSubmenu.value = false
        activeMenu.value = ''
      }
    }, { immediate: true })
    
    return {
      showAddSubmenu,
      activeMenu,
      userInfo,
      toggleAddMenu,
      handleLogout
    }
  }
}
</script>