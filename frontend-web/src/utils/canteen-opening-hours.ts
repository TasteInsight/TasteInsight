import type { DailyOpeningHours, FloorOpeningHours, TimeSlot } from '@/types/api'

const dayLabels: Record<string, string> = {
  Monday: '周一', Tuesday: '周二', Wednesday: '周三', Thursday: '周四',
  Friday: '周五', Saturday: '周六', Sunday: '周日',
}
const dayNames = Object.fromEntries(Object.entries(dayLabels).map(([name, label]) => [label, name]))

interface LegacyOpeningHours {
  dayOfWeek?: string
  day?: string
  floor?: string | { level?: string }
  slots?: TimeSlot[]
  mealType?: string
  open?: string
  close?: string
  isClosed?: boolean
}

export interface OpeningHoursFormDay {
  floor: string
  day: string
  isClosed: boolean
  slots: TimeSlot[]
}

/** Decode both persisted formats without discarding slots on closed days. */
export function toOpeningHoursForm(
  hours: (FloorOpeningHours | LegacyOpeningHours)[] | null | undefined,
): OpeningHoursFormDay[] {
  return (hours || []).flatMap((item) => {
    const toDay = (daily: LegacyOpeningHours, floor: string): OpeningHoursFormDay => ({
      floor,
      day: dayLabels[daily.dayOfWeek || ''] || daily.dayOfWeek || daily.day || '每天',
      isClosed: daily.isClosed ?? false,
      slots: (daily.slots ?? (daily.isClosed ? [] : [{
        mealType: daily.mealType || 'breakfast',
        openTime: daily.open || '06:30',
        closeTime: daily.close || '22:00',
      }])).map(slot => ({ ...slot, mealType: slot.mealType || 'breakfast' })),
    })
    if ('schedule' in item) {
      return item.schedule.map(daily => toDay(daily, item.floorLevel ?? ''))
    }
    const floor = typeof item.floor === 'string' ? item.floor : item.floor?.level || ''
    return [toDay(item, floor)]
  })
}

/** One record per floor/day, including rows expanded from the daily shortcut. */
export function fromOpeningHoursForm(rows: OpeningHoursFormDay[]): FloorOpeningHours[] {
  const floors = new Map<string, { floorLevel: string; schedule: DailyOpeningHours[] }>()
  for (const row of rows) {
    let floor = floors.get(row.floor)
    if (!floor) {
      floor = { floorLevel: row.floor, schedule: [] }
      floors.set(row.floor, floor)
    }
    const days = row.day === '每天' ? Object.keys(dayLabels) : [dayNames[row.day] || row.day]
    for (const dayOfWeek of days) {
      let daily = floor.schedule.find(day => day.dayOfWeek === dayOfWeek)
      if (!daily) {
        daily = { dayOfWeek, slots: [], isClosed: row.isClosed }
        floor.schedule.push(daily)
      } else if (daily.isClosed !== row.isClosed) {
        throw new Error(`${row.floor || '通用'}层 ${dayLabels[dayOfWeek] || dayOfWeek}的营业与休息设置冲突，请合并为一致的设置`)
      }
      for (const slot of row.slots) {
        if (!daily.slots.some(existing => existing.mealType === slot.mealType &&
          existing.openTime === slot.openTime && existing.closeTime === slot.closeTime)) {
          daily.slots.push({ ...slot })
        }
      }
    }
  }
  return Array.from(floors.values())
}
