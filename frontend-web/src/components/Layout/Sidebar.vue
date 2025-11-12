<template>
  <div class="w-[260px] h-full bg-tsinghua-purple text-white flex flex-col py-6">
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
            <span class="iconify" data-icon="carbon:document-multiple"></span>
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
    </div>
    
    <div class="px-6 py-4 text-sm flex items-center justify-between">
      <div class="flex items-center space-x-2 opacity-80">
        <span class="iconify" data-icon="mdi:user-circle-outline"></span>
        <span>管理员：王老师</span>
      </div>
      <button class="opacity-70 hover:opacity-100">
        <span class="iconify" data-icon="carbon:logout"></span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

export default {
  name: 'Sidebar',
  setup() {
    const route = useRoute()
    const showAddSubmenu = ref(false)
    const activeMenu = ref('')
    
    const toggleAddMenu = () => {
      showAddSubmenu.value = !showAddSubmenu.value
      activeMenu.value = showAddSubmenu.value ? 'add' : ''
    }
    
    // 监听路由变化，自动展开对应菜单
    watch(() => route.path, (newPath) => {
      if (newPath === '/single-add' || newPath === '/batch-add') {
        showAddSubmenu.value = true
        activeMenu.value = 'add'
      } else {
        activeMenu.value = ''
      }
    }, { immediate: true })
    
    return {
      showAddSubmenu,
      activeMenu,
      toggleAddMenu
    }
  }
}
</script>