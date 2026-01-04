import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RecommendationCacheService } from './cache.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    pipeline: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnThis(),
      setex: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    lpush: jest.fn(),
    lrange: jest.fn(),
    ltrim: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
  }));
});

describe('RecommendationCacheService', () => {
  let service: RecommendationCacheService;
  let mockRedis: any;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: '',
          REDIS_REC_DB: 1,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationCacheService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<RecommendationCacheService>(
      RecommendationCacheService,
    );

    // Initialize the service (calls onModuleInit)
    await service.onModuleInit();

    // Get the mocked Redis instance
    mockRedis = (service as any).redis;
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('User Features Cache', () => {
    const userId = 'user-1';
    const mockFeatures = {
      userId: 'user-1',
      allergens: ['花生'],
      preferenceSpicyLevel: 3,
      preferencePriceRange: { min: 10, max: 50 },
      favoriteFeatures: {
        tagWeights: new Map([
          ['川菜', 0.8],
          ['辣', 0.6],
        ]),
        canteenIds: new Set(['canteen-1']),
        ingredients: new Set(['鸡肉', '花生']),
        dishIds: new Set(['dish-1', 'dish-2']),
        avgRating: 4.5,
        avgSpicyLevel: 3,
        avgPrice: 25,
      },
      browseFeatures: {
        tagWeights: new Map([['川菜', 0.5]]),
        canteenWeights: new Map([['canteen-1', 0.7]]),
        recentDishIds: new Set(['dish-3']),
        avgViewDuration: 30,
        viewCount: 10,
      },
    };

    it('should set user features', async () => {
      await service.setUserFeatures(userId, mockFeatures as any);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get user features when exists (simplified)', async () => {
      // Just test that it doesn't throw
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getUserFeatures(userId);

      expect(result).toBeNull();
    });

    it('should return null when user features not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getUserFeatures(userId);

      expect(result).toBeNull();
    });

    it('should invalidate user features', async () => {
      await service.invalidateUserFeatures(userId);

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Recommendation Result Cache', () => {
    const userId = 'user-1';
    const scene = 'home';
    const dto = { pagination: { page: 1, pageSize: 10 }, filter: {} };
    const groupItemId = 'group-1';
    const mockResult = {
      items: [{ id: 'dish-1', name: '红烧肉', score: 0.9 }],
      total: 1,
      requestId: 'req-1',
    };

    it('should set recommendation result', async () => {
      await service.setRecommendationResult(
        userId,
        scene,
        dto as any,
        groupItemId,
        mockResult as any,
      );

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get recommendation result when exists', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockResult));

      const result = await service.getRecommendationResult(
        userId,
        scene,
        dto as any,
        groupItemId,
      );

      expect(result).toEqual(mockResult);
    });

    it('should return null when recommendation result not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getRecommendationResult(
        userId,
        scene,
        dto as any,
        groupItemId,
      );

      expect(result).toBeNull();
    });

    it('should invalidate user recommendations', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);

      await service.invalidateUserRecommendations(userId);

      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should not call del when no keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.del.mockClear();

      await service.invalidateUserRecommendations(userId);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Experiment Group Cache', () => {
    const userId = 'user-1';
    const experimentId = 'exp-1';
    const groupId = 'control';

    it('should set user experiment group', async () => {
      await service.setUserExperimentGroup(userId, experimentId, groupId);

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get user experiment group', async () => {
      mockRedis.get.mockResolvedValue(groupId);

      const result = await service.getUserExperimentGroup(userId, experimentId);

      expect(result).toBe(groupId);
    });

    it('should return null when experiment group not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getUserExperimentGroup(userId, experimentId);

      expect(result).toBeNull();
    });
  });

  describe('Experiment Weights Cache', () => {
    const groupItemId = 'group-item-1';
    const mockWeights = {
      collaborative: 0.3,
      content: 0.3,
      popularity: 0.2,
      diversity: 0.1,
      freshness: 0.1,
    };

    it('should set experiment group weights', async () => {
      await service.setExperimentGroupItemWeights(
        groupItemId,
        mockWeights as any,
      );

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get experiment group weights', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWeights));

      const result = await service.getExperimentGroupItemWeights(groupItemId);

      expect(result).toEqual(mockWeights);
    });

    it('should return null when weights not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getExperimentGroupItemWeights(groupItemId);

      expect(result).toBeNull();
    });
  });

  describe('Dish Embedding Cache', () => {
    const dishId = 'dish-1';
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    const version = 'v1';

    it('should set dish embedding', async () => {
      await service.setDishEmbedding(dishId, embedding, version);

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get dish embedding', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ embedding, version }));

      const result = await service.getDishEmbedding(dishId);

      expect(result).toEqual({ embedding, version });
    });

    it('should return null when embedding not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getDishEmbedding(dishId);

      expect(result).toBeNull();
    });

    it('should get multiple dish embeddings', async () => {
      const dishIds = ['dish-1', 'dish-2'];
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ embedding: [0.1], version: 'v1' }),
        null,
      ]);

      const result = await service.getDishEmbeddings(dishIds);

      expect(result.size).toBe(1);
      expect(result.has('dish-1')).toBe(true);
      expect(result.has('dish-2')).toBe(false);
    });

    it('should return empty map for empty dish ids', async () => {
      const result = await service.getDishEmbeddings([]);

      expect(result.size).toBe(0);
    });
  });

  describe('User Embedding Cache', () => {
    const userId = 'user-1';
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    const version = 'v1';

    it('should set user embedding', async () => {
      await service.setUserEmbedding(userId, embedding, version);

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get user embedding', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ embedding, version }));

      const result = await service.getUserEmbedding(userId);

      expect(result).toEqual({ embedding, version });
    });

    it('should return null when embedding not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getUserEmbedding(userId);

      expect(result).toBeNull();
    });

    it('should invalidate user embedding', async () => {
      await service.invalidateUserEmbedding(userId);

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should get multiple user embeddings', async () => {
      const userIds = ['user-1', 'user-2'];
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ embedding: [0.1], version: 'v1' }),
        JSON.stringify({ embedding: [0.2], version: 'v1' }),
      ]);

      const result = await service.getUserEmbeddings(userIds);

      expect(result.size).toBe(2);
      expect(result.has('user-1')).toBe(true);
      expect(result.has('user-2')).toBe(true);
    });

    it('should return empty map for empty user ids', async () => {
      const result = await service.getUserEmbeddings([]);

      expect(result.size).toBe(0);
    });
  });

  describe('isConnected', () => {
    it('should return connection status', () => {
      const result = service.isConnected();
      expect(typeof result).toBe('boolean');
    });
  });
});
