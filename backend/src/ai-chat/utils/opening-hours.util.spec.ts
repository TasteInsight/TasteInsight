import { OpeningHoursUtil } from './opening-hours.util';
import { FloorOpeningHoursDto } from '../../canteens/dto/canteen.dto';

describe('OpeningHoursUtil', () => {
  describe('getStatus', () => {
    it('should return "unknown" for empty opening hours', () => {
      const status = OpeningHoursUtil.getStatus([]);
      expect(status).toBe('unknown');
    });

    it('should return "unknown" for null opening hours', () => {
      const status = OpeningHoursUtil.getStatus(null as any);
      expect(status).toBe('unknown');
    });

    it('should return "open" when current time is within opening hours', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          floorLevel: '1',
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'breakfast',
                  openTime: '07:00',
                  closeTime: '09:00',
                },
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 8:00 AM
      const testTime = new Date('2024-01-01T08:00:00');
      const status = OpeningHoursUtil.getStatus(openingHours, testTime);
      expect(status).toBe('open');
    });

    it('should return "closed" when current time is outside opening hours', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          floorLevel: '1',
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 10:00 AM (before lunch)
      const testTime = new Date('2024-01-01T10:00:00');
      const status = OpeningHoursUtil.getStatus(openingHours, testTime);
      expect(status).toBe('closed');
    });

    it('should return "closed" when marked as closed for the day', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          floorLevel: '1',
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: true,
              slots: [],
            },
          ],
        },
      ];

      const testTime = new Date('2024-01-01T12:00:00');
      const status = OpeningHoursUtil.getStatus(openingHours, testTime);
      expect(status).toBe('closed');
    });

    it('should handle multiple floors and check all of them', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          floorLevel: '1',
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
          ],
        },
        {
          floorLevel: '2',
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'breakfast',
                  openTime: '07:00',
                  closeTime: '09:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 8:00 AM - only floor 2 is open
      const testTime = new Date('2024-01-01T08:00:00');
      const status = OpeningHoursUtil.getStatus(openingHours, testTime);
      expect(status).toBe('open');
    });

    it('should handle overnight hours (crossing midnight)', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          floorLevel: '1',
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'night_snack',
                  openTime: '23:00',
                  closeTime: '01:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 23:30 (should be open)
      const testTime1 = new Date('2024-01-01T23:30:00');
      expect(OpeningHoursUtil.getStatus(openingHours, testTime1)).toBe('open');

      // Monday 00:30 (should be open - after midnight)
      const testTime2 = new Date('2024-01-01T00:30:00');
      expect(OpeningHoursUtil.getStatus(openingHours, testTime2)).toBe('open');

      // Monday 02:00 (should be closed)
      const testTime3 = new Date('2024-01-01T02:00:00');
      expect(OpeningHoursUtil.getStatus(openingHours, testTime3)).toBe(
        'closed',
      );
    });

    it('should handle edge case at exact opening time', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
          ],
        },
      ];

      // Exactly at opening time
      const testTime = new Date('2024-01-01T11:00:00');
      expect(OpeningHoursUtil.getStatus(openingHours, testTime)).toBe('open');
    });

    it('should handle edge case at exact closing time', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
          ],
        },
      ];

      // Exactly at closing time (should be closed)
      const testTime = new Date('2024-01-01T13:00:00');
      expect(OpeningHoursUtil.getStatus(openingHours, testTime)).toBe('closed');
    });

    it('should handle different days of the week', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          schedule: [
            {
              dayOfWeek: 'Tuesday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
            {
              dayOfWeek: 'Wednesday',
              isClosed: true,
              slots: [],
            },
          ],
        },
      ];

      // Tuesday 12:00 (should be open)
      const tuesday = new Date('2024-01-02T12:00:00');
      expect(OpeningHoursUtil.getStatus(openingHours, tuesday)).toBe('open');

      // Wednesday 12:00 (should be closed - isClosed=true)
      const wednesday = new Date('2024-01-03T12:00:00');
      expect(OpeningHoursUtil.getStatus(openingHours, wednesday)).toBe(
        'closed',
      );
    });
  });

  describe('getNextOpeningInfo', () => {
    it('should return null for empty opening hours', () => {
      const info = OpeningHoursUtil.getNextOpeningInfo([]);
      expect(info).toBeNull();
    });

    it('should return next opening time when closed', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
                {
                  mealType: 'dinner',
                  openTime: '17:00',
                  closeTime: '19:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 10:00 AM
      const testTime = new Date('2024-01-01T10:00:00');
      const info = OpeningHoursUtil.getNextOpeningInfo(openingHours, testTime);
      expect(info).toBe('将于11:00营业');
    });

    it('should return next slot when between two slots', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
                {
                  mealType: 'dinner',
                  openTime: '17:00',
                  closeTime: '19:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 15:00 (between lunch and dinner)
      const testTime = new Date('2024-01-01T15:00:00');
      const info = OpeningHoursUtil.getNextOpeningInfo(openingHours, testTime);
      expect(info).toBe('将于17:00营业');
    });

    it('should return null when no more openings today', () => {
      const openingHours: FloorOpeningHoursDto[] = [
        {
          schedule: [
            {
              dayOfWeek: 'Monday',
              isClosed: false,
              slots: [
                {
                  mealType: 'lunch',
                  openTime: '11:00',
                  closeTime: '13:00',
                },
              ],
            },
          ],
        },
      ];

      // Monday 20:00 (after all slots)
      const testTime = new Date('2024-01-01T20:00:00');
      const info = OpeningHoursUtil.getNextOpeningInfo(openingHours, testTime);
      expect(info).toBeNull();
    });
  });
});
