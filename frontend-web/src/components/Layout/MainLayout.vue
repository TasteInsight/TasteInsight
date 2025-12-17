<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />

    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" v-if="$route.meta.keepAlive" :key="$route.path" />
        </keep-alive>
        <component :is="Component" v-if="!$route.meta.keepAlive" :key="$route.path" />
      </router-view>
    </div>
  </div>
</template>

<script>
import Sidebar from './Sidebar.vue'

export default {
  name: 'MainLayout',
  components: {
    Sidebar,
  },
}
</script>
