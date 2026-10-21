import { supplyDatesCover } from './dish-availability';

const range = (startDate: string, endDate = startDate) => ({
  startDate,
  endDate,
});

describe('supplyDatesCover', () => {
  it.each([null, undefined, []])('treats %p as unrestricted', (dates) => {
    expect(supplyDatesCover(dates, '2026-10-01', '2026-12-31')).toBe(true);
  });
  it.each(['2026-10-01', '2026-10-05'])('includes endpoint %s', (date) => {
    expect(supplyDatesCover([range('2026-10-01', '2026-10-05')], date)).toBe(
      true,
    );
  });
  it('merges overlapping and adjacent unordered intervals across a month boundary', () => {
    expect(
      supplyDatesCover(
        [
          range('2026-11-02', '2026-11-05'),
          range('2026-10-30', '2026-11-01'),
          range('2026-11-01', '2026-11-03'),
        ],
        '2026-10-31',
        '2026-11-05',
      ),
    ).toBe(true);
  });
  it('rejects a one-day gap even when both endpoints are supplied', () => {
    expect(
      supplyDatesCover(
        [range('2026-10-01', '2026-10-05'), range('2026-10-07')],
        '2026-10-05',
        '2026-10-07',
      ),
    ).toBe(false);
  });
  it('rejects dates outside the union and ignores malformed historical ranges', () => {
    const dates = [
      range('2026-02-30'),
      range('2026-10-02', '2026-10-01'),
      range('2026-10-05'),
    ];
    expect(supplyDatesCover(dates, '2026-10-04')).toBe(false);
    expect(supplyDatesCover(dates, '2026-10-05')).toBe(true);
    expect(supplyDatesCover(dates, '2026-10-06')).toBe(false);
  });
});
