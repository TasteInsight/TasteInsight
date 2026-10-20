import { Prisma } from '@prisma/client';
import { selfAndDescendantAdminIds } from './admin-hierarchy';

describe('admin hierarchy', () => {
  it('uses a recursive, parameterized traversal that includes retired intermediate admins', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        { id: 'self' },
        { id: 'child' },
        { id: 'grandchild' },
      ]);
    const ids = await selfAndDescendantAdminIds(
      { $queryRaw: query } as unknown as Prisma.TransactionClient,
      'self',
    );
    expect(ids).toEqual(['self', 'child', 'grandchild']);
    const [sql] = query.mock.calls[0];
    expect(sql.values).toEqual(['self']);
    expect(sql.text).toContain('WITH RECURSIVE');
    expect(sql.text).toContain('UNION');
    expect(sql.text).not.toContain('deletedAt');
  });
});
