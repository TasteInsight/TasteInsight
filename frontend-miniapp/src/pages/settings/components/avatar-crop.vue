<template>
  <view class="page-viewport avatar-crop-page">
    <view class="crop-workspace">
      <text class="crop-instruction">拖动或双指缩放，调整头像位置</text>
      <view v-if="loadError" class="crop-error">
        <text>{{ loadError }}</text>
        <button class="crop-secondary" @click="initWithSrc(src)">重新加载</button>
      </view>
      <view
        v-else
        class="crop-frame"
        :style="{ width: cropSizePx + 'px', height: cropSizePx + 'px' }"
      >
        <movable-area
          class="crop-area"
          :style="{ width: cropSizePx + 'px', height: cropSizePx + 'px' }"
        >
          <movable-view
            v-if="ready"
            :x="posX"
            :y="posY"
            :scale="true"
            :scale-min="1"
            :scale-max="4"
            :animation="false"
            direction="all"
            :disabled="exporting"
            @change="handleMoveChange"
            @scale="handleScaleChange"
            :style="{ width: baseDisplayWidth + 'px', height: baseDisplayHeight + 'px' }"
          >
            <image :src="src" mode="scaleToFill" class="crop-image" draggable="false" />
          </movable-view>
        </movable-area>
        <text v-if="!ready" class="crop-loading">正在读取图片…</text>
        <view class="crop-mask" />
      </view>
    </view>
    <view class="crop-actions">
      <button class="crop-secondary" :disabled="exporting" @click="handleCancel">取消</button>
      <button class="crop-primary" :disabled="!ready || exporting" @click="handleConfirm">
        {{ exporting ? '生成中…' : '使用头像' }}
      </button>
    </view>
    <canvas
      canvas-id="avatarCropCanvas"
      id="avatarCropCanvas"
      class="crop-canvas"
      :style="{ width: outputSizePx + 'px', height: outputSizePx + 'px' }"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, getCurrentInstance } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';

const src = ref('');
const systemInfo = uni.getSystemInfoSync();
const cropSizePx = Math.max(
  120,
  Math.min(360, (systemInfo.windowWidth || 375) - 40, (systemInfo.windowHeight || 720) - 180)
);
const outputSizePx = 400;
const ready = ref(false);
const exporting = ref(false);
const loadError = ref('');
const originalWidth = ref(0);
const originalHeight = ref(0);
const baseDisplayWidth = ref(0);
const baseDisplayHeight = ref(0);
const posX = ref(0);
const posY = ref(0);
const latestMove = { x: 0, y: 0, scale: 1 };
const instanceProxy = getCurrentInstance()?.proxy;
let disposed = false;
let completed = false;
let initVersion = 0;
let loadingSource = '';
let openerEventChannel:
  | {
      emit: (event: string, data?: unknown) => void;
      on: (event: string, handler: (data: any) => void) => void;
    }
  | undefined;

async function initWithSrc(inputSrc: string) {
  if (inputSrc && (loadingSource === inputSrc || (ready.value && src.value === inputSrc))) return;
  const version = ++initVersion;
  src.value = inputSrc;
  ready.value = false;
  loadError.value = '';
  if (!inputSrc) {
    loadError.value = '图片不存在，请返回重新选择';
    return;
  }
  loadingSource = inputSrc;
  try {
    const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve, reject) => {
      uni.getImageInfo({ src: inputSrc, success: resolve, fail: reject });
    });
    if (disposed || version !== initVersion) return;
    originalWidth.value = info.width;
    originalHeight.value = info.height;
    const ratio = Math.max(cropSizePx / info.width, cropSizePx / info.height);
    baseDisplayWidth.value = info.width * ratio;
    baseDisplayHeight.value = info.height * ratio;
    posX.value = (cropSizePx - baseDisplayWidth.value) / 2;
    posY.value = (cropSizePx - baseDisplayHeight.value) / 2;
    Object.assign(latestMove, { x: posX.value, y: posY.value, scale: 1 });
    ready.value = true;
  } catch {
    if (!disposed && version === initVersion) loadError.value = '读取图片失败，请重试';
  } finally {
    if (version === initVersion) loadingSource = '';
  }
}

onLoad((options: any) => {
  const page = (getCurrentPages() as any).slice(-1)[0];
  openerEventChannel = page?.getOpenerEventChannel?.();
  openerEventChannel?.on('init', (data: { src?: string }) => {
    if (data?.src) void initWithSrc(data.src);
  });
  if (options?.src) {
    let decoded = String(options.src);
    try {
      decoded = decodeURIComponent(decoded);
    } catch {}
    void initWithSrc(decoded);
  } else {
    loadError.value = '图片不存在，请返回重新选择';
  }
});

onUnload(() => {
  disposed = true;
  initVersion++;
  if (exporting.value) uni.hideLoading();
  if (!completed) openerEventChannel?.emit('cancel');
});

function handleMoveChange(event: { detail: { x: number; y: number } }) {
  latestMove.x = Number(event.detail.x);
  latestMove.y = Number(event.detail.y);
}

function handleScaleChange(event: { detail: { x: number; y: number; scale: number } }) {
  const { x, y, scale } = event.detail;
  latestMove.scale = Number(scale);
  latestMove.x = Number(x);
  latestMove.y = Number(y);
  // H5 与 App 的缩放事件返回中心缩放前的平移量，change 返回实际左上角。
  // #ifdef H5 || APP-PLUS
  latestMove.x -= (baseDisplayWidth.value * (latestMove.scale - 1)) / 2;
  latestMove.y -= (baseDisplayHeight.value * (latestMove.scale - 1)) / 2;
  // #endif
}

function handleCancel() {
  if (!exporting.value) uni.navigateBack();
}

async function handleConfirm() {
  if (!ready.value || exporting.value) return;
  exporting.value = true;
  uni.showLoading({ title: '生成中…' });
  try {
    const displayScale = (baseDisplayWidth.value * latestMove.scale) / originalWidth.value;
    const width = cropSizePx / displayScale;
    const height = cropSizePx / displayScale;
    const x = Math.max(0, Math.min(originalWidth.value - width, -latestMove.x / displayScale));
    const y = Math.max(0, Math.min(originalHeight.value - height, -latestMove.y / displayScale));
    const ctx = uni.createCanvasContext('avatarCropCanvas', instanceProxy);
    ctx.clearRect(0, 0, outputSizePx, outputSizePx);
    ctx.drawImage(src.value, x, y, width, height, 0, 0, outputSizePx, outputSizePx);
    await new Promise<void>(resolve => ctx.draw(false, resolve));
    if (disposed) return;
    const result = await new Promise<UniApp.CanvasToTempFilePathRes>((resolve, reject) => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'avatarCropCanvas',
          destWidth: outputSizePx,
          destHeight: outputSizePx,
          fileType: 'jpg',
          quality: 0.92,
          success: resolve,
          fail: reject,
        },
        instanceProxy
      );
    });
    if (disposed) return;
    exporting.value = false;
    uni.hideLoading();
    completed = true;
    openerEventChannel?.emit('cropped', { tempFilePath: result.tempFilePath });
    uni.navigateBack();
  } catch {
    if (!disposed) uni.showToast({ title: '生成失败，请重试', icon: 'none' });
  } finally {
    if (!disposed && exporting.value) {
      exporting.value = false;
      uni.hideLoading();
    }
  }
}
</script>

<style scoped>
.avatar-crop-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  color: #1f2937;
}
.crop-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px;
}
.crop-instruction {
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}
.crop-frame {
  position: relative;
  flex-shrink: 0;
}
.crop-area {
  overflow: hidden;
}
.crop-image {
  width: 100%;
  height: 100%;
}
.crop-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667085;
  font-size: 14px;
}
.crop-mask {
  position: absolute;
  inset: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 80px rgba(17, 24, 39, 0.62);
  pointer-events: none;
}
.crop-frame {
  overflow: hidden;
}
.crop-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.crop-actions {
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
  background: #fff;
}
.crop-primary,
.crop-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 10px 24px;
  border: 1px solid #d0d5dd;
  border-radius: 10px;
  background: #fff;
  color: #475467;
  font-size: 16px;
  line-height: 1.5;
}
.crop-primary {
  border-color: #660874;
  background: #660874;
  color: #fff;
}
.crop-primary[disabled],
.crop-secondary[disabled] {
  opacity: 0.5;
}
.crop-primary::after,
.crop-secondary::after {
  border: 0;
}
.crop-primary:focus-visible,
.crop-secondary:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}
.crop-canvas {
  position: absolute;
  top: -9999px;
  left: -9999px;
}
</style>
