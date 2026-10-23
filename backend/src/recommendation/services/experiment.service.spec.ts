import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentService } from './experiment.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './cache.service';

describe('ExperimentService', () => {
  let service: ExperimentService;
  let prisma: jest.Mocked<Partial<PrismaService>>;
  let cacheService: jest.Mocked<
    Pick<
      RecommendationCacheService,
      | 'getUserExperimentGroup'
      | 'setUserExperimentGroup'
      | 'getExperimentGroupItemWeights'
      | 'setExperimentGroupItemWeights'
    >
  >;

  const mockExperiment = {
    id: 'exp-1',
    name: 'Test Experiment',
    description: 'Test description',
    status: 'running',
    trafficRatio: 0.5,
    startTime: new Date('2025-01-01'),
    endTime: new Date('2027-12-31'),
    groupItems: [
      {
        id: 'group-1',
        name: 'Control',
        ratio: 0.5,
        config: { weights: { preferenceMatch: 0.3 } },
      },
      {
        id: 'group-2',
        name: 'Treatment',
        ratio: 0.5,
        config: { weights: { preferenceMatch: 0.7 } },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      experiment: {
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
      userExperimentAssignment: {
        findMany: jest.fn(),
      } as any,
      $queryRaw: jest.fn().mockResolvedValue([{ groupItemId: 'group-1' }]),
    };

    cacheService = {
      getUserExperimentGroup: jest.fn(),
      setUserExperimentGroup: jest.fn(),
      getExperimentGroupItemWeights: jest.fn(),
      setExperimentGroupItemWeights: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: RecommendationCacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<ExperimentService>(ExperimentService);
  });

  describe('onModuleInit', () => {
    it('should load active experiments on initialization', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);

      await service.onModuleInit();

      expect(prisma.experiment!.findMany).toHaveBeenCalled();
    });
  });

  describe('refreshActiveExperiments', () => {
    it('queues a later committed state behind a delayed database response', async () => {
      let releaseFirst!: (value: unknown[]) => void;
      (prisma.experiment!.findMany as jest.Mock)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseFirst = resolve;
            }),
        )
        .mockResolvedValueOnce([
          { ...mockExperiment, name: 'Latest committed state' },
        ]);
      const first = service.refreshActiveExperiments();
      await Promise.resolve();
      await Promise.resolve();
      const second = service.refreshActiveExperiments();
      releaseFirst([mockExperiment]);
      await Promise.all([first, second]);
      expect(prisma.experiment!.findMany).toHaveBeenCalledTimes(2);
      expect(service.getActiveExperiments()[0].name).toBe(
        'Latest committed state',
      );
    });

    it('can refresh again after a failed read', async () => {
      (prisma.experiment!.findMany as jest.Mock)
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValueOnce([mockExperiment]);
      await expect(service.refreshActiveExperiments()).rejects.toThrow(
        'database unavailable',
      );
      await expect(service.refreshActiveExperiments()).resolves.toBeUndefined();
      expect(service.getActiveExperiments()).toHaveLength(1);
    });
    it('settles every concurrent caller after refreshing committed changes', async () => {
      jest.useFakeTimers();
      try {
        const resolved: number[] = [];
        const first = service
          .refreshActiveExperiments()
          .then(() => resolved.push(1));
        const second = service
          .refreshActiveExperiments()
          .then(() => resolved.push(2));
        await jest.runAllTimersAsync();
        expect(resolved.sort()).toEqual([1, 2]);
        await Promise.all([first, second]);
      } finally {
        jest.useRealTimers();
      }
    });
    it('should load experiments from database', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);

      await service.refreshActiveExperiments();

      expect(prisma.experiment!.findMany).toHaveBeenCalled();
    });
  });

  describe('requested experiment and invalid stored config', () => {
    it('selects the requested experiment instead of the first active match', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        { ...mockExperiment, trafficRatio: 1 },
        {
          ...mockExperiment,
          id: 'exp-2',
          trafficRatio: 1,
          groupItems: [{ id: 'group-3', name: 'Second', ratio: 1, config: {} }],
        },
      ]);
      cacheService.getUserExperimentGroup.mockImplementation(
        async (_user, id) => (id === 'exp-2' ? 'group-3' : 'group-1'),
      );
      const result = await service.assignUserToExperiment(
        'user',
        undefined,
        'exp-2',
      );
      expect(result).toMatchObject({
        experimentId: 'exp-2',
        groupItemId: 'group-3',
      });
      expect(cacheService.getUserExperimentGroup).toHaveBeenCalledTimes(1);
    });

    it('returns no assignment for an inactive explicit target', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        { ...mockExperiment, trafficRatio: 1 },
      ]);
      expect(
        await service.assignUserToExperiment('user', undefined, 'missing'),
      ).toBeNull();
      expect(cacheService.getUserExperimentGroup).not.toHaveBeenCalled();
    });

    it('uses a complete baseline when stored quota is invalid even if weights are valid', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockExperiment,
          trafficRatio: 1,
          groupItems: [
            {
              id: 'group-1',
              name: 'Legacy',
              ratio: 1,
              config: {
                weights: { dishQuality: 99 },
                recallQuota: { vectorQuota: 1 },
              },
            },
          ],
        },
      ]);
      cacheService.getUserExperimentGroup.mockResolvedValue('group-1');
      const result = await service.assignUserToExperiment('user');
      expect(result).toMatchObject({
        configFallback: true,
        resolvedWeights: service.getDefaultWeights(),
      });
      expect(result?.weights).toBeUndefined();
      expect(result?.recallQuota).toBeUndefined();
    });
  });

  describe('getActiveExperiments', () => {
    it('should return empty array when no experiments', () => {
      const result = service.getActiveExperiments();

      expect(result).toEqual([]);
    });

    it('should return loaded experiments', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);

      await service.onModuleInit();
      const result = service.getActiveExperiments();

      expect(result.length).toBe(1);
      expect(result[0].experimentId).toBe('exp-1');
    });
  });

  describe('assignUserToExperiment', () => {
    beforeEach(async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);
      await service.onModuleInit();
    });

    it('should return null when no active experiments', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([]);
      await service.refreshActiveExperiments();

      const result = await service.assignUserToExperiment('user-1');

      expect(result).toBeNull();
    });

    it('observes experiment changes committed and refreshed by another process', async () => {
      const adminProcess = new ExperimentService(
        prisma as PrismaService,
        cacheService as unknown as RecommendationCacheService,
      );
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([]);
      await service.refreshActiveExperiments();
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        { ...mockExperiment, trafficRatio: 1 },
      ]);
      cacheService.getUserExperimentGroup.mockResolvedValue('group-1');
      await adminProcess.refreshActiveExperiments();

      expect(await service.assignUserToExperiment('user-1')).toMatchObject({
        experimentId: 'exp-1',
        groupItemId: 'group-1',
      });

      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([]);
      await adminProcess.refreshActiveExperiments();
      expect(await service.assignUserToExperiment('user-1')).toBeNull();
    });

    it('uses committed group weights instead of stale shared weight cache', async () => {
      cacheService.getUserExperimentGroup.mockResolvedValue('group-1');
      cacheService.getExperimentGroupItemWeights.mockResolvedValue({
        ...service.getDefaultWeights(),
        preferenceMatch: 0.1,
      });
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockExperiment,
          trafficRatio: 1,
          groupItems: [
            {
              ...mockExperiment.groupItems[0],
              config: { weights: { preferenceMatch: 0.8 } },
            },
          ],
        },
      ]);

      const result = await service.assignUserToExperiment('user-1');

      expect(result?.resolvedWeights.preferenceMatch).toBe(0.8);
    });

    it('should return cached assignment', async () => {
      cacheService.getUserExperimentGroup.mockResolvedValue('group-1');
      cacheService.getExperimentGroupItemWeights.mockResolvedValue({
        preferenceMatch: 0.3,
        favoriteSimilarity: 0.2,
        browseRelevance: 0.15,
        dishQuality: 0.2,
        diversity: 0.1,
        searchRelevance: 0.05,
      });

      const result = await service.assignUserToExperiment('user-1');

      expect(result).toBeDefined();
      expect(result!.groupItemId).toBe('group-1');
      expect(cacheService.getUserExperimentGroup).toHaveBeenCalledWith(
        'user-1',
        'exp-1',
      );
    });

    it('should load assignment from database if not in cache', async () => {
      cacheService.getUserExperimentGroup.mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { groupItemId: 'group-2' },
      ]);
      cacheService.getExperimentGroupItemWeights.mockResolvedValue({
        preferenceMatch: 0.7,
        favoriteSimilarity: 0.2,
        browseRelevance: 0.15,
        dishQuality: 0.2,
        diversity: 0.1,
        searchRelevance: 0.05,
      });

      const result = await service.assignUserToExperiment('user-1');

      expect(result).toBeDefined();
      expect(result!.groupItemId).toBe('group-2');
      expect(cacheService.setUserExperimentGroup).toHaveBeenCalledWith(
        'user-1',
        'exp-1',
        'group-2',
      );
    });

    it('should create new assignment for new user', async () => {
      cacheService.getUserExperimentGroup.mockResolvedValue(null);
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        { ...mockExperiment, trafficRatio: 1 },
      ]);
      const result = await service.assignUserToExperiment('new-user');

      expect(result).toMatchObject({ groupItemId: 'group-1' });
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('shouldUserParticipate', () => {
    it('should use consistent hashing', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);
      await service.onModuleInit();

      const config = service.getActiveExperiments()[0];

      // Same user should get same result
      const result1 = service['shouldUserParticipate']('user-1', config);
      const result2 = service['shouldUserParticipate']('user-1', config);

      expect(result1).toBe(result2);
    });

    it('should distribute users based on traffic ratio', async () => {
      const experimentWithFullTraffic = {
        ...mockExperiment,
        trafficRatio: 1.0,
      };
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        experimentWithFullTraffic,
      ]);
      await service.onModuleInit();

      const config = service.getActiveExperiments()[0];

      // All users should participate with 100% traffic
      const result = service['shouldUserParticipate']('any-user', config);
      expect(result).toBe(true);
    });

    it('should exclude users when traffic is 0', async () => {
      const experimentWithNoTraffic = {
        ...mockExperiment,
        trafficRatio: 0,
      };
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        experimentWithNoTraffic,
      ]);
      await service.onModuleInit();

      const config = service.getActiveExperiments()[0];

      const result = service['shouldUserParticipate']('any-user', config);
      expect(result).toBe(false);
    });
  });

  describe('getUserExperiments', () => {
    it('should return user experiment assignments', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);
      await service.onModuleInit();

      (
        prisma.userExperimentAssignment!.findMany as jest.Mock
      ).mockResolvedValue([
        {
          userId: 'user-1',
          experimentId: 'exp-1',
          groupItemId: 'group-1',
        },
      ]);

      const result = await service.getUserExperiments('user-1');

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({
        experimentId: 'exp-1',
        experimentName: 'Test Experiment',
        groupItemId: 'group-1',
        groupItemName: 'Control',
      });
    });

    it('should return empty array when user has no assignments', async () => {
      (
        prisma.userExperimentAssignment!.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.getUserExperiments('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getDefaultWeights', () => {
    it('should return default recommendation weights', () => {
      const weights = service.getDefaultWeights();

      expect(weights).toHaveProperty('preferenceMatch');
      expect(weights).toHaveProperty('favoriteSimilarity');
      expect(weights).toHaveProperty('browseRelevance');
      expect(weights).toHaveProperty('dishQuality');
      expect(weights).toHaveProperty('diversity');
      expect(weights).toHaveProperty('searchRelevance');
    });
  });
});
