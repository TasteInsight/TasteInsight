import {
  ALL_PERMISSIONS,
  GLOBAL_ONLY_PERMISSIONS,
  PERMISSION_GROUPS,
} from './permissions.constants';

describe('permission catalog', () => {
  it('exposes every permission once, including independent log access', () => {
    const entries = PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((permission) => permission.id),
    );
    expect(new Set(entries).size).toBe(entries.length);
    expect(entries.sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(entries).toContain('log:view');
  });

  it('marks student, community and recommendation experiments as global capabilities', () => {
    expect(GLOBAL_ONLY_PERMISSIONS).toEqual(
      expect.arrayContaining([
        'student:review',
        'post:view',
        'experiment:view',
        'experiment:edit',
      ]),
    );
    expect(GLOBAL_ONLY_PERMISSIONS).not.toContain('canteen:create');
  });
});
