import {
  canAccessCanteen,
  canteenScopeFilter,
  defaultCanteenId,
  isGlobalScope,
} from './admin-scope';

describe('admin canteen scope', () => {
  const selected = { scope: 'CANTEENS' as const, canteenIds: ['c1', 'c2'] };
  it('allows each selected canteen and rejects unrelated or global resources', () => {
    expect(canAccessCanteen(selected, 'c1')).toBe(true);
    expect(canAccessCanteen(selected, 'c2')).toBe(true);
    expect(canAccessCanteen(selected, 'c3')).toBe(false);
    expect(canAccessCanteen(selected, null)).toBe(false);
    expect(canteenScopeFilter(selected)).toEqual({ in: ['c1', 'c2'] });
  });
  it('keeps an empty selected scope closed', () => {
    const empty = { scope: 'CANTEENS' as const, canteenIds: [] };
    expect(isGlobalScope(empty)).toBe(false);
    expect(canAccessCanteen(empty, 'c1')).toBe(false);
    expect(canteenScopeFilter(empty)).toEqual({ in: [] });
  });
  it('requires explicit global scope for global resources', () => {
    const global = { scope: 'GLOBAL' as const, canteenIds: [] };
    expect(isGlobalScope(global)).toBe(true);
    expect(canAccessCanteen(global, null)).toBe(true);
    expect(canAccessCanteen(global, 'future-canteen')).toBe(true);
    expect(canteenScopeFilter(global)).toBeUndefined();
  });
  it('only infers a target for a single selected canteen', () => {
    expect(defaultCanteenId(selected)).toBeUndefined();
    expect(
      defaultCanteenId({ scope: 'GLOBAL', canteenIds: [] }),
    ).toBeUndefined();
    expect(defaultCanteenId({ scope: 'CANTEENS', canteenIds: ['c2'] })).toBe(
      'c2',
    );
  });
});
