<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isVisible"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
        @click.self="handleClose(true)"
      >
        <div class="bg-white rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] overflow-hidden animate-fade-in-up flex flex-col">
          <!-- 头部 -->
          <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
            <h3 class="text-lg font-medium text-gray-900">{{ modalTitle }}</h3>
            <button
              v-if="modalShowClose"
              @click="handleClose(false)"
              class="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <span class="iconify text-xl" data-icon="carbon:close"></span>
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="p-6 flex-1 overflow-y-auto">
            <div v-if="modalMessage" class="text-gray-600 whitespace-pre-wrap">{{ modalMessage }}</div>
            <slot></slot>
          </div>

          <!-- 底部按钮 -->
          <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
            <button
              v-for="(button, index) in modalButtons"
              :key="index"
              @click.stop="handleButtonClick(button as ButtonConfig, index)"
              :class="[
                'px-4 py-2 rounded-lg transition duration-200 flex items-center',
                (button as ButtonConfig).variant === 'primary' 
                  ? 'bg-tsinghua-purple text-white hover:bg-tsinghua-dark' 
                  : (button as ButtonConfig).variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              ]"
              :disabled="(button as ButtonConfig).loading"
            >
              <span
                v-if="(button as ButtonConfig).loading"
                class="iconify animate-spin mr-2"
                data-icon="mdi:loading"
              ></span>
              {{ (button as ButtonConfig).text }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { modalState, closeModal } from '@/composables/useModal'
import type { ButtonConfig } from '@/composables/useModal'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  showClose: {
    type: Boolean,
    default: true
  },
  buttons: {
    type: Array,
    default: () => []
  },
  closeOnClickMask: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:visible', 'close'])

const isVisible = computed(() => props.visible || modalState.visible.value)
const modalTitle = computed(() => props.title || modalState.title.value)
const modalMessage = computed(() => props.message || modalState.message.value)
const modalButtons = computed(() => props.buttons.length > 0 ? props.buttons : modalState.buttons.value)
const modalShowClose = computed(() => props.showClose !== undefined ? props.showClose : modalState.showClose.value)
const modalCloseOnClickMask = computed(() => props.closeOnClickMask !== undefined ? props.closeOnClickMask : modalState.closeOnClickMask.value)

const handleClose = (fromMask: boolean = true) => {
  // 如果是从遮罩层点击，检查是否允许关闭
  if (fromMask && !modalCloseOnClickMask.value) {
    return
  }
  // 关闭按钮总是可以关闭
  if (modalState.visible.value) {
    closeModal(false)
  } else {
    emit('update:visible', false)
    emit('close')
  }
}

const handleButtonClick = async (button: ButtonConfig, index: number) => {
  // 防止重复点击
  if (button.loading) {
    return
  }

  let shouldClose = true
  let result: boolean = false

  if (button.handler) {
    try {
      const handlerResult = button.handler()
      if (handlerResult instanceof Promise) {
        // 更新loading状态
        if (modalState.buttons.value[index]) {
          modalState.buttons.value[index].loading = true
        }
        const resolvedResult = await handlerResult
        if (modalState.buttons.value[index]) {
          modalState.buttons.value[index].loading = false
        }
        // 对于确认弹窗等，返回 false 表示点击了取消，应该关闭并返回 false
        // 只有当 handler 明确需要阻止关闭时（目前没有这种场景），才设置 shouldClose 为 false
        result = resolvedResult === true
        shouldClose = true
      } else {
        result = handlerResult === true
        shouldClose = true
      }
    } catch (error) {
      if (modalState.buttons.value[index]) {
        modalState.buttons.value[index].loading = false
      }
      console.error('Button handler error:', error)
      shouldClose = false // 出错时不关闭
      result = false
    }
  }

  // 根据shouldClose决定是否关闭
  if (shouldClose) {
    if (modalState.visible.value) {
      // 使用全局状态，调用closeModal
      closeModal(result)
    } else {
      // 使用props，发送事件
      emit('update:visible', false)
      emit('close')
    }
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .animate-fade-in-up,
.modal-leave-active .animate-fade-in-up {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from .animate-fade-in-up,
.modal-leave-to .animate-fade-in-up {
  opacity: 0;
  transform: translateY(10px);
}
</style>

