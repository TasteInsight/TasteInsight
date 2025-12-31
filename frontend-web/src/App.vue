<template>
  <div id="app" class="h-screen bg-gray-100">
    <router-view />
    <Modal />
  </div>
</template>

<script>
import Modal from '@/components/Common/Modal.vue'

export default {
  name: 'App',
  components: {
    Modal
  }
}
</script>
