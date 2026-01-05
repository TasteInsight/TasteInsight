import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './cache.service';
import { FeatureEncoderService } from './feature-encoder.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let prisma: any;
  let cacheService: any;
  let featureEncoder: any;
  let configService: any;

  const mockDish = {
    id: 'dish-1',
    name: '宫保鸡丁',
    description: '经典川菜',
    price: 15,
    spicyLevel: 3,
    tags: ['川菜', '辣'],
    ingredients: ['鸡肉', '花生'],
    allergens: [],
    sweetness: 1,
    saltiness: 2,
    oiliness: 2,
    averageRating: 4.5,
    reviewCount: 100,
    canteenId: 'canteen-1',
    canteen: { name: '第一食堂' },
    window: { name: '川菜窗口' },
  };

  beforeEach(async () => {
    prisma = {
      dish: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      dishEmbedding: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      userEmbedding: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };

    cacheService = {
      getDishEmbedding: jest.fn(),
      setDishEmbedding: jest.fn(),
      getDishEmbeddings: jest.fn(),
      getUserEmbedding: jest.fn(),
      setUserEmbedding: jest.fn(),
      invalidateDishCache: jest.fn(),
      invalidateUserCache: jest.fn(),
    };

    featureEncoder = {
      getDimension: jest.fn().mockReturnValue(128),
      encodeDishFeatures: jest.fn().mockReturnValue(new Array(128).fill(0.1)),
      encodeUserFeatures: jest.fn().mockReturnValue(new Array(128).fill(0.1)),
      cosineSimilarity: jest.fn().mockReturnValue(0.8),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          EXTERNAL_EMBEDDING_SERVICE_ENABLED: 'false',
          EXTERNAL_EMBEDDING_SERVICE_URL: 'http://localhost:5001',
          EXTERNAL_EMBEDDING_SERVICE_EMBEDDING_DIM: 256,
          EMBEDDING_SERVICE_EMBEDDING_DIM: 128,
          EMBEDDING_SERVICE_BATCH_SIZE: 50,
          EXTERNAL_EMBEDDING_SERVICE_VERSION: 'v2',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: RecommendationCacheService,
          useValue: cacheService,
        },
        {
          provide: FeatureEncoderService,
          useValue: featureEncoder,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isExternalServiceAvailable', () => {
    it('should return false when external service is disabled', () => {
      const result = service.isExternalServiceAvailable();
      expect(result).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should always return true (local embedding always available)', () => {
      const result = service.isEnabled();
      expect(result).toBe(true);
    });
  });

  describe('buildDishFeatureText', () => {
    it('should build feature text from dish data', () => {
      const dishFeatures = {
        id: 'dish-1',
        name: '红烧肉',
        tags: ['中餐', '主菜'],
        ingredients: ['猪肉', '酱油'],
        allergens: ['大豆'],
        description: '经典家常菜',
        canteenName: '学生食堂',
        windowName: '中餐窗口',
        price: 15,
        spicyLevel: 2,
      };

      const text = service.buildDishFeatureText(dishFeatures as any);

      expect(text).toContain('菜品: 红烧肉');
      expect(text).toContain('分类: 中餐, 主菜');
      expect(text).toContain('食材: 猪肉, 酱油');
      expect(text).toContain('过敏原: 大豆');
      expect(text).toContain('描述: 经典家常菜');
      expect(text).toContain('食堂: 学生食堂');
      expect(text).toContain('窗口: 中餐窗口');
    });

    it('should handle dish with minimal data', () => {
      const dishFeatures = {
        id: 'dish-1',
        name: '简单菜',
      };

      const text = service.buildDishFeatureText(dishFeatures as any);

      expect(text).toContain('菜品: 简单菜');
    });
  });

  describe('extractDishNumericFeatures', () => {
    it('should extract numeric features from dish', () => {
      const dishFeatures = {
        id: 'dish-1',
        name: '红烧肉',
        price: 15,
        spicyLevel: 2,
        sweetness: 1,
        saltiness: 3,
        oiliness: 4,
        averageRating: 4.5,
        reviewCount: 100,
      };

      const numeric = service.extractDishNumericFeatures(dishFeatures as any);

      expect(numeric.price).toBe(15);
      expect(numeric.spicyLevel).toBe(2);
      expect(numeric.sweetness).toBe(1);
      expect(numeric.saltiness).toBe(3);
      expect(numeric.oiliness).toBe(4);
      expect(numeric.averageRating).toBe(4.5);
      expect(numeric.reviewCount).toBe(100);
    });
  });

  describe('mapToDishFeatures', () => {
    it('should map database dish to DishFeatures', () => {
      const dbDish = {
        id: 'dish-1',
        name: '红烧肉',
        tags: ['中餐'],
        price: 15,
        canteenId: 'canteen-1',
        spicyLevel: 2,
        sweetness: 1,
        saltiness: 3,
        oiliness: 4,
        averageRating: 4.5,
        reviewCount: 100,
      };

      const features = service.mapToDishFeatures(dbDish);

      expect(features.id).toBe('dish-1');
      expect(features.name).toBe('红烧肉');
      expect(features.tags).toEqual(['中餐']);
      expect(features.price).toBe(15);
      expect(features.canteenId).toBe('canteen-1');
    });

    it('should handle null/undefined values with defaults', () => {
      const dbDish = {
        id: 'dish-1',
        name: '红烧肉',
        tags: null,
        price: null,
        canteenId: 'canteen-1',
      };

      const features = service.mapToDishFeatures(dbDish);

      expect(features.tags).toEqual([]);
      expect(features.price).toBe(0);
    });
  });

  describe('generateDishEmbeddingLocal', () => {
    it('should generate local embedding using feature encoder', () => {
      const dish = {
        id: 'dish-1',
        name: '红烧肉',
        tags: ['中餐'],
        price: 15,
        canteenId: 'canteen-1',
      };

      const embedding = service.generateDishEmbeddingLocal(dish);

      expect(embedding).toHaveLength(128);
      expect(featureEncoder.encodeDishFeatures).toHaveBeenCalled();
    });
  });

  describe('updateDishEmbedding', () => {
    it('should return false if dish not found', async () => {
      prisma.dish.findUnique.mockResolvedValue(null);

      const result = await service.updateDishEmbedding('non-existent-dish');

      expect(result).toBe(false);
    });

    it('should update embedding for existing dish', async () => {
      prisma.dish.findUnique.mockResolvedValue(mockDish);

      const result = await service.updateDishEmbedding('dish-1');

      expect(result).toBe(true);
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(cacheService.setDishEmbedding).toHaveBeenCalled();
    });
  });

  describe('updateDishEmbeddingsBatch', () => {
    it('should return 0 for empty dish list', async () => {
      prisma.dish.findMany.mockResolvedValue([]);

      const result = await service.updateDishEmbeddingsBatch(['dish-1']);

      expect(result).toBe(0);
    });

    it('should update embeddings for multiple dishes', async () => {
      prisma.dish.findMany.mockResolvedValue([
        mockDish,
        { ...mockDish, id: 'dish-2', name: '麻婆豆腐' },
      ]);

      const result = await service.updateDishEmbeddingsBatch([
        'dish-1',
        'dish-2',
      ]);

      expect(result).toBe(2);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(cacheService.setDishEmbedding).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateDishEmbeddingsByCanteen', () => {
    it('should update all dishes in canteen', async () => {
      prisma.dish.findMany.mockResolvedValue([
        mockDish,
        { ...mockDish, id: 'dish-2' },
      ]);

      const result = await service.updateDishEmbeddingsByCanteen('canteen-1');

      expect(result).toBe(2);
      expect(prisma.dish.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ canteenId: 'canteen-1' }),
        }),
      );
    });

    it('should call progress callback during processing', async () => {
      prisma.dish.findMany.mockResolvedValue([
        mockDish,
        { ...mockDish, id: 'dish-2' },
      ]);

      const progressCallback = jest.fn();
      await service.updateDishEmbeddingsByCanteen(
        'canteen-1',
        progressCallback,
      );

      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('checkExternalEmbeddingServiceHealth', () => {
    it('should return false when fetch fails', async () => {
      // Mock global fetch to simulate failure
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.checkExternalEmbeddingServiceHealth();

      expect(result).toBe(false);

      global.fetch = originalFetch;
    });

    it('should return true when service is healthy', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const result = await service.checkExternalEmbeddingServiceHealth();

      expect(result).toBe(true);

      global.fetch = originalFetch;
    });

    it('should return false when service returns unhealthy', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'unhealthy' }),
      });

      const result = await service.checkExternalEmbeddingServiceHealth();

      expect(result).toBe(false);

      global.fetch = originalFetch;
    });
  });

  describe('generateHybridEmbedding', () => {
    it('should return null when external service is unavailable', async () => {
      const result = await service.generateHybridEmbedding('test text', {
        price: 10,
        spicyLevel: 2,
      });

      expect(result).toBeNull();
    });
  });

  describe('generateHybridEmbeddingsBatch', () => {
    it('should return null when external service is unavailable', async () => {
      const result = await service.generateHybridEmbeddingsBatch([
        { text: 'test', features: { price: 10 } },
      ]);

      expect(result).toBeNull();
    });

    it('should return null for empty items array', async () => {
      const result = await service.generateHybridEmbeddingsBatch([]);

      expect(result).toBeNull();
    });
  });
  describe('ensureVectorIndexes', () => {
    it('should skip if no embeddings found', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await (service as any).ensureVectorIndexes();
      expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should skip if invalid version', async () => {
      prisma.$queryRaw.mockResolvedValue([{ version: 'unknown', count: 10n }]);
      await (service as any).ensureVectorIndexes();
      expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should create index for found versions', async () => {
      prisma.$queryRaw.mockResolvedValue([{ version: 'v1', count: 10n }]);
      await (service as any).ensureVectorIndexes();
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS'),
      );
    });

    it('should handle index creation error', async () => {
      prisma.$queryRaw.mockResolvedValue([{ version: 'v1', count: 10n }]);
      prisma.$executeRawUnsafe.mockRejectedValue(new Error('Index error'));
      // Should not throw
      await (service as any).ensureVectorIndexes();
    });
  });

  describe('getDishEmbedding', () => {
    const dishId = 'dish-1';

    it('should return cached embedding if available', async () => {
      const cached = { embedding: [0.1], version: 'v1' };
      cacheService.getDishEmbedding.mockResolvedValue(cached);

      const result = await service.getDishEmbedding(dishId);

      expect(result).toEqual(cached);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should fetch from DB if cache miss', async () => {
      cacheService.getDishEmbedding.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([
        {
          id: '1',
          dishId,
          embedding: '[0.1, 0.2]',
          version: 'v1',
        },
      ]);

      const result = await service.getDishEmbedding(dishId);

      expect(result).toEqual({ embedding: [0.1, 0.2], version: 'v1' });
      expect(cacheService.setDishEmbedding).toHaveBeenCalledWith(
        dishId,
        [0.1, 0.2],
        'v1',
      );
    });

    it('should generate if DB miss', async () => {
      cacheService.getDishEmbedding
        .mockResolvedValueOnce(null) // first call
        .mockResolvedValueOnce({ embedding: [0.1], version: 'v1' }); // second call
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.dish.findUnique.mockResolvedValue(mockDish);
      jest.spyOn(service, 'updateDishEmbedding').mockResolvedValue(true);

      const result = await service.getDishEmbedding(dishId);

      expect(service.updateDishEmbedding).toHaveBeenCalledWith(dishId);
      expect(result).toEqual({ embedding: [0.1], version: 'v1' });
    });

    it('should return null if dish not found', async () => {
      cacheService.getDishEmbedding.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.dish.findUnique.mockResolvedValue(null);

      const result = await service.getDishEmbedding(dishId);

      expect(result).toBeNull();
    });
  });

  describe('getDishEmbeddings', () => {
    it('should return empty map for empty input', async () => {
      const result = await service.getDishEmbeddings([]);
      expect(result.size).toBe(0);
    });

    it('should return cached embeddings', async () => {
      const cached = new Map([
        ['d1', { embedding: [0.1], version: 'v1' }],
      ]);
      cacheService.getDishEmbeddings.mockResolvedValue(cached);

      const result = await service.getDishEmbeddings(['d1']);

      expect(result.get('d1')).toEqual(cached.get('d1'));
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should fetch missing embeddings from DB', async () => {
      const cached = new Map();
      cacheService.getDishEmbeddings.mockResolvedValue(cached);
      prisma.$queryRaw.mockResolvedValue([
        {
          id: '1',
          dishId: 'd1',
          embedding: '[0.1]',
          version: 'v1',
        },
      ]);

      const result = await service.getDishEmbeddings(['d1']);

      expect(result.get('d1')).toEqual({ embedding: [0.1], version: 'v1' });
      expect(cacheService.setDishEmbedding).toHaveBeenCalled();
    });
  });

  describe('generateHybridEmbedding (Enabled)', () => {
    it('should return embedding when external service is enabled and healthy', async () => {
      jest.spyOn(service, 'isExternalServiceAvailable').mockReturnValue(true);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });
      global.fetch = mockFetch;

      const result = await service.generateHybridEmbedding('text', {} as any);

      expect(result).toEqual([0.1, 0.2]);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      jest.spyOn(service, 'isExternalServiceAvailable').mockReturnValue(true);
      global.fetch = jest.fn().mockRejectedValue(new Error('Fetch error'));

      const result = await service.generateHybridEmbedding('text', {} as any);

      expect(result).toBeNull();
    });
  });

  describe('User Features', () => {
    it('should build user feature text', () => {
      const userFeatures = {
        preferences: {
          tagPreferences: ['川菜'],
          priceMin: 10,
          priceMax: 30,
          meatPreference: ['鸡肉'],
          favoriteIngredients: ['辣椒'],
          avoidIngredients: ['香菜'],
          spicyLevel: 3,
          sweetness: 1,
          saltiness: 2,
          oiliness: 2,
          canteenPreferences: ['第一食堂'],
          portionSize: 'large',
        },
        favoriteFeatures: {
          tagWeights: new Map([['辣', 0.8]]),
          canteenIds: new Set(['c1']),
          ingredients: new Set(['肉']),
          avgSpicyLevel: 2.5,
          avgSweetness: 1,
          avgSaltiness: 2,
          avgOiliness: 2,
          avgPrice: 20,
          dishIds: new Set(['d1']),
        },
        browseFeatures: {
          tagWeights: new Map([['面食', 0.5]]),
          canteenWeights: new Map([['c2', 0.6]]),
          recentDishIds: new Set(['d2']),
        },
        allergens: ['花生'],
      };

      const text = service.buildUserFeatureText(userFeatures as any);

      expect(text).toContain('偏好菜系: 川菜');
      expect(text).toContain('价格偏好: 10 - 30');
      expect(text).toContain('肉类偏好: 鸡肉');
      expect(text).toContain('常收藏标签: 辣');
      expect(text).toContain('常吃辣度2.5级');
      expect(text).toContain('最近浏览标签: 面食');
      expect(text).toContain('过敏原: 花生');
    });

    it('should extract user numeric features', () => {
      const userFeatures = {
        preferences: {
          priceMin: 10,
          priceMax: 30,
          spicyLevel: 4,
          sweetness: 2,
          saltiness: 3,
          oiliness: 3,
        },
        favoriteFeatures: {
          avgPrice: 25,
          avgSpicyLevel: 3,
          avgSweetness: 2,
          avgSaltiness: 3,
          avgOiliness: 3,
        },
      };

      const numeric = (service as any).extractUserNumericFeatures(
        userFeatures as any,
      );

      // (20 * 0.7) + (25 * 0.3) = 14 + 7.5 = 21.5
      expect(numeric.price).toBeCloseTo(21.5);
      // (4 * 0.7) + (3 * 0.3) = 2.8 + 0.9 = 3.7
      expect(numeric.spicyLevel).toBeCloseTo(3.7);
    });

    it('should build user embedding local', () => {
      const userFeatures = {
        preferences: { priceMin: 0 },
      };
      const embedding = (service as any).buildUserEmbeddingLocal(userFeatures);
      expect(embedding).toHaveLength(128);
      expect(featureEncoder.encodeUserFeatures).toHaveBeenCalledWith(
        userFeatures,
      );
    });
  });
});
