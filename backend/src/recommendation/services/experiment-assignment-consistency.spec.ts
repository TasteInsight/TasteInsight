import { ExperimentService } from './experiment.service';

type Group = { id: string; name: string; ratio: number; config?: unknown };
type Assignment = { userId: string; experimentId: string; groupItemId: string };

function fixture() {
  const state = {
    groups: [
      { id: 'group-a', name: 'A', ratio: 1 },
      { id: 'group-b', name: 'B', ratio: 0 },
    ] as Group[],
    assignment: null as Assignment | null,
    cachedGroup: null as string | null,
  };
  const experiment = () => ({
    id: 'experiment',
    name: 'Experiment',
    status: 'running',
    trafficRatio: 1,
    startTime: new Date('2025-01-01'),
    endTime: null,
    groupItems: state.groups.map((group) => ({ ...group })),
  });
  const prisma = {
    experiment: { findMany: jest.fn(async () => [experiment()]) },
    userExperimentAssignment: {
      findUnique: jest.fn(async () => state.assignment),
      create: jest.fn(async ({ data }: { data: Assignment }) => {
        if (state.assignment) {
          throw Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
          });
        }
        state.assignment = { ...data };
        return state.assignment;
      }),
    },
    $queryRaw: jest.fn(
      async (sql: TemplateStringsArray, ...values: string[]) => {
        const statement = sql.join('?').replace(/\s+/g, ' ').trim();
        expect(statement).toBe(
          `INSERT INTO "user_experiment_assignments" AS assignment
            ("id", "userId", "experimentId", "groupItemId", "assignedAt")
           SELECT ?, ?, ?, ?, NOW()
           WHERE EXISTS (
             SELECT 1 FROM "experiment_group_items"
             WHERE "id" = ? AND "experimentId" = ?
           )
           ON CONFLICT ("userId", "experimentId") DO UPDATE
           SET "groupItemId" = CASE WHEN EXISTS (
             SELECT 1 FROM "experiment_group_items" AS current_group
             WHERE current_group."id" = assignment."groupItemId"
               AND current_group."experimentId" = assignment."experimentId"
           ) THEN assignment."groupItemId" ELSE EXCLUDED."groupItemId" END
           RETURNING "groupItemId"`
            .replace(/\s+/g, ' ')
            .trim(),
        );
        const [, userId, experimentId, proposedGroup] = values;
        expect(values.slice(4)).toEqual([proposedGroup, experimentId]);
        if (!state.groups.some(({ id }) => id === proposedGroup)) return [];
        if (
          !state.assignment ||
          !state.groups.some(({ id }) => id === state.assignment?.groupItemId)
        ) {
          state.assignment = {
            userId,
            experimentId,
            groupItemId: proposedGroup,
          };
        }
        return [{ groupItemId: state.assignment.groupItemId }];
      },
    ),
  };
  const cache = {
    getUserExperimentGroup: jest.fn(async () => state.cachedGroup),
    setUserExperimentGroup: jest.fn(
      async (_userId: string, _experimentId: string, groupItemId: string) => {
        state.cachedGroup = groupItemId;
      },
    ),
    getExperimentGroupItemWeights: jest.fn().mockResolvedValue(null),
    setExperimentGroupItemWeights: jest.fn(),
  };
  return {
    state,
    prisma,
    cache,
    experiment,
    process: () => new ExperimentService(prisma as any, cache as any),
  };
}

describe('persisted experiment assignment consistency', () => {
  it.each(['removed-group', null])(
    'repairs an orphaned database assignment with cached group %s',
    async (cachedGroup) => {
      const f = fixture();
      f.state.cachedGroup = cachedGroup;
      f.state.assignment = {
        userId: 'user',
        experimentId: 'experiment',
        groupItemId: 'removed-group',
      };

      const assigned = await f.process().assignUserToExperiment('user');

      expect(assigned?.groupItemId).toBe('group-a');
      expect(f.state.assignment.groupItemId).toBe('group-a');
      expect(f.state.cachedGroup).toBe('group-a');
    },
  );

  it('replaces stale cache with the persisted valid group without rebalancing it', async () => {
    const f = fixture();
    f.state.cachedGroup = 'removed-group';
    f.state.assignment = {
      userId: 'user',
      experimentId: 'experiment',
      groupItemId: 'group-b',
    };

    const assigned = await f.process().assignUserToExperiment('user');

    expect(assigned?.groupItemId).toBe('group-b');
    expect(f.state.assignment.groupItemId).toBe('group-b');
    expect(f.state.cachedGroup).toBe('group-b');
  });

  it('keeps a valid cached assignment while applying edited group configuration', async () => {
    const f = fixture();
    f.state.cachedGroup = 'group-b';
    f.state.assignment = {
      userId: 'user',
      experimentId: 'experiment',
      groupItemId: 'group-b',
    };
    f.state.groups[1] = {
      id: 'group-b',
      name: 'Renamed group',
      ratio: 0,
      config: { weights: { preferenceMatch: 0.75 } },
    };

    const assigned = await f.process().assignUserToExperiment('user');

    expect(assigned).toMatchObject({
      groupItemId: 'group-b',
      name: 'Renamed group',
      resolvedWeights: { preferenceMatch: 0.75 },
    });
    expect(f.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns the same persisted winner to concurrent first assignments from separate processes', async () => {
    const f = fixture();
    const firstSnapshot = f.experiment();
    const secondSnapshot = {
      ...f.experiment(),
      groupItems: [
        { id: 'group-a', name: 'A', ratio: 0 },
        { id: 'group-b', name: 'B', ratio: 1 },
      ],
    };
    f.prisma.experiment.findMany
      .mockResolvedValueOnce([firstSnapshot])
      .mockResolvedValueOnce([secondSnapshot]);
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => (releaseReads = resolve));
    let readCount = 0;
    f.prisma.userExperimentAssignment.findUnique.mockImplementation(
      async () => {
        const snapshot = f.state.assignment;
        if (++readCount === 2) releaseReads();
        await bothRead;
        return snapshot;
      },
    );

    const assignments = await Promise.all([
      f.process().assignUserToExperiment('user'),
      f.process().assignUserToExperiment('user'),
    ]);

    expect(assignments.map((assignment) => assignment?.groupItemId)).toEqual([
      'group-a',
      'group-a',
    ]);
    expect(f.state.assignment?.groupItemId).toBe('group-a');
    expect(f.state.cachedGroup).toBe('group-a');
  });

  it('does not persist a proposed group removed between definition read and assignment', async () => {
    const f = fixture();
    f.cache.getUserExperimentGroup.mockImplementationOnce(async () => {
      f.state.groups = [];
      return null;
    });

    expect(await f.process().assignUserToExperiment('user')).toBeNull();
    expect(f.state.assignment).toBeNull();
    expect(f.cache.setUserExperimentGroup).not.toHaveBeenCalled();
  });

  it('does not assign an experiment with no remaining groups', async () => {
    const f = fixture();
    f.state.groups = [];

    expect(await f.process().assignUserToExperiment('user')).toBeNull();
    expect(f.state.assignment).toBeNull();
    expect(f.cache.setUserExperimentGroup).not.toHaveBeenCalled();
  });
});
