<template>
  <div class="admin-app">
    <a class="admin-skip-link" href="#admin-main">跳转到主要内容</a>
    <Sidebar />

    <main id="admin-main" class="admin-main" tabindex="-1">
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
    </main>
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
