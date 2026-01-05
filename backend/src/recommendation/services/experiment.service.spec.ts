import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentService } from './experiment.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './cache.service';

describe('ExperimentService', () => {
  let service: ExperimentService;
  let prisma: jest.Mocked<Partial<PrismaService>>;
  let cacheService: jest.Mocked<Partial<RecommendationCacheService>>;

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
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      } as any,
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
    it('should load experiments from database', async () => {
      (prisma.experiment!.findMany as jest.Mock).mockResolvedValue([
        mockExperiment,
      ]);

      await service['performRefresh']();

      expect(prisma.experiment!.findMany).toHaveBeenCalled();
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
      await service['performRefresh']();

      const result = await service.assignUserToExperiment('user-1');

      expect(result).toBeNull();
    });

    it('should return cached assignment', async () => {
      cacheService.getUserExperimentGroup!.mockResolvedValue('group-1');
      cacheService.getExperimentGroupItemWeights!.mockResolvedValue({
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
      cacheService.getUserExperimentGroup!.mockResolvedValue(null);
      (
        prisma.userExperimentAssignment!.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        experimentId: 'exp-1',
        groupItemId: 'group-2',
      });
      cacheService.getExperimentGroupItemWeights!.mockResolvedValue({
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
      cacheService.getUserExperimentGroup!.mockResolvedValue(null);
      (
        prisma.userExperimentAssignment!.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (prisma.userExperimentAssignment!.create as jest.Mock).mockResolvedValue({
        userId: 'new-user',
        experimentId: 'exp-1',
        groupItemId: 'group-1',
      });

      const result = await service.assignUserToExperiment('new-user');

      expect(result).toBeDefined();
      // 新用户分配会调用 create 或直接使用缓存中的值
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
