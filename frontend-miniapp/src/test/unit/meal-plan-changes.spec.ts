import { mealPlanChanges, mealPlanDishNotices } from '@/utils/meal-plan-changes';
const schedule = { startDate: '2099-10-05', endDate: '2099-10-07', mealTime: 'lunch' };
const dish = {
  id: 'd',
  name: '菜品',
  price: 10,
  status: 'online',
  availableMealTime: ['lunch'],
  averageRating: 0,
} as any;
test('unchanged dishes produce no warning and legacy cards have no invented price baseline', () => {
  expect(mealPlanChanges([dish], [{ ...dish }], schedule)).toEqual([]);
  expect(mealPlanChanges([], [dish], schedule)).toEqual([]);
});
test('adjacent supply ranges cover inclusive endpoints while gaps remain visible', () => {
  const dates = (ranges: string[][]) => ({
    ...dish,
    availableDates: ranges.map(([startDate, endDate = startDate]) => ({ startDate, endDate })),
  });
  expect(
    mealPlanDishNotices(dates([['2099-10-06', '2099-10-07'], ['2099-10-05']]), schedule)
  ).toEqual([]);
  expect(mealPlanDishNotices(dates([['2099-10-05'], ['2099-10-07']]), schedule)).toContain(
    '规划日期内部分日期暂停供应'
  );
});
test('price decreases including zero remain explicit and current total may exceed an old budget', () => {
  expect(
    mealPlanChanges([dish], [{ ...dish, price: 0 }], schedule)
      .map(notice => notice.message)
      .join(' ')
  ).toContain('下降至 ¥0.00');
  expect(
    mealPlanChanges([dish], [{ ...dish, price: 12 }], schedule, { totalBudget: 10 })
      .map(notice => notice.message)
      .join(' ')
  ).toContain('高于原预算 ¥10.00');
});
test('supply updates and restoration produce informational notices', () => {
  expect(mealPlanChanges([{ ...dish, status: 'offline' }], [dish], schedule)).toEqual([
    { kind: 'status', dishId: 'd', message: '已恢复供应', messageKey: 'social.supplyRestored' },
  ]);
  expect(
    mealPlanChanges([dish], [{ ...dish, availableMealTime: ['lunch', 'dinner'] }], schedule)
  ).toEqual([
    { kind: 'supply', dishId: 'd', message: '供应安排已更新', messageKey: 'social.supplyUpdated' },
  ]);
});

test('reordering the same supply ranges produces no change warning', () => {
  const ranges = [
    { startDate: '2099-10-05', endDate: '2099-10-05' },
    { startDate: '2099-10-06', endDate: '2099-10-07' },
  ];
  expect(
    mealPlanChanges(
      [{ ...dish, availableDates: ranges }],
      [{ ...dish, availableDates: [...ranges].reverse() }],
      schedule
    )
  ).toEqual([]);
});

test.each([
  [20, 10],
  [20, 20],
])(
  'unit changes preserve both amounts and units without a rise or fall claim (%s to %s)',
  (before, after) => {
    const notices = mealPlanChanges(
      [{ ...dish, price: before, priceUnit: '元/斤' }],
      [{ ...dish, price: after, priceUnit: '100g' }],
      schedule
    );
    expect(notices).toEqual([
      {
        kind: 'price',
        dishId: 'd',
        previousPriceLabel: `¥${before.toFixed(2)}/斤`,
        unitChanged: true,
        messageKey: 'social.pricingUnitChanged',
        priceChange: {
          previousPrice: before,
          currentPrice: after,
          previousUnit: '斤',
          currentUnit: '100g',
        },
        message: `计价方式由 ¥${before.toFixed(2)}/斤 调整为 ¥${after.toFixed(2)}/100g`,
      },
    ]);
  }
);
test.each([
  ['元/份', '份'],
  [undefined, null],
  [null, '元'],
])('equivalent display units compare amounts normally: %p / %p', (beforeUnit, afterUnit) => {
  const notices = mealPlanChanges(
    [{ ...dish, price: 20, priceUnit: beforeUnit }],
    [{ ...dish, price: 10, priceUnit: afterUnit }],
    schedule
  );
  expect(notices[0]).toMatchObject({ kind: 'price', unitChanged: false });
  expect(notices[0].message).toContain('下降至');
});
