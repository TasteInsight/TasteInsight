<template>
  <div id="app" class="h-screen bg-gray-100">
    <router-view />
    <Modal />
    <AppNotifications />
  </div>
</template>

<script>
import Modal from '@/components/Common/Modal.vue'
import AppNotifications from '@/components/Common/AppNotifications.vue'

export default {
  name: 'App',
  components: {
    Modal,
    AppNotifications
  }
}
</script>
