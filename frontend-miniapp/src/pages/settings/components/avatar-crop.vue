<template>
  <view class="min-h-screen bg-black flex flex-col">
    <!-- 裁剪区域 -->
    <view class="flex-1 flex items-center justify-center px-6">
      <view
        class="relative"
        :style="{ width: cropSizePx + 'px', height: cropSizePx + 'px' }"
      >
        <movable-area
          class="relative overflow-hidden"
          :style="{ width: cropSizePx + 'px', height: cropSizePx + 'px' }"
        >
          <movable-view
            v-if="ready"
            :x="posX"
            :y="posY"
            :scale="true"
            :scale-min="1"
            :scale-max="4"
            :scale-value="scale"
            direction="all"
            @change="handleMoveChange"
            class="absolute"
            :style="{ width: baseDisplayWidth + 'px', height: baseDisplayHeight + 'px' }"
          >
            <image
              :src="src"
              mode="aspectFill"
              class="w-full h-full"
              draggable="false"
            />
          </movable-view>
        </movable-area>

        <!-- 圆形裁剪框遮罩：外部半透明，中心圆形透明 -->
        <view class="absolute inset-0 pointer-events-none">
          <!-- 外层遮罩用 radial-gradient 做圆形透明洞 -->
          <view
            class="w-full h-full"
            :style="{
              background:
                'radial-gradient(circle at center, transparent ' + (cropSizePx / 2) + 'px, rgba(0,0,0,0.55) ' + (cropSizePx / 2 + 1) + 'px)'
            }"
          />
          <!-- 圆形边框 -->
          <view
            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            :style="{ width: cropSizePx + 'px', height: cropSizePx + 'px' }"
          />
        </view>
      </view>
    </view>

    <!-- 操作栏 -->
    <view class="bg-white px-4 py-4 flex items-center justify-between">
      <view
        class="px-6 py-3 rounded-full border border-gray-300 text-gray-700"
        @click="handleCancel"
      >
        取消
      </view>
      <view
        class="px-6 py-3 rounded-full bg-ts-purple text-white"
        @click="handleConfirm"
      >
        确定
      </view>
    </view>

    <!-- 隐藏画布用于导出裁剪结果 -->
    <canvas
      canvas-id="avatarCropCanvas"
      id="avatarCropCanvas"
      class="absolute"
      :style="{ left: '-9999px', top: '-9999px', width: outputSizePx + 'px', height: outputSizePx + 'px' }"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const src = ref('');

// 以屏宽为基准：裁剪框为屏宽的 70%，最小 260px，最大 360px
const systemInfo = uni.getSystemInfoSync();
const windowWidth = systemInfo.windowWidth || 375;
const cropSizePx = Math.max(260, Math.min(360, Math.floor(windowWidth * 0.7)));

// 输出尺寸（上传用）：固定正方形，后续展示仍然用圆形
const outputSizePx = 400;

const ready = ref(false);

// 原图尺寸
const originalWidth = ref(0);
const originalHeight = ref(0);

// base 显示尺寸（scale=1 时 movable-view 尺寸），用于保证覆盖裁剪框
const baseDisplayWidth = ref(0);
const baseDisplayHeight = ref(0);

// movable-view 状态
const posX = ref(0);
const posY = ref(0);
const scale = ref(1);

async function initWithSrc(inputSrc: string) {
  src.value = inputSrc;

  if (!src.value) {
    uni.showToast({ title: '图片不存在', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }

  try {
    const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve, reject) => {
      uni.getImageInfo({
        src: src.value,
        success: resolve,
        fail: reject,
      });
    });

    originalWidth.value = info.width;
    originalHeight.value = info.height;

    const ratio = info.width / info.height;
    // 让图片在 scale=1 时至少覆盖裁剪框
    if (ratio >= 1) {
      baseDisplayHeight.value = cropSizePx;
      baseDisplayWidth.value = Math.ceil(cropSizePx * ratio);
    } else {
      baseDisplayWidth.value = cropSizePx;
      baseDisplayHeight.value = Math.ceil(cropSizePx / ratio);
    }

    // 居中
    posX.value = Math.floor((cropSizePx - baseDisplayWidth.value) / 2);
    posY.value = Math.floor((cropSizePx - baseDisplayHeight.value) / 2);

    ready.value = true;
  } catch (e) {
    console.error('getImageInfo failed', e);
    uni.showToast({ title: '读取图片失败', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
  }
}

onLoad(async (options: any) => {
  // 1) 优先从 opener 的 eventChannel 接收（避免 query 过长导致无法打开页面）
  const page = (getCurrentPages() as any).slice(-1)[0];
  const openerEventChannel = page?.getOpenerEventChannel?.();
  if (openerEventChannel?.on) {
    openerEventChannel.on('init', (data: { src?: string }) => {
      if (data?.src) initWithSrc(data.src);
    });
  }

  // 2) 兜底：仍支持 query 传 src
  if (options?.src) {
    initWithSrc(decodeURIComponent(options.src));
    return;
  }

  // 3) 若两者都没拿到，给个短超时提示
  setTimeout(() => {
    if (!src.value) {
      uni.showToast({ title: '图片不存在', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 800);
    }
  }, 300);
});

function handleMoveChange(e: any) {
  // e.detail: { x, y, scale }
  if (typeof e?.detail?.x === 'number') posX.value = e.detail.x;
  if (typeof e?.detail?.y === 'number') posY.value = e.detail.y;
  if (typeof e?.detail?.scale === 'number') scale.value = e.detail.scale;
}

function handleCancel() {
  uni.navigateBack();
}

async function handleConfirm() {
  if (!ready.value) return;

  uni.showLoading({ title: '生成中...' });

  try {
    const displayScale = (baseDisplayWidth.value * scale.value) / originalWidth.value;

    // 裁剪框为整个 movable-area (0..cropSizePx)
    const sx = (0 - posX.value) / displayScale;
    const sy = (0 - posY.value) / displayScale;
    const sWidth = cropSizePx / displayScale;
    const sHeight = cropSizePx / displayScale;

    // clamp
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const csx = clamp(sx, 0, originalWidth.value);
    const csy = clamp(sy, 0, originalHeight.value);
    const csw = clamp(sWidth, 1, originalWidth.value - csx);
    const csh = clamp(sHeight, 1, originalHeight.value - csy);

    const ctx = uni.createCanvasContext('avatarCropCanvas');
    ctx.clearRect(0, 0, outputSizePx, outputSizePx);
    ctx.drawImage(src.value, csx, csy, csw, csh, 0, 0, outputSizePx, outputSizePx);
    ctx.draw(false, () => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'avatarCropCanvas',
          destWidth: outputSizePx,
          destHeight: outputSizePx,
          fileType: 'jpg',
          quality: 0.92,
          success: (res) => {
            uni.hideLoading();
            const eventChannel = (getCurrentPages() as any).slice(-1)[0].getOpenerEventChannel?.();
            eventChannel?.emit('cropped', { tempFilePath: res.tempFilePath });
            uni.navigateBack();
          },
          fail: (err) => {
            console.error('canvasToTempFilePath fail', err);
            uni.hideLoading();
            uni.showToast({ title: '生成失败', icon: 'none' });
          },
        },
        // @ts-ignore
        this
      );
    });
  } catch (e) {
    console.error('crop confirm error', e);
    uni.hideLoading();
    uni.showToast({ title: '生成失败', icon: 'none' });
  }
}
</script>
