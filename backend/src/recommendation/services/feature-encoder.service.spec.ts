import { Test, TestingModule } from '@nestjs/testing';
import { FeatureEncoderService } from './feature-encoder.service';
import { DishFeatures, UserFeatures } from '../interfaces';

describe('FeatureEncoderService', () => {
  let service: FeatureEncoderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureEncoderService],
    }).compile();

    service = module.get<FeatureEncoderService>(FeatureEncoderService);
  });

  describe('getDimension', () => {
    it('should return 128', () => {
      expect(service.getDimension()).toBe(128);
    });
  });

  describe('encodeDishFeatures', () => {
    it('should encode basic dish features', () => {
      const dish: DishFeatures = {
        name: '宫保鸡丁',
        tags: ['川菜', '辣'],
        ingredients: ['鸡肉', '花生'],
        allergens: [],
        spicyLevel: 3,
        sweetness: 1,
        saltiness: 2,
        oiliness: 2,
        price: 15,
        averageRating: 4.5,
        reviewCount: 100,
        canteenId: 'canteen-1',
      };

      const vector = service.encodeDishFeatures(dish);

      expect(vector).toHaveLength(128);
      expect(vector.every((v) => !isNaN(v))).toBe(true);
    });

    it('should handle dish with empty arrays', () => {
      const dish: DishFeatures = {
        name: '简单菜品',
        tags: [],
        ingredients: [],
        allergens: [],
        spicyLevel: 0,
        sweetness: 0,
        saltiness: 0,
        oiliness: 0,
        price: 10,
        averageRating: 3.0,
        reviewCount: 0,
        canteenId: null as any,
      };

      const vector = service.encodeDishFeatures(dish);

      expect(vector).toHaveLength(128);
    });

    it('should handle dish with many tags', () => {
      const dish: DishFeatures = {
        name: '多标签菜品',
        tags: ['川菜', '辣', '下饭', '招牌', '热门', '特色', '经典'],
        ingredients: ['鸡肉', '花生', '辣椒', '葱', '姜', '蒜'],
        allergens: ['花生'],
        spicyLevel: 4,
        sweetness: 2,
        saltiness: 3,
        oiliness: 3,
        price: 25,
        averageRating: 4.8,
        reviewCount: 500,
        canteenId: 'canteen-1',
      };

      const vector = service.encodeDishFeatures(dish);

      expect(vector).toHaveLength(128);
      // Vector should be normalized
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    });

    it('should produce different vectors for different dishes', () => {
      const dish1: DishFeatures = {
        name: '宫保鸡丁',
        tags: ['川菜'],
        ingredients: ['鸡肉'],
        allergens: [],
        spicyLevel: 4,
        sweetness: 1,
        saltiness: 2,
        oiliness: 2,
        price: 15,
        averageRating: 4.5,
        reviewCount: 100,
        canteenId: 'canteen-1',
      };

      const dish2: DishFeatures = {
        name: '清蒸鱼',
        tags: ['粤菜'],
        ingredients: ['鱼'],
        allergens: [],
        spicyLevel: 0,
        sweetness: 1,
        saltiness: 2,
        oiliness: 1,
        price: 30,
        averageRating: 4.2,
        reviewCount: 50,
        canteenId: 'canteen-2',
      };

      const vector1 = service.encodeDishFeatures(dish1);
      const vector2 = service.encodeDishFeatures(dish2);

      // Vectors should be different
      const diff = vector1.some((v, i) => v !== vector2[i]);
      expect(diff).toBe(true);
    });
  });

  describe('encodeUserFeatures', () => {
    it('should encode basic user features', () => {
      const user: UserFeatures = {
        userId: 'user-1',
        preferences: {
          spicyLevel: 3,
          sweetness: 2,
          saltiness: 2,
          oiliness: 2,
          priceMin: 10,
          priceMax: 30,
          tagPreferences: ['川菜'],
          meatPreference: ['鸡肉'],
          favoriteIngredients: [],
          avoidIngredients: [],
          canteenPreferences: [],
        },
        allergens: [],
        favoriteFeatures: {
          dishIds: new Set(['dish-1']),
          canteenIds: new Set(['canteen-1']),
          tagWeights: new Map([['川菜', 1]]),
          ingredients: ['鸡肉'],
          avgSpicyLevel: 3,
          avgSweetness: 2,
          avgSaltiness: 2,
          avgOiliness: 2,
          avgPrice: 20,
        },
        browseFeatures: {
          recentDishIds: new Set(['dish-2']),
          tagWeights: new Map([['川菜', 0.5]]),
        },
      };

      const vector = service.encodeUserFeatures(user);

      expect(vector).toHaveLength(128);
      expect(vector.every((v) => !isNaN(v))).toBe(true);
    });

    it('should handle user with allergens (negative weights)', () => {
      const user: UserFeatures = {
        userId: 'user-2',
        preferences: {
          spicyLevel: 2,
          sweetness: 2,
          saltiness: 2,
          oiliness: 2,
          priceMin: 10,
          priceMax: 30,
          tagPreferences: [],
          meatPreference: [],
          favoriteIngredients: [],
          avoidIngredients: ['辣椒'],
          canteenPreferences: [],
        },
        allergens: ['花生', '海鲜'],
        favoriteFeatures: {
          dishIds: new Set(),
          canteenIds: new Set(),
          tagWeights: new Map(),
          ingredients: [],
          avgSpicyLevel: 0,
          avgSweetness: 0,
          avgSaltiness: 0,
          avgOiliness: 0,
          avgPrice: 0,
        },
        browseFeatures: {
          recentDishIds: new Set(),
          tagWeights: new Map(),
        },
      };

      const vector = service.encodeUserFeatures(user);

      expect(vector).toHaveLength(128);
      // Should contain some negative values due to allergens
      const hasNegative = vector.some((v) => v < 0);
      expect(hasNegative).toBe(true);
    });

    it('should handle empty user features', () => {
      const user: UserFeatures = {
        userId: 'user-3',
        preferences: null as any,
        allergens: [],
        favoriteFeatures: {
          dishIds: new Set(),
          canteenIds: new Set(),
          tagWeights: new Map(),
          ingredients: [],
          avgSpicyLevel: 0,
          avgSweetness: 0,
          avgSaltiness: 0,
          avgOiliness: 0,
          avgPrice: 0,
        },
        browseFeatures: {
          recentDishIds: new Set(),
          tagWeights: new Map(),
        },
      };

      const vector = service.encodeUserFeatures(user);

      expect(vector).toHaveLength(128);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [0.5, 0.5, 0.5, 0.5];
      // Normalize
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      const normalized = vector.map((v) => v / norm);

      const similarity = service.cosineSimilarity(normalized, normalized);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vector1 = [1, 0, 0, 0];
      const vector2 = [0, 1, 0, 0];

      const similarity = service.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should return 0 for empty vectors', () => {
      const similarity = service.cosineSimilarity([], []);

      expect(similarity).toBe(0);
    });

    it('should return 0 for null vectors', () => {
      const similarity = service.cosineSimilarity(null as any, [1, 2, 3]);

      expect(similarity).toBe(0);
    });

    it('should return 0 for vectors of different lengths', () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2];

      const similarity = service.cosineSimilarity(vector1, vector2);

      expect(similarity).toBe(0);
    });

    it('should compute similarity between dish and user vectors', () => {
      const dish: DishFeatures = {
        name: '宫保鸡丁',
        tags: ['川菜', '辣'],
        ingredients: ['鸡肉'],
        allergens: [],
        spicyLevel: 4,
        sweetness: 1,
        saltiness: 2,
        oiliness: 2,
        price: 15,
        averageRating: 4.5,
        reviewCount: 100,
        canteenId: 'canteen-1',
      };

      const user: UserFeatures = {
        userId: 'user-1',
        preferences: {
          spicyLevel: 4,
          sweetness: 1,
          saltiness: 2,
          oiliness: 2,
          priceMin: 10,
          priceMax: 20,
          tagPreferences: ['川菜'],
          meatPreference: ['鸡肉'],
          favoriteIngredients: [],
          avoidIngredients: [],
          canteenPreferences: ['canteen-1'],
        },
        allergens: [],
        favoriteFeatures: {
          dishIds: new Set(),
          canteenIds: new Set(['canteen-1']),
          tagWeights: new Map([['川菜', 1]]),
          ingredients: ['鸡肉'],
          avgSpicyLevel: 4,
          avgSweetness: 1,
          avgSaltiness: 2,
          avgOiliness: 2,
          avgPrice: 15,
        },
        browseFeatures: {
          recentDishIds: new Set(),
          tagWeights: new Map(),
        },
      };

      const dishVector = service.encodeDishFeatures(dish);
      const userVector = service.encodeUserFeatures(user);

      const similarity = service.cosineSimilarity(dishVector, userVector);

      // Should have positive similarity (user likes spicy Sichuan food)
      expect(similarity).toBeGreaterThan(0);
    });
  });
});
