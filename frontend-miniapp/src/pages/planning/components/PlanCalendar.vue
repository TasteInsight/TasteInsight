<template>
  <view class="plan-calendar" :class="'plan-calendar-' + mode" aria-label="饮食计划日历">
    <view class="calendar-heading">
      <UiPicker class="calendar-date-picker" mode="date" :value="anchor" @change="pickDate">
        <button class="calendar-control calendar-period" :aria-label="'选择日期，当前 ' + anchor">
          <text>{{ periodLabel }}</text>
          <uni-icons type="down" size="14" color="#667085" aria-hidden="true" />
        </button>
      </UiPicker>
      <button class="calendar-control" :aria-label="previousLabel" @click="move(-1)">
        <uni-icons type="left" size="18" color="#475467" />
      </button>
      <button class="calendar-control" :aria-label="nextLabel" @click="move(1)">
        <uni-icons type="right" size="18" color="#475467" />
      </button>
      <button class="calendar-control calendar-today" @click="goToday">今天</button>
    </view>
    <view v-if="mode !== 'day'" class="calendar-week" aria-hidden="true">
      <text v-for="day in weekdays" :key="day">{{ day }}</text>
    </view>
    <view v-if="mode !== 'day'" class="calendar-grid">
      <button
        v-for="day in days"
        :key="day.date"
        class="calendar-day"
        :class="{
          'calendar-day-muted': !day.inMonth,
          'calendar-day-selected': anchor === day.date,
          'calendar-day-today': day.isToday,
        }"
        :aria-label="`${day.date}，${day.count} 个计划，${day.completed} 个已吃`"
        :aria-pressed="anchor === day.date"
        @click="$emit('select', day.date)"
      >
        <text>{{
          mode === 'week' && !day.inMonth ? Number(day.date.slice(5, 7)) + '/' + day.day : day.day
        }}</text>
        <view
          class="calendar-indicator"
          :class="{
            'calendar-indicator-active': day.count > 0,
            'calendar-indicator-complete': day.count > 0 && day.completed === day.count,
          }"
        />
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UiPicker from '@/components/UiPicker.vue';
import type { MealPlan } from '@/types/api';
import {
  addDays,
  calendarDays,
  campusToday,
  shiftMonthDate,
  weekDays,
} from '../utils/meal-plan-date';
const props = withDefaults(
  defineProps<{
    plans?: MealPlan[];
    today?: string;
    selectedDate?: string;
    mode?: 'month' | 'week' | 'day';
  }>(),
  {
    plans: () => [],
    today: () => campusToday(),
    selectedDate: '',
    mode: 'week',
  }
);
const emit = defineEmits<{ select: [date: string] }>();
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const anchor = computed(() => props.selectedDate || props.today);
const periodLabel = computed(() =>
  props.mode === 'day'
    ? `${Number(anchor.value.slice(5, 7))} 月 ${Number(anchor.value.slice(-2))} 日 · 周${weekdays[(new Date(anchor.value + 'T00:00:00Z').getUTCDay() + 6) % 7]}`
    : `${anchor.value.slice(0, 4)} 年 ${Number(anchor.value.slice(5, 7))} 月`
);
const previousLabel = computed(() =>
  props.mode === 'month' ? '上个月' : props.mode === 'week' ? '上一周' : '上一天'
);
const nextLabel = computed(() =>
  props.mode === 'month' ? '下个月' : props.mode === 'week' ? '下一周' : '下一天'
);
const days = computed(() =>
  props.mode === 'month'
    ? calendarDays(anchor.value.slice(0, 7), props.plans, props.today)
    : weekDays(anchor.value, props.plans, props.today)
);
function move(amount: number) {
  emit(
    'select',
    props.mode === 'month'
      ? shiftMonthDate(anchor.value, amount)
      : addDays(anchor.value, amount * (props.mode === 'week' ? 7 : 1))
  );
}
function pickDate(event: { detail: { value: string } }) {
  emit('select', event.detail.value);
}
function goToday() {
  emit('select', props.today);
}
</script>

<style scoped>
.plan-calendar {
  padding: 8px 16px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.calendar-heading {
  display: flex;
  align-items: center;
  gap: 4px;
}
.calendar-date-picker {
  flex: 1;
  min-width: 0;
}
.calendar-control {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475467;
  font-size: 13px;
}
.calendar-period {
  justify-content: flex-start;
  gap: 6px;
  padding-left: 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  text-align: left;
}
.calendar-control::after,
.calendar-day::after {
  border: 0;
}
.calendar-today {
  color: #660874;
}
.calendar-week,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.calendar-week {
  padding: 10px 0 4px;
  color: #667085;
  font-size: 12px;
  text-align: center;
}
.calendar-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 6px 0;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.calendar-day-muted {
  color: #667085;
}
.calendar-day-today {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.calendar-day-selected {
  background: #660874;
  color: #fff;
}
.calendar-indicator {
  width: 4px;
  height: 4px;
  margin-top: 3px;
  border-radius: 50%;
  background: transparent;
}
.calendar-indicator-active {
  background: #660874;
}
.calendar-indicator-complete {
  background: #2f6b50;
}
.calendar-day-selected .calendar-indicator-active {
  background: #fff;
}
.plan-calendar-week .calendar-day {
  min-height: 52px;
  font-size: 16px;
}
.plan-calendar-day {
  padding-bottom: 8px;
}
.calendar-control:focus-visible,
.calendar-day:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.calendar-control:active,
.calendar-day:active {
  opacity: 0.72;
}
</style>
