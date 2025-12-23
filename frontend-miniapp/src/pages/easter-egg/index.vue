<template>
  <view class="w-full min-h-screen bg-gray-50 p-4">
    <view class="bg-white rounded-xl p-6 shadow-sm">
      <view class="text-center">
        <view class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
          <text class="text-white text-xl font-bold">秘</text>
        </view>
        <text class="text-xl font-bold text-gray-800 block mt-4">食鉴 · 隐藏实验室</text>
        <text class="text-gray-500 text-sm mt-1">你发现了一个不太正经的味觉分支。</text>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <text class="text-sm font-semibold text-gray-800 block">今日味觉签</text>
        <text class="text-gray-600 text-sm leading-relaxed mt-2">{{ fortune }}</text>

        <view class="flex items-center justify-between mt-4">
          <button class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm" @tap="regenerate">
            再来一签
          </button>
          <button class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm" @tap="copyFortune">
            复制
          </button>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <text class="text-sm font-semibold text-gray-800 block">AI胡说八道菜名生成器</text>
        <text class="text-gray-600 text-sm mt-2">{{ dishName }}</text>
        <text class="text-gray-500 text-xs mt-2">提示：点 3 次会“变异”。</text>

        <view class="mt-4">
          <button class="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm" @tap="nextDish">
            生成一道离谱但想吃的菜
          </button>
        </view>
      </view>

      <view class="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
        <text class="text-sm font-semibold text-gray-800 block">味觉参数（纯属娱乐）</text>

        <view class="mt-3">
          <view class="flex items-center justify-between">
            <text class="text-xs text-gray-600">辣度</text>
            <text class="text-xs text-gray-600">{{ heat }}/10</text>
          </view>
          <slider :value="heat" :min="0" :max="10" :step="1" @change="onHeatChange" />
        </view>

        <view class="mt-3">
          <view class="flex items-center justify-between">
            <text class="text-xs text-gray-600">甜度</text>
            <text class="text-xs text-gray-600">{{ sweet }}/10</text>
          </view>
          <slider :value="sweet" :min="0" :max="10" :step="1" @change="onSweetChange" />
        </view>

        <view class="mt-4">
          <text class="text-gray-700 text-sm">你的味觉结论：</text>
          <text class="text-gray-800 text-sm font-medium">{{ conclusion }}</text>
        </view>
      </view>

      <view class="mt-6 text-center">
        <text class="text-gray-400 text-xs">提示：这个页面不会出现在任何菜单里。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

function pickOne(list: string[]) {
  return list[Math.floor(Math.random() * list.length)]
}

const fortune = ref('')
const dishName = ref('')
const dishTapCount = ref(0)

const heat = ref(3)
const sweet = ref(2)

const conclusion = computed(() => {
  const spicy = heat.value >= 7
  const sugary = sweet.value >= 7
  if (spicy && sugary) return '你是“甜辣双修”型：建议点一份甜辣口味再配冰饮。'
  if (spicy) return '你是“热血辣友”型：今天适合挑战爆辣。'
  if (sugary) return '你是“甜味守护者”型：奶茶/甜点优先级拉满。'
  if (heat.value <= 2 && sweet.value <= 2) return '你是“清淡派”型：适合原味、少油、少盐。'
  return '你是“均衡探索者”型：什么都能尝两口。'
})

function regenerate() {
  const opener = pickOne(['今日宜：', '食鉴提示：', '味觉密语：', '隐藏建议：'])
  const action = pickOne([
    '去一个没去过的窗口点招牌菜。',
    '把“想吃”交给直觉，不要看评价先尝一口。',
    '给一条认真评价：一句优点 + 一句建议。',
    '尝试把主食换成另一种选择，看看饱腹感差异。',
    '和朋友交换一口菜：共享信息密度最高。'
  ])
  const twist = pickOne([
    '（若遇到难吃：请把它写进食鉴，拯救后人。）',
    '（若遇到惊喜：收藏它，别让它消失。）',
    '（若纠结：点小份，降低决策成本。）',
    '（若犹豫：先拍照，证据最重要。）'
  ])
  fortune.value = `${opener}${action}${twist}`
}

function nextDish() {
  dishTapCount.value += 1

  const style = pickOne(['反复横跳', '究极', '隐藏', '限时', '毕业', '熬夜', '早八', '社恐', '社牛'])
  const base = pickOne(['鸡腿', '牛肉', '豆腐', '茄子', '土豆', '虾仁', '西兰花', '蘑菇', '番茄', '培根'])
  const sauce = pickOne(['麻辣', '黑椒', '咖喱', '蒜香', '糖醋', '照烧', '椒盐', '酸汤', '番茄', '孜然'])
  const finish = pickOne(['盖饭', '拌面', '焗烤', '小火锅', '沙拉', '卷饼', '手抓', '双拼'])

  let extra = ''
  if (dishTapCount.value % 3 === 0) {
    extra = pickOne([' + 脆脆', ' + 爆浆', ' + 双倍芝士', ' + 冰火同锅', ' + 神秘配菜'])
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort()
  }

  dishName.value = `${style}${sauce}${base}${finish}${extra}`
}

function copyFortune() {
  const data = fortune.value || '（空）'
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' })
  })
}

function onHeatChange(e: any) {
  heat.value = Number(e?.detail?.value ?? heat.value)
}

function onSweetChange(e: any) {
  sweet.value = Number(e?.detail?.value ?? sweet.value)
}

regenerate()
nextDish()
</script>
