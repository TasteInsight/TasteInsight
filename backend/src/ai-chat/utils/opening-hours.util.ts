import { FloorOpeningHoursDto } from '../../canteens/dto/canteen.dto';

/**
 * 计算食堂当前营业状态
 */
export class OpeningHoursUtil {
  /**
   * 获取当前营业状态
   * @param openingHours 食堂或楼层营业时间
   * @param currentTime 当前时间 (可选，用于测试)
   * @returns 'open' | 'closed' | 'unknown'
   */
  static getStatus(
    openingHours: FloorOpeningHoursDto[],
    currentTime?: Date,
  ): string {
    if (!openingHours || openingHours.length === 0) {
      return 'unknown';
    }

    const now = currentTime || new Date();
    const dayOfWeek = this.getDayOfWeek(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 检查所有楼层的营业时间
    for (const floor of openingHours) {
      if (!floor.schedule || floor.schedule.length === 0) continue;

      // 找到对应星期的时间表
      const todaySchedule = floor.schedule.find(
        (s) => s.dayOfWeek === dayOfWeek,
      );

      if (!todaySchedule) continue;

      // 如果标记为关闭，则跳过
      if (todaySchedule.isClosed) continue;

      // 检查是否在任何时间段内
      for (const slot of todaySchedule.slots) {
        if (this.isInTimeSlot(currentMinutes, slot.openTime, slot.closeTime)) {
          return 'open';
        }
      }
    }

    return 'closed';
  }

  /**
   * 获取星期几的字符串表示
   * @param date 日期
   * @returns 'Monday' | 'Tuesday' | ... | 'Sunday'
   */
  private static getDayOfWeek(date: Date): string {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[date.getDay()];
  }

  /**
   * 检查当前分钟数是否在营业时间段内
   * @param currentMinutes 当前分钟数 (从0点开始)
   * @param openTime 开门时间 "HH:mm"
   * @param closeTime 关门时间 "HH:mm"
   */
  private static isInTimeSlot(
    currentMinutes: number,
    openTime: string,
    closeTime: string,
  ): boolean {
    const openMinutes = this.timeToMinutes(openTime);
    const closeMinutes = this.timeToMinutes(closeTime);

    if (openMinutes === null || closeMinutes === null) {
      return false;
    }

    // 处理跨天的情况 (例如 23:00 - 01:00)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  /**
   * 将时间字符串转换为分钟数
   * @param time 时间字符串 "HH:mm"
   * @returns 分钟数或null
   */
  private static timeToMinutes(time: string): number | null {
    if (!time) return null;

    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  /**
   * 获取下一个营业时间段的描述
   * @param openingHours 营业时间
   * @param currentTime 当前时间
   * @returns 描述字符串或null
   */
  static getNextOpeningInfo(
    openingHours: FloorOpeningHoursDto[],
    currentTime?: Date,
  ): string | null {
    if (!openingHours || openingHours.length === 0) {
      return null;
    }

    const now = currentTime || new Date();
    const dayOfWeek = this.getDayOfWeek(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 简单实现：只检查今天剩余的时间段
    for (const floor of openingHours) {
      if (!floor.schedule) continue;

      const todaySchedule = floor.schedule.find(
        (s) => s.dayOfWeek === dayOfWeek,
      );
      if (!todaySchedule || todaySchedule.isClosed) continue;

      for (const slot of todaySchedule.slots) {
        const openMinutes = this.timeToMinutes(slot.openTime);
        if (openMinutes !== null && openMinutes > currentMinutes) {
          return `将于${slot.openTime}营业`;
        }
      }
    }

    return null;
  }
}
