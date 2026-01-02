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
            direction="all"
            @change="handleMoveChange"
            class="absolute"
            :style="{ width: baseDisplayWidth + 'px', height: baseDisplayHeight + 'px' }"
          >
            <image
              :src="src"
              mode="scaleToFill"
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
import { ref, getCurrentInstance } from 'vue';
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

// 真机上 movable-view 缩放 change 事件非常高频：
// 1) 频繁更新受控 x/y 会导致明显卡顿
// 2) 这里用“最新值 + 每帧合并一次更新”的方式降低卡顿
// 3) scale 不做受控绑定（不传 scale-value），避免真机上下一次触摸把缩放重置回 1
const latestMove = {
  x: 0,
  y: 0,
  scale: 1,
};

let moveSyncPending = false;
const scheduleFrame: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16);

let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

// uniapp 在部分真机上调用 canvasToTempFilePath / createCanvasContext 需要传入组件实例
const instanceProxy = getCurrentInstance()?.proxy as any;

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

    latestMove.x = posX.value;
    latestMove.y = posY.value;
    latestMove.scale = 1;

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
      if (data?.src) {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        initWithSrc(data.src);
      }
    });
  }

  // 2) 兜底：仍支持 query 传 src
  if (options?.src) {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    let decoded = '';
    try {
      decoded = decodeURIComponent(String(options.src));
    } catch (e) {
      decoded = String(options.src);
    }
    initWithSrc(decoded);
    return;
  }

  // 3) 若两者都没拿到，给个兜底超时提示（设备慢/时序问题时不应太短）
  fallbackTimer = setTimeout(() => {
    if (!src.value) {
      uni.showToast({ title: '图片不存在', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 800);
    }
    fallbackTimer = null;
  }, 2000);
});

function handleMoveChange(e: any) {
  // e.detail: { x, y, scale }
  const nextX = Number(e?.detail?.x);
  const nextY = Number(e?.detail?.y);
  const nextScale = Number(e?.detail?.scale);
  // 真机上可能返回 string，这里统一转 number；NaN 则忽略，避免回弹
  if (Number.isFinite(nextX)) latestMove.x = nextX;
  if (Number.isFinite(nextY)) latestMove.y = nextY;
  if (Number.isFinite(nextScale) && nextScale > 0) latestMove.scale = nextScale;

  if (moveSyncPending) return;
  moveSyncPending = true;
  scheduleFrame(() => {
    moveSyncPending = false;
    posX.value = latestMove.x;
    posY.value = latestMove.y;
  });
}

function handleCancel() {
  uni.navigateBack();
}

async function handleConfirm() {
  if (!ready.value) return;

  uni.showLoading({ title: '生成中...' });

  try {
    // 导出时使用最新一次事件里的参数，避免节流导致的“框选与导出不一致”
    const exportX = Number.isFinite(latestMove.x) ? latestMove.x : posX.value;
    const exportY = Number.isFinite(latestMove.y) ? latestMove.y : posY.value;
    const exportScale = Number.isFinite(latestMove.scale) && latestMove.scale > 0 ? latestMove.scale : 1;

    const displayScale = (baseDisplayWidth.value * exportScale) / originalWidth.value;

    // 裁剪框为整个 movable-area (0..cropSizePx)
    const sx = (0 - exportX) / displayScale;
    const sy = (0 - exportY) / displayScale;
    const sWidth = cropSizePx / displayScale;
    const sHeight = cropSizePx / displayScale;

    // clamp
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const csx = clamp(sx, 0, originalWidth.value);
    const csy = clamp(sy, 0, originalHeight.value);
    const csw = clamp(sWidth, 1, originalWidth.value - csx);
    const csh = clamp(sHeight, 1, originalHeight.value - csy);

    const ctx = instanceProxy
      ? uni.createCanvasContext('avatarCropCanvas', instanceProxy)
      : uni.createCanvasContext('avatarCropCanvas');
    ctx.clearRect(0, 0, outputSizePx, outputSizePx);
    ctx.drawImage(src.value, csx, csy, csw, csh, 0, 0, outputSizePx, outputSizePx);
    ctx.draw(false, () => {
      const options: UniApp.CanvasToTempFilePathOptions = {
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
      };

      // 真机优先传实例，避免找不到 canvas 导致一直转圈
      if (instanceProxy) {
        uni.canvasToTempFilePath(options, instanceProxy);
      } else {
        uni.canvasToTempFilePath(options);
      }
    });
  } catch (e) {
    console.error('crop confirm error', e);
    uni.hideLoading();
    uni.showToast({ title: '生成失败', icon: 'none' });
  }
}
</script>
