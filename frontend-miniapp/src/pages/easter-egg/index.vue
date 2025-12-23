<template>
  <view class="w-full min-h-screen bg-gray-50 p-4">
    <view class="bg-white rounded-xl p-6 shadow-sm">
      <view class="text-center">
        <view class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center" @tap="toggleSecretHint">
          <text class="text-white text-xl font-bold">秘</text>
        </view>
        <text class="text-xl font-bold text-gray-800 block mt-4">食鉴 · 隐藏实验室</text>
        <text class="text-gray-500 text-sm mt-1">你发现了一个不太正经的味觉分支。</text>

        <view class="mt-4 flex items-center justify-center gap-2">
          <view class="px-3 py-1 rounded-full bg-gray-100">
            <text class="text-xs text-gray-600">已生成 {{ stats.dishesGenerated }} 道菜</text>
          </view>
          <view class="px-3 py-1 rounded-full bg-gray-100">
            <text class="text-xs text-gray-600">变异 {{ stats.mutations }} 次</text>
          </view>
        </view>

        <view v-if="showSecretHint" class="mt-3">
          <text class="text-xs text-gray-500">小提示：在本页点“生成”3次会触发一次变异。</text>
        </view>
      </view>

      <view class="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm font-semibold text-gray-800">实验员等级</text>
          <view class="px-2 py-1 rounded-full bg-white">
            <text class="text-xs text-gray-700">Lv. {{ level }}</text>
          </view>
        </view>

        <view class="mt-3 flex items-center justify-between">
          <text class="text-xs text-gray-600">经验：{{ xpInLevel }}/{{ xpToNext }}</text>
          <text class="text-xs text-gray-600">金币：{{ stats.coins }}</text>
        </view>

        <view class="mt-2 w-full h-2 rounded-full bg-white overflow-hidden">
          <view class="h-2 rounded-full bg-purple-600" :style="{ width: `${(xpInLevel / xpToNext) * 100}%` }"></view>
        </view>

        <view class="mt-3 flex items-center justify-between">
          <text class="text-xs text-gray-600">连击最高：{{ stats.bestCombo }}</text>
          <text class="text-xs text-gray-600">挑战最佳：{{ stats.bestChallengeCount }}</text>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm font-semibold text-gray-800">今日味觉签</text>
          <view class="px-2 py-1 rounded-full bg-white">
            <text class="text-xs text-gray-500">{{ todayKey }}</text>
          </view>
        </view>
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
        <text class="text-sm font-semibold text-gray-800 block">今日任务（点亮就算完成）</text>
        <text class="text-gray-500 text-xs mt-1">全部完成会解锁一条“成就签”。</text>

        <view class="mt-3 space-y-2">
          <view
            v-for="mission in missions"
            :key="mission.id"
            class="flex items-center justify-between rounded-lg px-3 py-2"
            :class="isMissionDone(mission.id) ? 'bg-white' : 'bg-gray-100'"
            @tap="toggleMission(mission.id)"
          >
            <view class="flex items-center">
              <view
                class="w-5 h-5 rounded-full mr-2 flex items-center justify-center"
                :class="isMissionDone(mission.id) ? 'bg-green-100' : 'bg-gray-200'"
              >
                <text class="text-xs" :class="isMissionDone(mission.id) ? 'text-green-700' : 'text-gray-500'">
                  {{ isMissionDone(mission.id) ? '✓' : '·' }}
                </text>
              </view>
              <text class="text-sm" :class="isMissionDone(mission.id) ? 'text-gray-700' : 'text-gray-600'">
                {{ mission.text }}
              </text>
            </view>
            <text class="text-xs" :class="isMissionDone(mission.id) ? 'text-green-600' : 'text-gray-400'">
              {{ isMissionDone(mission.id) ? '完成' : '未完成' }}
            </text>
          </view>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <text class="text-sm font-semibold text-gray-800 block">AI胡说八道菜名生成器</text>
        <text class="text-gray-600 text-sm mt-2">{{ dishName }}</text>
        <view class="mt-2 flex items-center justify-between">
          <text class="text-gray-500 text-xs">提示：点 3 次会“变异”。</text>
          <text class="text-gray-500 text-xs">灵感值：{{ inspiration }}/10</text>
        </view>

        <view class="mt-2 w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <view class="h-2 rounded-full bg-blue-600" :style="{ width: `${Math.min((inspiration / 10) * 100, 100)}%` }"></view>
        </view>

        <view class="mt-4">
          <button class="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm" @tap="nextDish">
            生成一道离谱但想吃的菜
          </button>
        </view>

        <view class="mt-3 flex items-center justify-between">
          <view class="px-3 py-1 rounded-full" :class="comboCount >= 2 ? 'bg-yellow-100' : 'bg-gray-100'">
            <text class="text-xs" :class="comboCount >= 2 ? 'text-yellow-800' : 'text-gray-600'">
              连击：{{ comboCount }}{{ comboCount >= 2 ? '（+奖励）' : '' }}
            </text>
          </view>
          <text class="text-xs text-gray-500">{{ comboHint }}</text>
        </view>

        <view class="mt-3 flex items-center justify-between">
          <button class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm" @tap="copyDish">
            复制菜名
          </button>
          <button class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm" @tap="shareText">
            复制今日组合
          </button>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm font-semibold text-gray-800">称号抽卡（纯属娱乐）</text>
          <view class="px-2 py-1 rounded-full bg-white">
            <text class="text-xs text-gray-600">收藏 {{ stats.titles.length }}</text>
          </view>
        </view>

        <view class="mt-2">
          <text class="text-gray-600 text-sm">当前称号：</text>
          <text class="text-gray-800 text-sm font-medium">{{ currentTitle }}</text>
        </view>

        <view class="mt-3 flex items-center justify-between">
          <button class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm" @tap="drawTitle">
            抽一张（-{{ TITLE_COST }}金币）
          </button>
          <button class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm" @tap="equipRandomTitle">
            随机换称号
          </button>
        </view>

        <view class="mt-3 flex flex-wrap gap-2">
          <view
            v-for="t in previewTitles"
            :key="t"
            class="px-3 py-1 rounded-full bg-white"
          >
            <text class="text-xs text-gray-700">{{ t }}</text>
          </view>
          <view v-if="stats.titles.length === 0" class="px-3 py-1 rounded-full bg-white">
            <text class="text-xs text-gray-400">先抽一张试试</text>
          </view>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm font-semibold text-gray-800">限时挑战：10秒连抽</text>
          <view class="px-2 py-1 rounded-full" :class="challenge.active ? 'bg-red-100' : 'bg-white'">
            <text class="text-xs" :class="challenge.active ? 'text-red-700' : 'text-gray-600'">
              {{ challenge.active ? `剩余 ${challenge.remaining}s` : '未开始' }}
            </text>
          </view>
        </view>

        <text class="text-gray-600 text-sm mt-2">
          目标：10秒内生成 {{ challenge.target }} 道菜（当前 {{ challenge.count }}）。
        </text>

        <view class="mt-3 w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <view class="h-2 rounded-full bg-red-500" :style="{ width: `${Math.min((challenge.count / challenge.target) * 100, 100)}%` }"></view>
        </view>

        <view class="mt-4 flex items-center justify-between">
          <button
            class="px-4 py-2 rounded-lg text-sm"
            :class="challenge.active ? 'bg-gray-200 text-gray-500' : 'bg-red-600 text-white'"
            :disabled="challenge.active"
            @tap="startChallenge"
          >
            开始挑战
          </button>
          <text class="text-xs text-gray-500">成功奖励：+{{ CHALLENGE_REWARD_COINS }}金币</text>
        </view>
      </view>

      <view class="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm font-semibold text-gray-800">味觉参数（纯属娱乐）</text>
          <button class="px-3 py-1 rounded-lg bg-white text-gray-700 text-xs" @tap="randomizeFlavor">
            随机一下
          </button>
        </view>

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

        <view class="mt-3">
          <view class="flex items-center justify-between">
            <text class="text-xs text-gray-600">咸度</text>
            <text class="text-xs text-gray-600">{{ salty }}/10</text>
          </view>
          <slider :value="salty" :min="0" :max="10" :step="1" @change="onSaltyChange" />
        </view>

        <view class="mt-3">
          <view class="flex items-center justify-between">
            <text class="text-xs text-gray-600">油腻</text>
            <text class="text-xs text-gray-600">{{ oily }}/10</text>
          </view>
          <slider :value="oily" :min="0" :max="10" :step="1" @change="onOilyChange" />
        </view>

        <view class="mt-4">
          <text class="text-gray-700 text-sm">你的味觉结论：</text>
          <text class="text-gray-800 text-sm font-medium">{{ conclusion }}</text>
          <view class="mt-2 flex items-center justify-between">
            <text class="text-gray-500 text-xs">称号：{{ title }}</text>
            <text class="text-gray-500 text-xs">建议：{{ suggestion }}</text>
          </view>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <text class="text-sm font-semibold text-gray-800 block">你的实验记录</text>
        <view class="mt-3 grid grid-cols-2 gap-3">
          <view class="bg-white rounded-lg p-3">
            <text class="text-xs text-gray-500">总点击</text>
            <text class="text-base font-semibold text-gray-800 block mt-1">{{ stats.plays }}</text>
          </view>
          <view class="bg-white rounded-lg p-3">
            <text class="text-xs text-gray-500">完成任务</text>
            <text class="text-base font-semibold text-gray-800 block mt-1">{{ doneMissionsCount }}/{{ missions.length }}</text>
          </view>
        </view>

        <view class="mt-3 bg-white rounded-lg p-3">
          <text class="text-xs text-gray-500">连续打卡</text>
          <view class="flex items-center justify-between mt-1">
            <text class="text-base font-semibold text-gray-800">{{ stats.streak }} 天</text>
            <text class="text-xs text-gray-500">历史最高：{{ stats.bestStreak }} 天</text>
          </view>
        </view>

        <view class="mt-3 flex items-center justify-between">
          <button class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm" @tap="resetAll">
            清空本页记录
          </button>
          <text class="text-gray-400 text-xs">仅影响彩蛋页</text>
        </view>
      </view>

      <view class="mt-6 bg-gray-50 rounded-xl p-4">
        <text class="text-sm font-semibold text-gray-800 block">排行榜（本机）</text>
        <text class="text-gray-500 text-xs mt-1">基于你本地的彩蛋页记录统计。</text>

        <view class="mt-3 space-y-2">
          <view class="bg-white rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm text-gray-700">等级榜</text>
            <text class="text-sm font-semibold text-gray-800">Lv. {{ level }}</text>
          </view>
          <view class="bg-white rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm text-gray-700">连击榜</text>
            <text class="text-sm font-semibold text-gray-800">{{ stats.bestCombo }}</text>
          </view>
          <view class="bg-white rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm text-gray-700">挑战榜（10秒）</text>
            <text class="text-sm font-semibold text-gray-800">{{ stats.bestChallengeCount }}</text>
          </view>
          <view class="bg-white rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm text-gray-700">生成榜</text>
            <text class="text-sm font-semibold text-gray-800">{{ stats.dishesGenerated }}</text>
          </view>
          <view class="bg-white rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm text-gray-700">变异榜</text>
            <text class="text-sm font-semibold text-gray-800">{{ stats.mutations }}</text>
          </view>
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
import { onHide, onUnload } from '@dcloudio/uni-app'

function pickOne(list: string[]) {
  return list[Math.floor(Math.random() * list.length)]
}

type EggStats = {
  plays: number
  dishesGenerated: number
  mutations: number
  missions: Record<string, boolean>
  heat: number
  sweet: number
  salty: number
  oily: number
  xp: number
  coins: number
  streak: number
  lastDayKey: string
  titles: string[]
  equippedTitle: string
  bestCombo: number
  bestChallengeCount: number
  bestStreak: number
}

const STORAGE_KEY = 'TI_EASTER_EGG_STATE'

function loadStats(): EggStats {
  const raw = uni.getStorageSync(STORAGE_KEY)
  if (raw && typeof raw === 'object') {
    return {
      plays: Number((raw as any).plays ?? 0),
      dishesGenerated: Number((raw as any).dishesGenerated ?? 0),
      mutations: Number((raw as any).mutations ?? 0),
      missions: ((raw as any).missions && typeof (raw as any).missions === 'object') ? (raw as any).missions : {},
      heat: Number((raw as any).heat ?? 3),
      sweet: Number((raw as any).sweet ?? 2),
      salty: Number((raw as any).salty ?? 3),
      oily: Number((raw as any).oily ?? 2),
      xp: Number((raw as any).xp ?? 0),
      coins: Number((raw as any).coins ?? 0),
      streak: Number((raw as any).streak ?? 0),
      lastDayKey: String((raw as any).lastDayKey ?? ''),
      titles: Array.isArray((raw as any).titles) ? (raw as any).titles : [],
      equippedTitle: String((raw as any).equippedTitle ?? ''),
      bestCombo: Number((raw as any).bestCombo ?? 0),
      bestChallengeCount: Number((raw as any).bestChallengeCount ?? 0),
      bestStreak: Number((raw as any).bestStreak ?? 0),
    }
  }
  return {
    plays: 0,
    dishesGenerated: 0,
    mutations: 0,
    missions: {},
    heat: 3,
    sweet: 2,
    salty: 3,
    oily: 2,
    xp: 0,
    coins: 0,
    streak: 0,
    lastDayKey: '',
    titles: [],
    equippedTitle: '',
    bestCombo: 0,
    bestChallengeCount: 0,
    bestStreak: 0,
  }
}

function saveStats(next: EggStats) {
  uni.setStorageSync(STORAGE_KEY, next)
}

const fortune = ref('')
const dishName = ref('')
const dishTapCount = ref(0)

const showSecretHint = ref(false)

const todayKey = computed(() => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})

const missions = ref([
  { id: 'm1', text: '尝试一个你没去过的窗口' },
  { id: 'm2', text: '写一条“优点+建议”的认真评价' },
  { id: 'm3', text: '收藏一道你想二刷的菜' },
])

const stats = ref<EggStats>(loadStats())

const heat = ref(stats.value.heat)
const sweet = ref(stats.value.sweet)
const salty = ref(stats.value.salty)
const oily = ref(stats.value.oily)

const TITLE_COST = 3
const CHALLENGE_SECONDS = 10
const CHALLENGE_TARGET = 3
const CHALLENGE_REWARD_COINS = 5

const titlePool = [
  '食堂侦探',
  '窗口观察员',
  '重口狂热者',
  '清淡守望者',
  '甜辣双修',
  '快乐主义者',
  '均衡探索者',
  '早八幸存者',
  '夜宵研究员',
  '三秒决策王',
  '小份策略家',
  '咀嚼哲学家',
  '拍照先行者',
  '香气追踪者',
  '油光鉴定师',
  '辣度测绘员',
  '甜度守护者',
  '咸度管理员',
  '勇敢尝新者',
  '评价写作家',
  '收藏强迫症',
  '双拼信徒',
  '排队艺术家',
  '饭点时间学家',
  '冰饮搭配师',
]

function getLevelInfo(totalXp: number) {
  let level = 1
  let xp = Math.max(0, Math.floor(totalXp))

  const needFor = (lv: number) => 80 + (lv - 1) * 40

  while (xp >= needFor(level)) {
    xp -= needFor(level)
    level += 1
    if (level > 99) {
      level = 99
      xp = 0
      break
    }
  }

  return { level, xpInLevel: xp, xpToNext: needFor(level) }
}

const levelInfo = computed(() => getLevelInfo(stats.value.xp))
const level = computed(() => levelInfo.value.level)
const xpInLevel = computed(() => levelInfo.value.xpInLevel)
const xpToNext = computed(() => levelInfo.value.xpToNext)

function grant(rewardXp: number, rewardCoins: number, toast?: string) {
  const beforeLevel = level.value
  stats.value.xp += Math.max(0, Math.floor(rewardXp))
  stats.value.coins += Math.max(0, Math.floor(rewardCoins))
  saveStats(stats.value)

  const afterLevel = getLevelInfo(stats.value.xp).level
  if (afterLevel > beforeLevel) {
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort()
    uni.showToast({ title: `升级到 Lv.${afterLevel}`, icon: 'none' })
    return
  }

  if (toast) {
    uni.showToast({ title: toast, icon: 'none' })
  }
}

const didCheckInToday = ref(false)

function ensureDailyCheckin() {
  if (didCheckInToday.value) return
  bumpStreakIfNeeded()
  didCheckInToday.value = true
}

function bumpStreakIfNeeded() {
  const last = stats.value.lastDayKey
  const today = todayKey.value
  if (!last) {
    stats.value.streak = 1
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak)
    stats.value.lastDayKey = today
    grant(10, 2)
    return
  }
  if (last === today) return

  const lastDate = new Date(`${last}T00:00:00`)
  const todayDate = new Date(`${today}T00:00:00`)
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 1) {
    stats.value.streak += 1
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak)
    stats.value.lastDayKey = today
    grant(10 + Math.min(stats.value.streak, 7) * 2, 2)
    uni.showToast({ title: `连续打卡 ${stats.value.streak} 天`, icon: 'none' })
  } else {
    stats.value.streak = 1
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak)
    stats.value.lastDayKey = today
    grant(10, 2)
    uni.showToast({ title: '重新打卡：连胜重置', icon: 'none' })
  }
  saveStats(stats.value)
}

const inspiration = computed(() => {
  return stats.value.dishesGenerated % 10
})

const doneMissionsCount = computed(() => missions.value.filter(m => !!stats.value.missions[m.id]).length)

const currentTitle = computed(() => stats.value.equippedTitle || '（无）')
const previewTitles = computed(() => stats.value.titles.slice(0, 6))

const comboCount = ref(0)
const lastDishAt = ref(0)
const COMBO_GAP_MS = 4000
const comboHint = computed(() => {
  if (comboCount.value >= 2) return '继续连点提升奖励'
  return '快速连点可触发连击'
})

const challenge = ref({
  active: false,
  remaining: CHALLENGE_SECONDS,
  count: 0,
  target: CHALLENGE_TARGET,
})

let challengeTimer: ReturnType<typeof setInterval> | null = null

function stopChallengeTimer() {
  if (challengeTimer) {
    clearInterval(challengeTimer)
    challengeTimer = null
  }
}

function isMissionDone(id: string) {
  return !!stats.value.missions[id]
}

function toggleMission(id: string) {
  ensureDailyCheckin()
  stats.value.plays += 1
  stats.value.missions[id] = !stats.value.missions[id]
  saveStats(stats.value)

  grant(2, 0)

  if (doneMissionsCount.value === missions.value.length) {
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort()
    uni.showToast({ title: '成就已解锁', icon: 'none' })
    fortune.value = `成就签：你已完成今日任务，今天的快乐值+1！（顺手再夸一句自己很棒。）`
    grant(15, 3)
  }
}

const conclusion = computed(() => {
  const spicy = heat.value >= 7
  const sugary = sweet.value >= 7
  const saltyHigh = salty.value >= 7
  const oilyHigh = oily.value >= 7

  if (spicy && sugary) return '你是“甜辣双修”型：甜辣都能打，建议配一杯冰饮做缓冲。'
  if (spicy && saltyHigh) return '你是“重口爆发”型：今天适合挑战爆辣+重口，但记得多喝水。'
  if (sugary && oilyHigh) return '你是“快乐加倍”型：甜与油让人上头，建议小份多样不伤身。'
  if (heat.value <= 2 && sweet.value <= 2 && salty.value <= 2 && oily.value <= 2) return '你是“清淡派”型：原味、少油、少盐就是你的正义。'
  return '你是“均衡探索者”型：什么都能尝两口，但依旧保持理性。'
})

const title = computed(() => {
  const spicy = heat.value >= 7
  const sugary = sweet.value >= 7
  const saltyHigh = salty.value >= 7
  const oilyHigh = oily.value >= 7
  if (spicy && sugary) return '甜辣双修'
  if (spicy && saltyHigh) return '重口大师'
  if (sugary && oilyHigh) return '快乐主义者'
  if (heat.value <= 2 && sweet.value <= 2 && salty.value <= 2 && oily.value <= 2) return '清淡守望者'
  return '均衡探索者'
})

const suggestion = computed(() => {
  if (heat.value >= 7) return '冰饮/酸奶'
  if (oily.value >= 7) return '清爽蔬菜'
  if (salty.value >= 7) return '清汤/水果'
  if (sweet.value >= 7) return '无糖茶'
  return '随便配点'
})

function regenerate() {
  ensureDailyCheckin()
  stats.value.plays += 1
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
  grant(3, 0)
  saveStats(stats.value)
}

function nextDish() {
  ensureDailyCheckin()
  stats.value.plays += 1
  dishTapCount.value += 1
  stats.value.dishesGenerated += 1

  // 连击计算
  const now = Date.now()
  if (now - lastDishAt.value <= COMBO_GAP_MS) {
    comboCount.value = Math.min(comboCount.value + 1, 99)
  } else {
    comboCount.value = 1
  }
  lastDishAt.value = now
  if (comboCount.value > stats.value.bestCombo) stats.value.bestCombo = comboCount.value

  const style = pickOne(['反复横跳', '究极', '隐藏', '限时', '毕业', '熬夜', '早八', '社恐', '社牛'])
  const base = pickOne(['鸡腿', '牛肉', '豆腐', '茄子', '土豆', '虾仁', '西兰花', '蘑菇', '番茄', '培根'])
  const sauce = pickOne(['麻辣', '黑椒', '咖喱', '蒜香', '糖醋', '照烧', '椒盐', '酸汤', '番茄', '孜然'])
  const finish = pickOne(['盖饭', '拌面', '焗烤', '小火锅', '沙拉', '卷饼', '手抓', '双拼'])

  let extra = ''
  if (dishTapCount.value % 3 === 0) {
    extra = pickOne([' + 脆脆', ' + 爆浆', ' + 双倍芝士', ' + 冰火同锅', ' + 神秘配菜'])
    stats.value.mutations += 1
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort()
    grant(6, 1)
  }

  dishName.value = `${style}${sauce}${base}${finish}${extra}`

  // 连击奖励：最多叠到 +5xp
  const comboBonus = Math.min(Math.max(comboCount.value - 1, 0), 5)
  grant(4 + comboBonus, comboCount.value >= 5 ? 1 : 0)

  // 限时挑战进度
  if (challenge.value.active) {
    challenge.value.count += 1
    if (challenge.value.count > stats.value.bestChallengeCount) {
      stats.value.bestChallengeCount = challenge.value.count
    }
  }

  saveStats(stats.value)
}

function drawTitle() {
  ensureDailyCheckin()
  stats.value.plays += 1
  if (stats.value.coins < TITLE_COST) {
    uni.showToast({ title: '金币不够，先去生成几道菜', icon: 'none' })
    return
  }
  stats.value.coins -= TITLE_COST

  const drawn = pickOne(titlePool)
  const exists = stats.value.titles.includes(drawn)

  if (!exists) {
    stats.value.titles.unshift(drawn)
    stats.value.equippedTitle = drawn
    saveStats(stats.value)
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort()
    grant(10, 0, `获得称号：${drawn}`)
    return
  }

  // 重复卡：返还小额金币并给经验
  saveStats(stats.value)
  grant(6, 1, `重复称号：${drawn}（返还+1金币）`)
}

function equipRandomTitle() {
  ensureDailyCheckin()
  stats.value.plays += 1
  if (stats.value.titles.length === 0) {
    uni.showToast({ title: '你还没有称号', icon: 'none' })
    return
  }
  const t = pickOne(stats.value.titles)
  stats.value.equippedTitle = t
  saveStats(stats.value)
  grant(1, 0, '称号已更换')
}

function startChallenge() {
  ensureDailyCheckin()
  stats.value.plays += 1
  if (challenge.value.active) return

  challenge.value.active = true
  challenge.value.remaining = CHALLENGE_SECONDS
  challenge.value.target = CHALLENGE_TARGET
  challenge.value.count = 0
  saveStats(stats.value)

  stopChallengeTimer()
  challengeTimer = setInterval(() => {
    challenge.value.remaining -= 1
    if (challenge.value.remaining <= 0) {
      stopChallengeTimer()
      challenge.value.active = false

      if (challenge.value.count >= challenge.value.target) {
        grant(20, CHALLENGE_REWARD_COINS, '挑战成功 +金币')
        if (typeof uni.vibrateShort === 'function') uni.vibrateShort()
      } else {
        grant(3, 0, '挑战失败，再来一次')
      }
      saveStats(stats.value)
    }
  }, 1000)

  uni.showToast({ title: '挑战开始！快点生成！', icon: 'none' })
  saveStats(stats.value)
}

function copyDish() {
  const data = dishName.value || '（空）'
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' })
  })
}

function shareText() {
  const data = `【食鉴隐藏实验室】\n味觉签：${fortune.value || '（空）'}\n离谱菜名：${dishName.value || '（空）'}\n称号：${title.value}（辣${heat.value}/甜${sweet.value}/咸${salty.value}/油${oily.value}）`
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' })
  })
}

function copyFortune() {
  const data = fortune.value || '（空）'
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' })
  })
}

function onHeatChange(e: any) {
  ensureDailyCheckin()
  heat.value = Number(e?.detail?.value ?? heat.value)
  stats.value.heat = heat.value
  saveStats(stats.value)
  grant(1, 0)
}

function onSweetChange(e: any) {
  ensureDailyCheckin()
  sweet.value = Number(e?.detail?.value ?? sweet.value)
  stats.value.sweet = sweet.value
  saveStats(stats.value)
  grant(1, 0)
}

function onSaltyChange(e: any) {
  ensureDailyCheckin()
  salty.value = Number(e?.detail?.value ?? salty.value)
  stats.value.salty = salty.value
  saveStats(stats.value)
  grant(1, 0)
}

function onOilyChange(e: any) {
  ensureDailyCheckin()
  oily.value = Number(e?.detail?.value ?? oily.value)
  stats.value.oily = oily.value
  saveStats(stats.value)
  grant(1, 0)
}

function randomizeFlavor() {
  ensureDailyCheckin()
  stats.value.plays += 1
  heat.value = Math.floor(Math.random() * 11)
  sweet.value = Math.floor(Math.random() * 11)
  salty.value = Math.floor(Math.random() * 11)
  oily.value = Math.floor(Math.random() * 11)
  stats.value.heat = heat.value
  stats.value.sweet = sweet.value
  stats.value.salty = salty.value
  stats.value.oily = oily.value
  saveStats(stats.value)
  grant(5, 0, '参数已随机')
}

function resetAll() {
  uni.showModal({
    title: '清空记录',
    content: '将清空彩蛋页统计与任务状态，是否继续？',
    success: (res) => {
      if (!res.confirm) return
      stats.value = {
        plays: 0,
        dishesGenerated: 0,
        mutations: 0,
        missions: {},
        heat: 3,
        sweet: 2,
        salty: 3,
        oily: 2,
        xp: 0,
        coins: 0,
        streak: 0,
        lastDayKey: '',
        titles: [],
        equippedTitle: '',
        bestCombo: 0,
        bestChallengeCount: 0,
        bestStreak: 0,
      }
      didCheckInToday.value = false
      heat.value = 3
      sweet.value = 2
      salty.value = 3
      oily.value = 2
      comboCount.value = 0
      lastDishAt.value = 0
      stopChallengeTimer()
      challenge.value.active = false
      challenge.value.remaining = CHALLENGE_SECONDS
      challenge.value.count = 0
      challenge.value.target = CHALLENGE_TARGET
      saveStats(stats.value)
      initPreview()
      uni.showToast({ title: '已清空', icon: 'none' })
    }
  })
}

function toggleSecretHint() {
  showSecretHint.value = !showSecretHint.value
}

// 生命周期：离开页面时清理定时器
onHide(() => {
  stopChallengeTimer()
})

onUnload(() => {
  stopChallengeTimer()
})

function generateFortunePreview() {
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

function generateDishPreview() {
  const style = pickOne(['反复横跳', '究极', '隐藏', '限时', '毕业', '熬夜', '早八', '社恐', '社牛'])
  const base = pickOne(['鸡腿', '牛肉', '豆腐', '茄子', '土豆', '虾仁', '西兰花', '蘑菇', '番茄', '培根'])
  const sauce = pickOne(['麻辣', '黑椒', '咖喱', '蒜香', '糖醋', '照烧', '椒盐', '酸汤', '番茄', '孜然'])
  const finish = pickOne(['盖饭', '拌面', '焗烤', '小火锅', '沙拉', '卷饼', '手抓', '双拼'])
  dishName.value = `${style}${sauce}${base}${finish}`
}

function initPreview() {
  generateFortunePreview()
  generateDishPreview()
}

initPreview()
</script>
