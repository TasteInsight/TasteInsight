<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />

    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <router-view v-slot="{ Component }">
        <template v-if="$route.meta.keepAlive">
          <keep-alive>
            <component :is="Component" :key="viewKey" />
          </keep-alive>
        </template>
        <template v-else>
          <component :is="Component" :key="viewKey" />
        </template>
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
  computed: {
    viewKey() {
      return this.$route.name === 'AddSubDish' ? this.$route.fullPath : this.$route.path
    },
  },
}
</script>
