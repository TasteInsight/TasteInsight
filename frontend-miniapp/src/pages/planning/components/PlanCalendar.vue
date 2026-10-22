<template>
  <view
    class="plan-calendar"
    :class="'plan-calendar-' + mode"
    :aria-label="t('social.planCalendar')"
  >
    <view class="calendar-heading">
      <UiPicker class="calendar-date-picker" mode="date" :value="anchor" @change="pickDate">
        <button
          class="calendar-control calendar-period"
          :aria-label="t('social.selectDateCurrent') + anchor"
        >
          <text class="calendar-period-text">{{ periodLabel }}</text>
          <uni-icons type="down" size="14" color="#667085" aria-hidden="true" />
        </button>
      </UiPicker>
      <button class="calendar-control" :aria-label="previousLabel" @click="move(-1)">
        <uni-icons type="left" size="18" color="#475467" />
      </button>
      <button class="calendar-control" :aria-label="nextLabel" @click="move(1)">
        <uni-icons type="right" size="18" color="#475467" />
      </button>
      <button class="calendar-control calendar-today" @click="goToday">
        {{ t('social.today') }}
      </button>
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
        :aria-label="
          t('social.calendarDayLabel', { p0: day.date, p1: day.count, p2: day.completed })
        "
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
import { t } from '@/i18n';
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
const weekdays = computed(() => [
  t('social.monday'),
  t('social.tuesday'),
  t('social.wednesday'),
  t('social.thursday'),
  t('social.friday'),
  t('social.saturday'),
  t('social.sunday'),
]);
const anchor = computed(() => props.selectedDate || props.today);
const periodLabel = computed(() =>
  props.mode === 'day'
    ? t('social.calendarDayTitle', {
        p0: Number(anchor.value.slice(5, 7)),
        p1: Number(anchor.value.slice(-2)),
        p2: weekdays.value[(new Date(anchor.value + 'T00:00:00Z').getUTCDay() + 6) % 7],
      })
    : t('social.calendarMonthTitle', {
        p0: anchor.value.slice(0, 4),
        p1: Number(anchor.value.slice(5, 7)),
      })
);
const previousLabel = computed(() =>
  props.mode === 'month'
    ? t('social.previousMonth')
    : props.mode === 'week'
      ? t('social.previousWeek')
      : t('social.previousDay')
);
const nextLabel = computed(() =>
  props.mode === 'month'
    ? t('social.nextMonth')
    : props.mode === 'week'
      ? t('social.nextWeek')
      : t('social.nextDay')
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
.calendar-heading {
  display: flex;
  align-items: center;
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
  line-height: var(--field-line-height);
}
.calendar-period {
  justify-content: flex-start;
  gap: 6px;
  padding: 0;
  color: #1f2937;
  font-size: var(--field-font-size);
  font-weight: 600;
  text-align: left;
}
.calendar-period-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
