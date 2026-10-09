<template>
  <view class="page-content egg-page" :class="{ 'egg-dark': isDarkMode }">
    <view v-if="isSnowing" class="snow-container" aria-hidden="true">
      <view
        v-for="flake in flakes"
        :key="flake.id"
        class="snowflake"
        :style="{
          left: flake.left + '%',
          fontSize: flake.size + 'px',
          animationDuration: flake.duration + 's',
          animationDelay: flake.delay + 's',
          opacity: flake.opacity,
        }"
        >❄</view
      >
    </view>

    <view class="egg-content">
      <view class="egg-header">
        <text class="egg-title">食鉴 · 隐藏实验室</text>
        <text class="egg-muted">你发现了一个不太正经的味觉分支。</text>
        <button
          class="egg-button egg-text-button"
          :aria-expanded="showSecretHint"
          @tap="toggleSecretHint"
        >
          玩法提示
        </button>
        <text v-if="showSecretHint" class="egg-note"
          >每生成 3 道菜会触发一次变异，快速连点还能获得连击奖励。</text
        >
        <view class="egg-appearance">
          <view class="egg-toggle"
            ><text>夜间模式</text
            ><switch
              :checked="isDarkMode"
              color="#660874"
              aria-label="夜间模式"
              @change="toggleDarkMode"
          /></view>
          <view class="egg-toggle"
            ><text>降雪效果</text
            ><switch
              :checked="isSnowing"
              color="#660874"
              aria-label="降雪效果"
              @change="toggleSnow"
          /></view>
        </view>
      </view>

      <view class="egg-section egg-level">
        <view class="egg-row"
          ><text class="egg-heading">实验员 Lv. {{ level }}</text
          ><text class="egg-muted">{{ stats.coins }} 金币</text></view
        >
        <view
          class="egg-progress"
          role="progressbar"
          :aria-valuenow="xpInLevel"
          :aria-valuemax="xpToNext"
          aria-label="实验员经验"
          ><view :style="{ width: (xpInLevel / xpToNext) * 100 + '%' }"
        /></view>
        <text class="egg-muted">经验 {{ xpInLevel }} / {{ xpToNext }}</text>
      </view>

      <view class="egg-section egg-generator">
        <text class="egg-heading">离谱菜名生成器</text>
        <text class="egg-dish-name" aria-live="polite">{{ dishName }}</text>
        <view class="egg-row egg-wrap"
          ><text class="egg-muted"
            >连击 {{ comboCount }}{{ comboCount >= 2 ? ' · 奖励加成' : '' }}</text
          ><text class="egg-muted">灵感 {{ inspiration }} / 10</text></view
        >
        <text class="egg-muted egg-combo-hint">{{ comboHint }}，每 3 次生成触发变异。</text>

        <view class="egg-challenge">
          <view class="egg-row egg-wrap"
            ><text class="egg-subheading">10 秒连抽挑战</text
            ><text class="egg-muted">{{ challenge.count }} / {{ challenge.target }} 道</text></view
          >
          <text class="egg-muted"
            >10 秒内生成 {{ challenge.target }} 道菜，成功奖励
            {{ CHALLENGE_REWARD_COINS }} 金币。</text
          >
          <view
            class="egg-progress egg-challenge-progress"
            role="progressbar"
            aria-label="挑战进度"
            :aria-valuenow="challenge.count"
            :aria-valuemax="challenge.target"
            ><view
              :style="{ width: Math.min((challenge.count / challenge.target) * 100, 100) + '%' }"
          /></view>
          <text
            v-if="challengeFeedback"
            class="egg-challenge-feedback egg-muted"
            aria-live="polite"
            >{{ challengeFeedback }}</text
          >
        </view>
        <view class="egg-play-actions">
          <button class="egg-button egg-primary" data-action="generate" @tap="nextDish">
            生成一道菜
          </button>
          <button
            class="egg-button egg-outline"
            data-action="challenge"
            :disabled="challenge.active"
            @tap="startChallenge"
          >
            {{ challenge.active ? '剩余 ' + challenge.remaining + ' 秒' : '开始挑战' }}
          </button>
        </view>
        <view class="egg-actions egg-copy-actions"
          ><button class="egg-button" @tap="copyDish">复制菜名</button
          ><button class="egg-button" @tap="shareText">复制今日组合</button></view
        >
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">今日味觉签</text
          ><text class="egg-muted">{{ todayKey }}</text></view
        >
        <text class="egg-prose egg-fortune" aria-live="polite">{{ fortune }}</text>
        <view class="egg-actions"
          ><button class="egg-button egg-outline" @tap="regenerate">再来一签</button
          ><button class="egg-button" @tap="copyFortune">复制</button></view
        >
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">今日任务</text
          ><text class="egg-muted">{{ doneMissionsCount }} / {{ missions.length }} 完成</text></view
        >
        <text class="egg-muted">点亮就算完成，全部完成可解锁一条成就签。</text>
        <view class="egg-missions">
          <button
            v-for="mission in missions"
            :key="mission.id"
            class="egg-mission"
            :class="{ 'egg-mission-done': isMissionDone(mission.id) }"
            role="checkbox"
            :aria-checked="isMissionDone(mission.id)"
            @tap="toggleMission(mission.id)"
          >
            <text class="egg-mission-label">{{ mission.text }}</text
            ><text class="egg-mission-status">{{
              isMissionDone(mission.id) ? '已完成' : '未完成'
            }}</text>
          </button>
        </view>
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">称号抽卡</text
          ><text class="egg-muted">已收藏 {{ stats.titles.length }}</text></view
        >
        <text class="egg-muted">纯属娱乐 · 当前称号</text>
        <text class="egg-current-title">{{ currentTitle }}</text>
        <view class="egg-actions"
          ><button class="egg-button egg-outline" @tap="drawTitle">
            抽一张 · {{ TITLE_COST }} 金币</button
          ><button class="egg-button" @tap="equipRandomTitle">随机换称号</button></view
        >
        <view v-if="previewTitles.length" class="egg-badges"
          ><text v-for="item in previewTitles" :key="item" class="egg-badge">{{ item }}</text></view
        >
        <text v-else class="egg-muted egg-empty">先抽一张试试</text>
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">味觉参数</text
          ><button class="egg-button egg-text-button" @tap="randomizeFlavor">随机一下</button></view
        >
        <text class="egg-muted">纯属娱乐，不会修改你的饮食偏好。</text>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>辣度</text><text class="egg-muted">{{ heat }} / 10</text></view
          ><slider
            :value="heat"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            aria-label="辣度"
            @change="onHeatChange"
        /></view>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>甜度</text><text class="egg-muted">{{ sweet }} / 10</text></view
          ><slider
            :value="sweet"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            aria-label="甜度"
            @change="onSweetChange"
        /></view>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>咸度</text><text class="egg-muted">{{ salty }} / 10</text></view
          ><slider
            :value="salty"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            aria-label="咸度"
            @change="onSaltyChange"
        /></view>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>油腻度</text><text class="egg-muted">{{ oily }} / 10</text></view
          ><slider
            :value="oily"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            aria-label="油腻度"
            @change="onOilyChange"
        /></view>
        <view class="egg-conclusion"
          ><text class="egg-prose">{{ conclusion }}</text
          ><view class="egg-row egg-wrap"
            ><text class="egg-muted">称号：{{ title }}</text
            ><text class="egg-muted">建议：{{ suggestion }}</text></view
          ></view
        >
      </view>

      <view class="egg-section">
        <text class="egg-heading">实验记录与本机榜单</text>
        <text class="egg-muted">仅根据本机的彩蛋页记录统计。</text>
        <view class="egg-records">
          <view class="egg-record"
            ><text>等级榜</text><text>Lv. {{ level }}</text></view
          >
          <view class="egg-record"
            ><text>生成榜</text><text>{{ stats.dishesGenerated }} 道</text></view
          >
          <view class="egg-record"
            ><text>变异榜</text><text>{{ stats.mutations }} 次</text></view
          >
          <view class="egg-record"
            ><text>连击最高</text><text>{{ stats.bestCombo }}</text></view
          >
          <view class="egg-record"
            ><text>挑战最佳 · 10 秒</text><text>{{ stats.bestChallengeCount }} 道</text></view
          >
          <view class="egg-record"
            ><text>总点击</text><text>{{ stats.plays }}</text></view
          >
          <view class="egg-record"
            ><text>连续打卡</text><text>{{ stats.streak }} 天</text></view
          >
          <view class="egg-record"
            ><text>连续打卡最高</text><text>{{ stats.bestStreak }} 天</text></view
          >
        </view>
        <view class="egg-actions"
          ><button class="egg-button egg-reset" @tap="resetAll">清空本页记录</button
          ><text class="egg-muted">仅影响彩蛋页</text></view
        >
      </view>
      <text class="egg-muted egg-footer">这个页面不会出现在任何菜单里。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onHide, onUnload } from '@dcloudio/uni-app';

function pickOne(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

type EggStats = {
  plays: number;
  dishesGenerated: number;
  mutations: number;
  missions: Record<string, boolean>;
  heat: number;
  sweet: number;
  salty: number;
  oily: number;
  xp: number;
  coins: number;
  streak: number;
  lastDayKey: string;
  titles: string[];
  equippedTitle: string;
  bestCombo: number;
  bestChallengeCount: number;
  bestStreak: number;
  isDarkMode: boolean;
  isSnowing: boolean;
};

const STORAGE_KEY = 'TI_EASTER_EGG_STATE';

function loadStats(): EggStats {
  const raw = uni.getStorageSync(STORAGE_KEY);
  if (raw && typeof raw === 'object') {
    return {
      plays: Number((raw as any).plays ?? 0),
      dishesGenerated: Number((raw as any).dishesGenerated ?? 0),
      mutations: Number((raw as any).mutations ?? 0),
      missions:
        (raw as any).missions && typeof (raw as any).missions === 'object'
          ? (raw as any).missions
          : {},
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
      isDarkMode: Boolean((raw as any).isDarkMode ?? false),
      isSnowing: Boolean((raw as any).isSnowing ?? false),
    };
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
    isDarkMode: false,
    isSnowing: false,
  };
}

function saveStats(next: EggStats) {
  uni.setStorageSync(STORAGE_KEY, next);
}

const fortune = ref('');
const dishName = ref('');
const dishTapCount = ref(0);

const showSecretHint = ref(false);

const todayKey = computed(() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
});

const missions = ref([
  { id: 'm1', text: '尝试一个你没去过的窗口' },
  { id: 'm2', text: '写一条“优点+建议”的认真评价' },
  { id: 'm3', text: '收藏一道你想二刷的菜' },
  { id: 'm4', text: '给一道菜拍张好看的照片并收藏' },
  { id: 'm5', text: '点一次你通常不会点的配菜' },
  { id: 'm6', text: '尝试一个口味更重的辣度' },
  { id: 'm7', text: '把你喜欢的菜分享给一个朋友' },
  { id: 'm8', text: '写一条鼓励店员的小评论' },
]);

const stats = ref<EggStats>(loadStats());

const isDarkMode = ref(stats.value.isDarkMode);

const isSnowing = ref(stats.value.isSnowing);
const flakes = ref<
  Array<{
    id: number;
    left: number;
    size: number;
    duration: number;
    delay: number;
    opacity: number;
  }>
>([]);
let snowId = 0;

function generateFlakes(count = 12) {
  flakes.value = [];
  for (let i = 0; i < count; i++) {
    flakes.value.push({
      id: ++snowId,
      left: Math.random() * 100,
      size: Math.floor(Math.random() * 18) + 10,
      duration: Math.random() * 6 + 4,
      delay: Math.random() * 5,
      opacity: 0.6 + Math.random() * 0.4,
    });
  }
}

function clearFlakes() {
  flakes.value = [];
}

function toggleSnow(e: any) {
  isSnowing.value = Boolean(e?.detail?.value);
  stats.value.isSnowing = isSnowing.value;
  saveStats(stats.value);
  if (isSnowing.value) generateFlakes(14);
  else clearFlakes();
}

const heat = ref(stats.value.heat);
const sweet = ref(stats.value.sweet);
const salty = ref(stats.value.salty);
const oily = ref(stats.value.oily);

const TITLE_COST = 3;
const CHALLENGE_SECONDS = 10;
const CHALLENGE_TARGET = 3;
const CHALLENGE_REWARD_COINS = 5;

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
  // new additions
  '微辣勇者',
  '咸香鉴赏家',
  '汤头测试员',
  '咖喱守望者',
  '甜品鉴定师',
  '素食实践家',
  '夜宵行者',
  '早八侦查员',
  '口味调研员',
  '分量计算师',
  '排队策略家',
  '回锅菜艺术家',
  '咀嚼节奏师',
];

function getLevelInfo(totalXp: number) {
  let level = 1;
  let xp = Math.max(0, Math.floor(totalXp));

  const needFor = (lv: number) => 80 + (lv - 1) * 40;

  while (xp >= needFor(level)) {
    xp -= needFor(level);
    level += 1;
    if (level > 99) {
      level = 99;
      xp = 0;
      break;
    }
  }

  return { level, xpInLevel: xp, xpToNext: needFor(level) };
}

const levelInfo = computed(() => getLevelInfo(stats.value.xp));
const level = computed(() => levelInfo.value.level);
const xpInLevel = computed(() => levelInfo.value.xpInLevel);
const xpToNext = computed(() => levelInfo.value.xpToNext);

function grant(rewardXp: number, rewardCoins: number, toast?: string) {
  const beforeLevel = level.value;
  stats.value.xp += Math.max(0, Math.floor(rewardXp));
  stats.value.coins += Math.max(0, Math.floor(rewardCoins));
  saveStats(stats.value);

  const afterLevel = getLevelInfo(stats.value.xp).level;
  if (afterLevel > beforeLevel) {
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
    uni.showToast({ title: `升级到 Lv.${afterLevel}`, icon: 'none' });
    return;
  }

  if (toast) {
    uni.showToast({ title: toast, icon: 'none' });
  }
}

const didCheckInToday = ref(false);

function ensureDailyCheckin() {
  if (didCheckInToday.value) return;
  bumpStreakIfNeeded();
  didCheckInToday.value = true;
}

function bumpStreakIfNeeded() {
  const last = stats.value.lastDayKey;
  const today = todayKey.value;
  if (!last) {
    stats.value.streak = 1;
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak);
    stats.value.lastDayKey = today;
    grant(10, 2);
    return;
  }
  if (last === today) return;

  const lastDate = new Date(`${last}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) {
    stats.value.streak += 1;
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak);
    stats.value.lastDayKey = today;
    grant(10 + Math.min(stats.value.streak, 7) * 2, 2);
    uni.showToast({ title: `连续打卡 ${stats.value.streak} 天`, icon: 'none' });
  } else {
    stats.value.streak = 1;
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak);
    stats.value.lastDayKey = today;
    grant(10, 2);
    uni.showToast({ title: '重新打卡：连胜重置', icon: 'none' });
  }
  saveStats(stats.value);
}

const inspiration = computed(() => {
  return stats.value.dishesGenerated % 10;
});

const doneMissionsCount = computed(
  () => missions.value.filter(m => !!stats.value.missions[m.id]).length
);

const currentTitle = computed(() => stats.value.equippedTitle || '（无）');
const previewTitles = computed(() => stats.value.titles.slice(0, 6));

const comboCount = ref(0);
const lastDishAt = ref(0);
const COMBO_GAP_MS = 4000;
const comboHint = computed(() => {
  if (comboCount.value >= 2) return '继续连点提升奖励';
  return '快速连点可触发连击';
});

const challengeFeedback = ref('');
const challenge = ref({
  active: false,
  remaining: CHALLENGE_SECONDS,
  count: 0,
  target: CHALLENGE_TARGET,
});

let challengeTimer: ReturnType<typeof setInterval> | null = null;
let challengeRound = 0;

function stopChallengeTimer() {
  challengeRound += 1;
  if (challengeTimer !== null) {
    clearInterval(challengeTimer);
    challengeTimer = null;
  }
}

function cancelChallenge() {
  stopChallengeTimer();
  if (!challenge.value.active) return;
  challenge.value.active = false;
  challenge.value.remaining = CHALLENGE_SECONDS;
  challenge.value.count = 0;
  challengeFeedback.value = '本轮挑战已取消，可以重新开始。';
}

function isMissionDone(id: string) {
  return !!stats.value.missions[id];
}

function toggleMission(id: string) {
  ensureDailyCheckin();
  stats.value.plays += 1;
  stats.value.missions[id] = !stats.value.missions[id];
  saveStats(stats.value);

  grant(2, 0);

  if (doneMissionsCount.value === missions.value.length) {
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
    uni.showToast({ title: '成就已解锁', icon: 'none' });
    fortune.value = `成就签：你已完成今日任务，今天的快乐值+1！（顺手再夸一句自己很棒。）`;
    grant(15, 3);
  }
}

const conclusion = computed(() => {
  const spicy = heat.value >= 7;
  const sugary = sweet.value >= 7;
  const saltyHigh = salty.value >= 7;
  const oilyHigh = oily.value >= 7;

  if (spicy && sugary) return '你是“甜辣双修”型：甜辣都能打，建议配一杯冰饮做缓冲。';
  if (spicy && saltyHigh) return '你是“重口爆发”型：今天适合挑战爆辣+重口，但记得多喝水。';
  if (sugary && oilyHigh) return '你是“快乐加倍”型：甜与油让人上头，建议小份多样不伤身。';
  if (heat.value <= 2 && sweet.value <= 2 && salty.value <= 2 && oily.value <= 2)
    return '你是“清淡派”型：原味、少油、少盐就是你的正义。';
  return '你是“均衡探索者”型：什么都能尝两口，但依旧保持理性。';
});

const title = computed(() => {
  const spicy = heat.value >= 7;
  const sugary = sweet.value >= 7;
  const saltyHigh = salty.value >= 7;
  const oilyHigh = oily.value >= 7;
  if (spicy && sugary) return '甜辣双修';
  if (spicy && saltyHigh) return '重口大师';
  if (sugary && oilyHigh) return '快乐主义者';
  if (heat.value <= 2 && sweet.value <= 2 && salty.value <= 2 && oily.value <= 2)
    return '清淡守望者';
  return '均衡探索者';
});

const suggestion = computed(() => {
  if (heat.value >= 7) return '冰饮/酸奶';
  if (oily.value >= 7) return '清爽蔬菜';
  if (salty.value >= 7) return '清汤/水果';
  if (sweet.value >= 7) return '无糖茶';
  return '随便配点';
});

function regenerate() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  const opener = pickOne([
    '今日宜：',
    '食鉴提示：',
    '味觉密语：',
    '隐藏建议：',
    '本日尝鲜：',
    '偷偷推荐：',
    '今日小贴士：',
  ]);
  const action = pickOne([
    '去一个你没去过的窗口点招牌菜。',
    '把“想吃”交给直觉，不看评价先尝一口。',
    '给一条认真评价：一句优点 + 一句建议。',
    '尝试把主食换成另一种选择，看看饱腹感差异。',
    '和朋友交换一口菜：共享信息密度最高。',
    '点一道素菜，审视配菜的层次。',
    '把辣度加一档，试试你的极限。',
    '去试试店里的季节限定/新品。',
    '尝试店家的隐秘推荐（菜单外的小菜）。',
    '把配料换成另一种吃法，体验新口感。',
  ]);
  const twist = pickOne([
    '（若遇到难吃：请把它写进食鉴，拯救后人。）',
    '（若遇到惊喜：收藏它，别让它消失。）',
    '（若纠结：点小份，降低决策成本。）',
    '（若犹豫：先拍照，证据最重要。）',
    '（试试蘸点醋/辣油，或许别有洞天。）',
    '（给店家一个五星并写下你最喜欢的一点。）',
  ]);
  fortune.value = `${opener}${action}${twist}`;
  grant(3, 0);
  saveStats(stats.value);
}

function nextDish() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  dishTapCount.value += 1;
  stats.value.dishesGenerated += 1;

  // 连击计算
  const now = Date.now();
  if (now - lastDishAt.value <= COMBO_GAP_MS) {
    comboCount.value = Math.min(comboCount.value + 1, 99);
  } else {
    comboCount.value = 1;
  }
  lastDishAt.value = now;
  if (comboCount.value > stats.value.bestCombo) stats.value.bestCombo = comboCount.value;

  const style = pickOne([
    '反复横跳',
    '究极',
    '隐藏',
    '限时',
    '毕业',
    '熬夜',
    '早八',
    '社恐',
    '社牛',
    '秘密配方',
    '豪华版',
    '极简派',
    '怀旧风',
  ]);
  const base = pickOne([
    '鸡腿',
    '牛肉',
    '豆腐',
    '茄子',
    '土豆',
    '虾仁',
    '西兰花',
    '蘑菇',
    '番茄',
    '培根',
    '牛排',
    '猪肉',
    '鸡胸',
    '玉米',
    '豆皮',
  ]);
  const sauce = pickOne([
    '麻辣',
    '黑椒',
    '咖喱',
    '蒜香',
    '糖醋',
    '照烧',
    '椒盐',
    '酸汤',
    '番茄',
    '孜然',
    '芝士',
    '奶油',
    '孜然辣酱',
  ]);
  const finish = pickOne([
    '盖饭',
    '拌面',
    '焗烤',
    '小火锅',
    '沙拉',
    '卷饼',
    '手抓',
    '双拼',
    '捞面',
    '煲仔',
    '盖浇饭',
  ]);

  let extra = '';
  if (dishTapCount.value % 3 === 0) {
    extra = pickOne([
      ' + 脆脆',
      ' + 爆浆',
      ' + 双倍芝士',
      ' + 冰火同锅',
      ' + 神秘配菜',
      ' + 芝士脆片',
      ' + 焦糖',
      ' + 泡菜',
    ]);
    stats.value.mutations += 1;
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
    grant(6, 1);
  }

  dishName.value = `${style}${sauce}${base}${finish}${extra}`;

  // 连击奖励：最多叠到 +5xp
  const comboBonus = Math.min(Math.max(comboCount.value - 1, 0), 5);
  grant(4 + comboBonus, comboCount.value >= 5 ? 1 : 0);

  // 限时挑战进度
  if (challenge.value.active) {
    challenge.value.count += 1;
    if (challenge.value.count > stats.value.bestChallengeCount) {
      stats.value.bestChallengeCount = challenge.value.count;
    }
  }

  saveStats(stats.value);
}

function drawTitle() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  if (stats.value.coins < TITLE_COST) {
    uni.showToast({ title: '金币不够，先去生成几道菜', icon: 'none' });
    return;
  }
  stats.value.coins -= TITLE_COST;

  const drawn = pickOne(titlePool);
  const exists = stats.value.titles.includes(drawn);

  if (!exists) {
    stats.value.titles.unshift(drawn);
    stats.value.equippedTitle = drawn;
    saveStats(stats.value);
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
    grant(10, 0, `获得称号：${drawn}`);
    return;
  }

  // 重复卡：返还小额金币并给经验
  saveStats(stats.value);
  grant(6, 1, `重复称号：${drawn}（返还+1金币）`);
}

function equipRandomTitle() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  if (stats.value.titles.length === 0) {
    uni.showToast({ title: '你还没有称号', icon: 'none' });
    return;
  }
  const t = pickOne(stats.value.titles);
  stats.value.equippedTitle = t;
  saveStats(stats.value);
  grant(1, 0, '称号已更换');
}

function startChallenge() {
  if (challenge.value.active) return;
  ensureDailyCheckin();
  stats.value.plays += 1;
  challengeFeedback.value = '';

  challenge.value.active = true;
  challenge.value.remaining = CHALLENGE_SECONDS;
  challenge.value.target = CHALLENGE_TARGET;
  challenge.value.count = 0;
  saveStats(stats.value);

  stopChallengeTimer();
  const round = challengeRound;
  challengeTimer = setInterval(() => {
    if (round !== challengeRound || !challenge.value.active) return;
    challenge.value.remaining -= 1;
    if (challenge.value.remaining <= 0) {
      stopChallengeTimer();
      challenge.value.active = false;

      if (challenge.value.count >= challenge.value.target) {
        challengeFeedback.value = `挑战成功，获得 ${CHALLENGE_REWARD_COINS} 金币。`;
        grant(20, CHALLENGE_REWARD_COINS, '挑战成功 +金币');
        if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
      } else {
        challengeFeedback.value = '本轮未达到目标，再试一次。';
        grant(3, 0, '挑战失败，再来一次');
      }
      saveStats(stats.value);
    }
  }, 1000);

  uni.showToast({ title: '挑战开始！快点生成！', icon: 'none' });
  saveStats(stats.value);
}

function copyDish() {
  const data = dishName.value || '（空）';
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  });
}

function shareText() {
  const data = `【食鉴隐藏实验室】\n味觉签：${fortune.value || '（空）'}\n离谱菜名：${dishName.value || '（空）'}\n称号：${title.value}（辣${heat.value}/甜${sweet.value}/咸${salty.value}/油${oily.value}）`;
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  });
}

function copyFortune() {
  const data = fortune.value || '（空）';
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  });
}

function onHeatChange(e: any) {
  ensureDailyCheckin();
  heat.value = Number(e?.detail?.value ?? heat.value);
  stats.value.heat = heat.value;
  saveStats(stats.value);
  grant(1, 0);
}

function onSweetChange(e: any) {
  ensureDailyCheckin();
  sweet.value = Number(e?.detail?.value ?? sweet.value);
  stats.value.sweet = sweet.value;
  saveStats(stats.value);
  grant(1, 0);
}

function onSaltyChange(e: any) {
  ensureDailyCheckin();
  salty.value = Number(e?.detail?.value ?? salty.value);
  stats.value.salty = salty.value;
  saveStats(stats.value);
  grant(1, 0);
}

function onOilyChange(e: any) {
  ensureDailyCheckin();
  oily.value = Number(e?.detail?.value ?? oily.value);
  stats.value.oily = oily.value;
  saveStats(stats.value);
  grant(1, 0);
}

function randomizeFlavor() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  heat.value = Math.floor(Math.random() * 11);
  sweet.value = Math.floor(Math.random() * 11);
  salty.value = Math.floor(Math.random() * 11);
  oily.value = Math.floor(Math.random() * 11);
  stats.value.heat = heat.value;
  stats.value.sweet = sweet.value;
  stats.value.salty = salty.value;
  stats.value.oily = oily.value;
  saveStats(stats.value);
  grant(5, 0, '参数已随机');
}

function resetAll() {
  uni.showModal({
    title: '清空记录',
    content: '将清空彩蛋页统计与任务状态，是否继续？',
    success: res => {
      if (!res.confirm) return;
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
        isDarkMode: false,
        isSnowing: false,
      };
      didCheckInToday.value = false;
      isDarkMode.value = false;
      isSnowing.value = false;
      dishTapCount.value = 0;
      challengeFeedback.value = '';
      clearFlakes();
      heat.value = 3;
      sweet.value = 2;
      salty.value = 3;
      oily.value = 2;
      comboCount.value = 0;
      lastDishAt.value = 0;
      stopChallengeTimer();
      challenge.value.active = false;
      challenge.value.remaining = CHALLENGE_SECONDS;
      challenge.value.count = 0;
      challenge.value.target = CHALLENGE_TARGET;
      saveStats(stats.value);
      initPreview();
      uni.showToast({ title: '已清空', icon: 'none' });
    },
  });
}

function toggleSecretHint() {
  showSecretHint.value = !showSecretHint.value;
}

function toggleDarkMode(e: any) {
  isDarkMode.value = Boolean(e?.detail?.value);
  stats.value.isDarkMode = isDarkMode.value;
  saveStats(stats.value);
}

onHide(cancelChallenge);
onUnload(cancelChallenge);

function generateFortunePreview() {
  const opener = pickOne([
    '今日宜：',
    '食鉴提示：',
    '味觉密语：',
    '隐藏建议：',
    '本日尝鲜：',
    '偷偷推荐：',
    '今日小贴士：',
  ]);
  const action = pickOne([
    '去一个你没去过的窗口点招牌菜。',
    '把“想吃”交给直觉，不看评价先尝一口。',
    '给一条认真评价：一句优点 + 一句建议。',
    '尝试把主食换成另一种选择，看看饱腹感差异。',
    '和朋友交换一口菜：共享信息密度最高。',
    '点一道素菜，审视配菜的层次。',
    '把辣度加一档，试试你的极限。',
    '去试试店里的季节限定/新品。',
    '尝试店家的隐秘推荐（菜单外的小菜）。',
    '把配料换成另一种吃法，体验新口感。',
  ]);
  const twist = pickOne([
    '（若遇到难吃：请把它写进食鉴，拯救后人。）',
    '（若遇到惊喜：收藏它，别让它消失。）',
    '（若纠结：点小份，降低决策成本。）',
    '（若犹豫：先拍照，证据最重要。）',
    '（试试蘸点醋/辣油，或许别有洞天。）',
    '（给店家一个五星并写下你最喜欢的一点。）',
  ]);
  fortune.value = `${opener}${action}${twist}`;
}

function generateDishPreview() {
  const style = pickOne([
    '反复横跳',
    '究极',
    '隐藏',
    '限时',
    '毕业',
    '熬夜',
    '早八',
    '社恐',
    '社牛',
    '秘密配方',
    '豪华版',
    '极简派',
    '怀旧风',
  ]);
  const base = pickOne([
    '鸡腿',
    '牛肉',
    '豆腐',
    '茄子',
    '土豆',
    '虾仁',
    '西兰花',
    '蘑菇',
    '番茄',
    '培根',
    '牛排',
    '猪肉',
    '鸡胸',
    '玉米',
    '豆皮',
  ]);
  const sauce = pickOne([
    '麻辣',
    '黑椒',
    '咖喱',
    '蒜香',
    '糖醋',
    '照烧',
    '椒盐',
    '酸汤',
    '番茄',
    '孜然',
    '芝士',
    '奶油',
    '孜然辣酱',
  ]);
  const finish = pickOne([
    '盖饭',
    '拌面',
    '焗烤',
    '小火锅',
    '沙拉',
    '卷饼',
    '手抓',
    '双拼',
    '捞面',
    '煲仔',
    '盖浇饭',
  ]);
  dishName.value = `${style}${sauce}${base}${finish}`;
}

function initPreview() {
  generateFortunePreview();
  generateDishPreview();
}

initPreview();

if (isSnowing.value) generateFlakes(14);
</script>

<style scoped>
.egg-page {
  --egg-bg: #fff;
  --egg-surface: #f4f4f5;
  --egg-text: #1f2937;
  --egg-muted: #667085;
  --egg-border: #e5e7eb;
  --egg-accent: #660874;
  --egg-progress: #667085;
  --egg-snow: #98a2b3;
  background: var(--egg-bg);
  color: var(--egg-text);
  font-family: system-ui, sans-serif;
}
.egg-dark {
  --egg-bg: #161b22;
  --egg-surface: #252c35;
  --egg-text: #f3f4f6;
  --egg-muted: #bdc4ce;
  --egg-border: #394251;
  --egg-accent: #d3a0dc;
  --egg-progress: #bdc4ce;
  --egg-snow: #fff;
}
.egg-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 20px calc(32px + env(safe-area-inset-bottom));
}
.egg-header {
  margin-bottom: 24px;
}
.egg-title {
  display: block;
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.4;
}
.egg-muted {
  display: block;
  color: var(--egg-muted);
  font-size: 13px;
  line-height: 1.65;
}
.egg-note {
  display: block;
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--egg-surface);
  color: var(--egg-text);
  font-size: 14px;
  line-height: 1.65;
}
.egg-section {
  padding: 24px 0;
  border-top: 1px solid var(--egg-border);
}
.egg-heading {
  display: block;
  font-size: 17px;
  font-weight: 650;
  line-height: 1.5;
}
.egg-subheading {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}
.egg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.egg-wrap {
  flex-wrap: wrap;
}
.egg-appearance {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-top: 8px;
}
.egg-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  font-size: 14px;
}
.egg-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--egg-border);
  border-radius: 10px;
  background: var(--egg-bg);
  color: var(--egg-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
}
.egg-button::after,
.egg-mission::after {
  border: 0;
}
.egg-button:active,
.egg-mission:active {
  background: var(--egg-surface);
}
.egg-button:focus-visible,
.egg-mission:focus-visible {
  outline: 2px solid var(--egg-accent);
  outline-offset: 3px;
}
.egg-button[disabled] {
  background: var(--egg-surface);
  color: var(--egg-muted);
  border-color: var(--egg-border);
}
.egg-primary {
  border-color: #660874;
  background: #660874;
  color: #fff;
  font-weight: 600;
}
.egg-primary:active {
  background: #51065d;
}
.egg-outline {
  border-color: var(--egg-accent);
  color: var(--egg-accent);
}
.egg-text-button {
  padding: 8px 0;
  border: 0;
  color: var(--egg-accent);
}
.egg-progress {
  height: 6px;
  margin: 12px 0 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--egg-surface);
}
.egg-progress > view {
  height: 100%;
  background: var(--egg-progress);
  border-radius: inherit;
}
.egg-dish-name {
  display: block;
  margin: 16px 0;
  padding: 16px;
  border-radius: 10px;
  background: var(--egg-surface);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.egg-combo-hint {
  margin-top: 4px;
}
.egg-challenge {
  margin-top: 20px;
}
.egg-challenge > .egg-muted {
  margin-top: 4px;
}
.egg-challenge-progress > view {
  background: var(--egg-accent);
}
.egg-play-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.egg-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
.egg-copy-actions .egg-button {
  flex: 1;
}
.egg-prose {
  display: block;
  font-size: 16px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.egg-fortune {
  margin-top: 12px;
}
.egg-missions {
  margin-top: 16px;
}
.egg-mission {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  margin: 0;
  padding: 12px 0;
  border: 0;
  border-bottom: 1px solid var(--egg-border);
  border-radius: 0;
  background: transparent;
  color: var(--egg-text);
  text-align: left;
  font-size: 15px;
  line-height: 1.6;
}
.egg-mission:last-child {
  border-bottom: 0;
}
.egg-mission-label {
  flex: 1;
  min-width: 0;
}
.egg-mission-status {
  flex-shrink: 0;
  color: var(--egg-muted);
  font-size: 12px;
}
.egg-mission-done .egg-mission-status {
  color: var(--egg-accent);
}
.egg-current-title {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.egg-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.egg-badge {
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--egg-border);
  border-radius: 999px;
  background: var(--egg-surface);
  color: var(--egg-muted);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.egg-empty {
  margin-top: 12px;
}
.egg-slider {
  margin-top: 20px;
  font-size: 15px;
}
.egg-slider slider {
  margin: 14px 10px 0;
}
.egg-conclusion {
  margin-top: 24px;
}
.egg-conclusion .egg-row {
  margin-top: 12px;
}
.egg-records {
  margin-top: 12px;
}
.egg-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  border-bottom: 1px solid var(--egg-border);
  font-size: 14px;
  line-height: 1.6;
}
.egg-record > text:last-child {
  font-weight: 600;
}
.egg-record:last-child {
  border-bottom: 0;
}
.egg-reset {
  color: var(--egg-muted);
}
.egg-footer {
  padding-top: 8px;
}
.snow-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 3;
}
.snowflake {
  position: absolute;
  top: -10%;
  color: var(--egg-snow);
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes fall {
  to {
    transform: translateY(110vh) rotate(360deg);
  }
}
@media (max-width: 340px) {
  .egg-content {
    padding: 20px 16px calc(24px + env(safe-area-inset-bottom));
  }
  .egg-play-actions,
  .egg-actions {
    gap: 8px;
  }
  .egg-button {
    padding-left: 12px;
    padding-right: 12px;
  }
  .egg-appearance {
    gap: 12px 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .snow-container {
    display: none;
  }
}
</style>
