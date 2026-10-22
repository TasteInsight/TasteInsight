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
        <text class="egg-title">{{ t('account.egg.tasteinsightHiddenLab') }}</text>
        <text class="egg-muted">{{ t('account.egg.youFoundThePlayfulSide') }}</text>
        <button
          class="egg-button egg-text-button"
          :aria-expanded="showSecretHint"
          @tap="toggleSecretHint"
        >
          {{ t('account.egg.howToPlay') }}
        </button>
        <text v-if="showSecretHint" class="egg-note">{{
          t('account.egg.every3DishesTriggerA')
        }}</text>
        <view class="egg-appearance">
          <view class="egg-toggle"
            ><text>{{ t('account.egg.nightMode') }}</text
            ><switch
              :checked="isDarkMode"
              color="#660874"
              :aria-label="t('account.egg.nightMode')"
              @change="toggleDarkMode"
          /></view>
          <view class="egg-toggle"
            ><text>{{ t('account.egg.snowEffect') }}</text
            ><switch
              :checked="isSnowing"
              color="#660874"
              :aria-label="t('account.egg.snowEffect')"
              @change="toggleSnow"
          /></view>
        </view>
      </view>

      <view class="egg-section egg-level">
        <view class="egg-row"
          ><text class="egg-heading">{{ t('account.egg.researcherLv', { level: level }) }}</text
          ><text class="egg-muted">{{ t('account.egg.coins', { count: stats.coins }) }}</text></view
        >
        <view
          class="egg-progress"
          role="progressbar"
          :aria-valuenow="xpInLevel"
          :aria-valuemax="xpToNext"
          :aria-label="t('account.egg.researcherExperience')"
          ><view :style="{ width: (xpInLevel / xpToNext) * 100 + '%' }"
        /></view>
        <text class="egg-muted">{{
          t('account.egg.xp', { current: xpInLevel, total: xpToNext })
        }}</text>
      </view>

      <view class="egg-section egg-generator">
        <text class="egg-heading">{{ t('account.egg.absurdDishGenerator') }}</text>
        <text class="egg-dish-name" aria-live="polite">{{ dishName }}</text>
        <view class="egg-row egg-wrap"
          ><text class="egg-muted">{{
            t('account.egg.combo', {
              count: comboCount,
              bonus: comboCount >= 2 ? t('account.egg.comboBonus') : '',
            })
          }}</text
          ><text class="egg-muted">{{
            t('account.egg.inspiration10', { count: inspiration })
          }}</text></view
        >
        <text class="egg-muted egg-combo-hint">{{
          t('account.egg.every3DishesTriggerA2', { hint: comboHint })
        }}</text>

        <view class="egg-challenge">
          <view class="egg-row egg-wrap"
            ><text class="egg-subheading">{{ t('account.egg.section10SecondDishChallenge') }}</text
            ><text class="egg-muted">{{
              t('account.egg.dishes', { count: challenge.count, target: challenge.target })
            }}</text></view
          >
          <text class="egg-muted">{{
            t('account.egg.generateDishesIn10Seconds', {
              target: challenge.target,
              reward: CHALLENGE_REWARD_COINS,
            })
          }}</text>
          <view
            class="egg-progress egg-challenge-progress"
            role="progressbar"
            :aria-label="t('account.egg.challengeProgress')"
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
            {{ t('account.egg.generateADish') }}
          </button>
          <button
            class="egg-button egg-outline"
            data-action="challenge"
            :disabled="challenge.active"
            @tap="startChallenge"
          >
            {{
              challenge.active
                ? t('account.egg.remainingSeconds', { seconds: challenge.remaining })
                : t('account.egg.startChallenge')
            }}
          </button>
        </view>
        <view class="egg-actions egg-copy-actions"
          ><button class="egg-button" @tap="copyDish">{{ t('account.egg.copyDishName') }}</button
          ><button class="egg-button" @tap="shareText">
            {{ t('account.egg.copyTodaySCombo') }}
          </button></view
        >
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">{{ t('account.egg.todaySFlavorFortune') }}</text
          ><text class="egg-muted">{{ todayKey }}</text></view
        >
        <text class="egg-prose egg-fortune" aria-live="polite">{{ fortune }}</text>
        <view class="egg-actions"
          ><button class="egg-button egg-outline" @tap="regenerate">
            {{ t('account.egg.drawAgain') }}</button
          ><button class="egg-button" @tap="copyFortune">{{ t('account.egg.copy') }}</button></view
        >
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">{{ t('account.egg.todaySMissions') }}</text
          ><text class="egg-muted">{{
            t('account.egg.complete', { count: doneMissionsCount, total: missions.length })
          }}</text></view
        >
        <text class="egg-muted">{{ t('account.egg.tapAMissionToComplete') }}</text>
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
              isMissionDone(mission.id) ? t('account.egg.complete2') : t('account.egg.incomplete')
            }}</text>
          </button>
        </view>
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">{{ t('account.egg.titleDraw') }}</text
          ><text class="egg-muted">{{
            t('account.egg.collected', { count: stats.titles.length })
          }}</text></view
        >
        <text class="egg-muted">{{ t('account.egg.justForFunCurrentTitle') }}</text>
        <text class="egg-current-title">{{ currentTitle }}</text>
        <view class="egg-actions"
          ><button class="egg-button egg-outline" @tap="drawTitle">
            {{ t('account.egg.drawOneCoins', { cost: TITLE_COST }) }}</button
          ><button class="egg-button" @tap="equipRandomTitle">
            {{ t('account.egg.equipARandomTitle') }}
          </button></view
        >
        <view v-if="previewTitles.length" class="egg-badges"
          ><text v-for="item in previewTitles" :key="item" class="egg-badge">{{ item }}</text></view
        >
        <text v-else class="egg-muted egg-empty">{{
          t('account.egg.tryDrawingYourFirstTitle')
        }}</text>
      </view>

      <view class="egg-section">
        <view class="egg-row egg-wrap"
          ><text class="egg-heading">{{ t('account.egg.flavorControls') }}</text
          ><button class="egg-button egg-text-button" @tap="randomizeFlavor">
            {{ t('account.egg.randomize') }}
          </button></view
        >
        <text class="egg-muted">{{ t('account.egg.theseControlsAreJustFor') }}</text>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>{{ t('account.settings.spiciness') }}</text
            ><text class="egg-muted">{{ heat }} / 10</text></view
          ><slider
            :value="heat"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            :aria-label="t('account.settings.spiciness')"
            @change="onHeatChange"
        /></view>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>{{ t('account.settings.sweetness') }}</text
            ><text class="egg-muted">{{ sweet }} / 10</text></view
          ><slider
            :value="sweet"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            :aria-label="t('account.settings.sweetness')"
            @change="onSweetChange"
        /></view>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>{{ t('account.settings.saltiness') }}</text
            ><text class="egg-muted">{{ salty }} / 10</text></view
          ><slider
            :value="salty"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            :aria-label="t('account.settings.saltiness')"
            @change="onSaltyChange"
        /></view>
        <view class="egg-slider"
          ><view class="egg-row"
            ><text>{{ t('account.settings.oiliness') }}</text
            ><text class="egg-muted">{{ oily }} / 10</text></view
          ><slider
            :value="oily"
            :min="0"
            :max="10"
            :step="1"
            :active-color="isDarkMode ? '#d3a0dc' : '#660874'"
            background-color="#d0d5dd"
            :block-size="24"
            :aria-label="t('account.settings.oiliness')"
            @change="onOilyChange"
        /></view>
        <view class="egg-conclusion"
          ><text class="egg-prose">{{ conclusion }}</text
          ><view class="egg-row egg-wrap"
            ><text class="egg-muted">{{ t('account.egg.title', { title: title }) }}</text
            ><text class="egg-muted">{{
              t('account.egg.suggestion', { suggestion: suggestion })
            }}</text></view
          ></view
        >
      </view>

      <view class="egg-section">
        <text class="egg-heading">{{ t('account.egg.labRecordsAndDeviceRankings') }}</text>
        <text class="egg-muted">{{ t('account.egg.basedOnHiddenLabActivity') }}</text>
        <view class="egg-records">
          <view class="egg-record"
            ><text>{{ t('account.egg.level') }}</text
            ><text>Lv. {{ level }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.dishesGenerated') }}</text
            ><text>{{ t('account.egg.dishes2', { count: stats.dishesGenerated }) }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.mutations') }}</text
            ><text>{{ t('account.egg.times', { count: stats.mutations }) }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.bestCombo') }}</text
            ><text>{{ stats.bestCombo }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.bestChallenge10Seconds') }}</text
            ><text>{{ t('account.egg.dishes2', { count: stats.bestChallengeCount }) }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.totalTaps') }}</text
            ><text>{{ stats.plays }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.checkInStreak') }}</text
            ><text>{{ t('account.egg.days', { count: stats.streak }) }}</text></view
          >
          <view class="egg-record"
            ><text>{{ t('account.egg.bestCheckInStreak') }}</text
            ><text>{{ t('account.egg.days', { count: stats.bestStreak }) }}</text></view
          >
        </view>
        <view class="egg-actions"
          ><button class="egg-button egg-reset" @tap="resetAll">
            {{ t('account.egg.clearThisPageSRecords') }}</button
          ><text class="egg-muted">{{ t('account.egg.affectsHiddenLabOnly') }}</text></view
        >
      </view>
      <text class="egg-muted egg-footer">{{ t('account.egg.thisPageIsHiddenFrom') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
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

const fortuneParts = ref<string[]>([]);
const fortune = computed(() => fortuneParts.value.map(key => t(key)).join(''));
const dishParts = ref<string[]>([]);
const dishName = computed(() => dishParts.value.map(key => t(key)).join(''));
const dishTapCount = ref(0);

const showSecretHint = ref(false);

const todayKey = computed(() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
});

const missions = computed(() => [
  { id: 'm1', text: t('account.egg.tryAStallYouHave') },
  { id: 'm2', text: t('account.egg.writeAThoughtfulReviewWith') },
  { id: 'm3', text: t('account.egg.saveADishYouWould') },
  { id: 'm4', text: t('account.egg.takeAGreatPhotoOf') },
  { id: 'm5', text: t('account.egg.orderASideDishYou') },
  { id: 'm6', text: t('account.egg.tryAHigherSpiceLevel') },
  { id: 'm7', text: t('account.egg.shareAFavoriteDishWith') },
  { id: 'm8', text: t('account.egg.leaveAKindCommentFor') },
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

const titleKeys: Record<string, string> = {
  食堂侦探: 'account.egg.canteenDetective',
  窗口观察员: 'account.egg.stallObserver',
  重口狂热者: 'account.egg.boldFlavorFan',
  清淡守望者: 'account.egg.lightFlavorGuardian',
  甜辣双修: 'account.egg.sweetAndSpicyMaster',
  快乐主义者: 'account.egg.joySeeker',
  均衡探索者: 'account.egg.balancedExplorer',
  早八幸存者: 'account.egg.section8AMSurvivor',
  夜宵研究员: 'account.egg.lateNightSnackResearcher',
  三秒决策王: 'account.egg.threeSecondDecisionChampion',
  小份策略家: 'account.egg.smallPortionStrategist',
  咀嚼哲学家: 'account.egg.chewingPhilosopher',
  拍照先行者: 'account.egg.photoFirstPioneer',
  香气追踪者: 'account.egg.aromaTracker',
  油光鉴定师: 'account.egg.oilInspector',
  辣度测绘员: 'account.egg.spiceMapper',
  甜度守护者: 'account.egg.sweetnessGuardian',
  咸度管理员: 'account.egg.saltSupervisor',
  勇敢尝新者: 'account.egg.braveTaster',
  评价写作家: 'account.egg.reviewWriter',
  收藏强迫症: 'account.egg.serialCollector',
  双拼信徒: 'account.egg.comboBeliever',
  排队艺术家: 'account.egg.queueArtist',
  饭点时间学家: 'account.egg.mealtimeScholar',
  冰饮搭配师: 'account.egg.coldDrinkStylist',
  微辣勇者: 'account.egg.mildSpiceHero',
  咸香鉴赏家: 'account.egg.savoryConnoisseur',
  汤头测试员: 'account.egg.brothTester',
  咖喱守望者: 'account.egg.curryGuardian',
  甜品鉴定师: 'account.egg.dessertExpert',
  素食实践家: 'account.egg.vegetarianExplorer',
  夜宵行者: 'account.egg.midnightDiner',
  早八侦查员: 'account.egg.morningScout',
  口味调研员: 'account.egg.flavorResearcher',
  分量计算师: 'account.egg.portionCalculator',
  排队策略家: 'account.egg.queueStrategist',
  回锅菜艺术家: 'account.egg.wokArtist',
  咀嚼节奏师: 'account.egg.chewingRhythmMaster',
};
const titlePool = Object.keys(titleKeys);
const displayTitle = (value: string) => (titleKeys[value] ? t(titleKeys[value]) : value);

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
    uni.showToast({ title: t('account.egg.levelUpToLv', { level: afterLevel }), icon: 'none' });
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
    uni.showToast({
      title: t('account.egg.dayCheckInStreak', { days: stats.value.streak }),
      icon: 'none',
    });
  } else {
    stats.value.streak = 1;
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.streak);
    stats.value.lastDayKey = today;
    grant(10, 2);
    uni.showToast({ title: t('account.egg.checkedInAgainStreakRestarted'), icon: 'none' });
  }
  saveStats(stats.value);
}

const inspiration = computed(() => {
  return stats.value.dishesGenerated % 10;
});

const doneMissionsCount = computed(
  () => missions.value.filter(m => !!stats.value.missions[m.id]).length
);

const currentTitle = computed(() =>
  stats.value.equippedTitle ? displayTitle(stats.value.equippedTitle) : t('account.egg.none')
);
const previewTitles = computed(() => stats.value.titles.slice(0, 6).map(displayTitle));

const comboCount = ref(0);
const lastDishAt = ref(0);
const COMBO_GAP_MS = 4000;
const comboHint = computed(() => {
  if (comboCount.value >= 2) return t('account.egg.keepTappingToIncreaseYour');
  return t('account.egg.tapQuicklyToStartA');
});

const challengeFeedbackKey = ref('');
const challengeFeedback = computed(() =>
  challengeFeedbackKey.value ? t(challengeFeedbackKey.value, { count: CHALLENGE_REWARD_COINS }) : ''
);
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
  challengeFeedbackKey.value = 'account.egg.challengeCanceledYouCanStart';
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
    uni.showToast({ title: t('account.egg.achievementUnlocked'), icon: 'none' });
    fortuneParts.value = ['account.egg.achievementFortuneTodaySMissions'];
    grant(15, 3);
  }
}

const conclusion = computed(() => {
  const spicy = heat.value >= 7;
  const sugary = sweet.value >= 7;
  const saltyHigh = salty.value >= 7;
  const oilyHigh = oily.value >= 7;

  if (spicy && sugary) return t('account.egg.youAreASweetAnd');
  if (spicy && saltyHigh) return t('account.egg.youLoveBoldFlavorsA');
  if (sugary && oilyHigh) return t('account.egg.youAreAJoySeeker');
  if (heat.value <= 2 && sweet.value <= 2 && salty.value <= 2 && oily.value <= 2)
    return t('account.egg.youPreferLightFlavorsNatural');
  return t('account.egg.youAreABalancedExplorer');
});

const title = computed(() => {
  const spicy = heat.value >= 7;
  const sugary = sweet.value >= 7;
  const saltyHigh = salty.value >= 7;
  const oilyHigh = oily.value >= 7;
  if (spicy && sugary) return t('account.egg.sweetAndSpicyMaster');
  if (spicy && saltyHigh) return t('account.egg.boldFlavorMaster');
  if (sugary && oilyHigh) return t('account.egg.joySeeker');
  if (heat.value <= 2 && sweet.value <= 2 && salty.value <= 2 && oily.value <= 2)
    return t('account.egg.lightFlavorGuardian');
  return t('account.egg.balancedExplorer');
});

const suggestion = computed(() => {
  if (heat.value >= 7) return t('account.egg.coldDrinkOrYogurt');
  if (oily.value >= 7) return t('account.egg.freshVegetables');
  if (salty.value >= 7) return t('account.egg.clearSoupOrFruit');
  if (sweet.value >= 7) return t('account.egg.unsweetenedTea');
  return t('account.egg.anythingYouFancy');
});

function regenerate() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  const opener = pickOne([
    'account.egg.todaySIdea',
    'account.egg.tasteinsightTip',
    'account.egg.flavorWhisper',
    'account.egg.secretSuggestion',
    'account.egg.todaySDiscovery',
    'account.egg.aQuietRecommendation',
    'account.egg.tipOfTheDay',
  ]);
  const action = pickOne([
    'account.egg.visitANewStallAnd',
    'account.egg.followYourAppetiteAndTaste',
    'account.egg.writeAThoughtfulReviewOne',
    'account.egg.switchYourStapleFoodAnd',
    'account.egg.swapABiteWithA',
    'account.egg.orderAVegetableDishAnd',
    'account.egg.goOneSpiceLevelHigher',
    'account.egg.tryASeasonalSpecialOr',
    'account.egg.askForTheStallS',
    'account.egg.tryAnIngredientInA',
  ]);
  const twist = pickOne([
    'account.egg.ifItDisappointsReviewIt',
    'account.egg.ifItSurprisesYouSave',
    'account.egg.ifYouCannotDecideChoose',
    'account.egg.ifYouHesitateTakeA',
    'account.egg.aLittleVinegarOrChili',
    'account.egg.giveTheStallFiveStars',
  ]);
  fortuneParts.value = [opener, action, twist];
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
    'account.egg.flipFlop',
    'account.egg.ultimate',
    'account.egg.hidden',
    'account.egg.limitedEdition',
    'account.egg.graduation',
    'account.egg.allNighter',
    'account.egg.section8AM',
    'account.egg.introvert',
    'account.egg.socialButterfly',
    'account.egg.secretRecipe',
    'account.egg.deluxe',
    'account.egg.minimalist',
    'account.egg.retro',
  ]);
  const base = pickOne([
    'account.egg.chickenLeg',
    'account.egg.beef',
    'account.egg.tofu',
    'account.egg.eggplant',
    'account.egg.potato',
    'account.egg.shrimp',
    'account.egg.broccoli',
    'account.egg.mushroom',
    'account.egg.tomato',
    'account.egg.bacon',
    'account.egg.steak',
    'account.egg.pork',
    'account.egg.chickenBreast',
    'account.egg.corn',
    'account.egg.tofuSkin',
  ]);
  const sauce = pickOne([
    'account.egg.spicySichuan',
    'account.egg.blackPepper',
    'account.egg.curry',
    'account.egg.garlic',
    'account.egg.sweetAndSour',
    'account.egg.teriyaki',
    'account.egg.saltAndPepper',
    'account.egg.sourSoup',
    'account.egg.tomato',
    'account.egg.cumin',
    'account.egg.cheese',
    'account.egg.cream',
    'account.egg.cuminChili',
  ]);
  const finish = pickOne([
    'account.egg.riceBowl',
    'account.egg.mixedNoodles',
    'account.egg.bake',
    'account.egg.miniHotpot',
    'account.egg.salad',
    'account.egg.wrap',
    'account.egg.handheldFeast',
    'account.egg.duo',
    'account.egg.noodleBowl',
    'account.egg.clayPot',
    'account.egg.sauceRiceBowl',
  ]);

  let extra = '';
  if (dishTapCount.value % 3 === 0) {
    extra = pickOne([
      'account.egg.crunch',
      'account.egg.meltingCenter',
      'account.egg.doubleCheese',
      'account.egg.fireAndIce',
      'account.egg.mysterySide',
      'account.egg.cheeseCrisps',
      'account.egg.caramel',
      'account.egg.kimchi',
    ]);
    stats.value.mutations += 1;
    if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
    grant(6, 1);
  }

  dishParts.value = [style, sauce, base, finish, extra].filter(Boolean);

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
    uni.showToast({ title: t('account.egg.needMoreCoinsGenerateA'), icon: 'none' });
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
    grant(10, 0, t('account.egg.titleEarned', { title: displayTitle(drawn) }));
    return;
  }

  // 重复卡：返还小额金币并给经验
  saveStats(stats.value);
  grant(6, 1, t('account.egg.duplicateTitle1CoinRefunded', { title: displayTitle(drawn) }));
}

function equipRandomTitle() {
  ensureDailyCheckin();
  stats.value.plays += 1;
  if (stats.value.titles.length === 0) {
    uni.showToast({ title: t('account.egg.youHaveNoTitlesYet'), icon: 'none' });
    return;
  }
  const selectedTitle = pickOne(stats.value.titles);
  stats.value.equippedTitle = selectedTitle;
  saveStats(stats.value);
  grant(1, 0, t('account.egg.titleChanged'));
}

function startChallenge() {
  if (challenge.value.active) return;
  ensureDailyCheckin();
  stats.value.plays += 1;
  challengeFeedbackKey.value = '';

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
        challengeFeedbackKey.value = 'account.egg.challengeCompleteYouEarnedCoins';
        grant(20, CHALLENGE_REWARD_COINS, t('account.egg.challengeCompleteCoinsEarned'));
        if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
      } else {
        challengeFeedbackKey.value = 'account.egg.targetMissedThisRoundTry';
        grant(3, 0, t('account.egg.challengeMissedTryAgain'));
      }
      saveStats(stats.value);
    }
  }, 1000);

  uni.showToast({ title: t('account.egg.challengeStartedGenerateDishes'), icon: 'none' });
  saveStats(stats.value);
}

function copyDish() {
  const data = dishName.value || t('account.egg.empty');
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: t('account.egg.copied'), icon: 'none' }),
  });
}

function shareText() {
  const data = t('account.egg.tasteinsightHiddenLabFortuneAbsurd', {
    fortune: fortune.value || t('account.egg.empty'),
    dish: dishName.value || t('account.egg.empty'),
    title: title.value,
    spicy: heat.value,
    sweet: sweet.value,
    salty: salty.value,
    oily: oily.value,
  });
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: t('account.egg.copied'), icon: 'none' }),
  });
}

function copyFortune() {
  const data = fortune.value || t('account.egg.empty');
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: t('account.egg.copied'), icon: 'none' }),
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
  grant(5, 0, t('account.egg.flavorSettingsRandomized'));
}

function resetAll() {
  uni.showModal({
    title: t('account.egg.clearRecords'),
    content: t('account.egg.clearThisPageSStatistics'),
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
      challengeFeedbackKey.value = '';
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
      uni.showToast({ title: t('account.egg.cleared'), icon: 'none' });
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
    'account.egg.todaySIdea',
    'account.egg.tasteinsightTip',
    'account.egg.flavorWhisper',
    'account.egg.secretSuggestion',
    'account.egg.todaySDiscovery',
    'account.egg.aQuietRecommendation',
    'account.egg.tipOfTheDay',
  ]);
  const action = pickOne([
    'account.egg.visitANewStallAnd',
    'account.egg.followYourAppetiteAndTaste',
    'account.egg.writeAThoughtfulReviewOne',
    'account.egg.switchYourStapleFoodAnd',
    'account.egg.swapABiteWithA',
    'account.egg.orderAVegetableDishAnd',
    'account.egg.goOneSpiceLevelHigher',
    'account.egg.tryASeasonalSpecialOr',
    'account.egg.askForTheStallS',
    'account.egg.tryAnIngredientInA',
  ]);
  const twist = pickOne([
    'account.egg.ifItDisappointsReviewIt',
    'account.egg.ifItSurprisesYouSave',
    'account.egg.ifYouCannotDecideChoose',
    'account.egg.ifYouHesitateTakeA',
    'account.egg.aLittleVinegarOrChili',
    'account.egg.giveTheStallFiveStars',
  ]);
  fortuneParts.value = [opener, action, twist];
}

function generateDishPreview() {
  const style = pickOne([
    'account.egg.flipFlop',
    'account.egg.ultimate',
    'account.egg.hidden',
    'account.egg.limitedEdition',
    'account.egg.graduation',
    'account.egg.allNighter',
    'account.egg.section8AM',
    'account.egg.introvert',
    'account.egg.socialButterfly',
    'account.egg.secretRecipe',
    'account.egg.deluxe',
    'account.egg.minimalist',
    'account.egg.retro',
  ]);
  const base = pickOne([
    'account.egg.chickenLeg',
    'account.egg.beef',
    'account.egg.tofu',
    'account.egg.eggplant',
    'account.egg.potato',
    'account.egg.shrimp',
    'account.egg.broccoli',
    'account.egg.mushroom',
    'account.egg.tomato',
    'account.egg.bacon',
    'account.egg.steak',
    'account.egg.pork',
    'account.egg.chickenBreast',
    'account.egg.corn',
    'account.egg.tofuSkin',
  ]);
  const sauce = pickOne([
    'account.egg.spicySichuan',
    'account.egg.blackPepper',
    'account.egg.curry',
    'account.egg.garlic',
    'account.egg.sweetAndSour',
    'account.egg.teriyaki',
    'account.egg.saltAndPepper',
    'account.egg.sourSoup',
    'account.egg.tomato',
    'account.egg.cumin',
    'account.egg.cheese',
    'account.egg.cream',
    'account.egg.cuminChili',
  ]);
  const finish = pickOne([
    'account.egg.riceBowl',
    'account.egg.mixedNoodles',
    'account.egg.bake',
    'account.egg.miniHotpot',
    'account.egg.salad',
    'account.egg.wrap',
    'account.egg.handheldFeast',
    'account.egg.duo',
    'account.egg.noodleBowl',
    'account.egg.clayPot',
    'account.egg.sauceRiceBowl',
  ]);
  dishParts.value = [style, sauce, base, finish];
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
