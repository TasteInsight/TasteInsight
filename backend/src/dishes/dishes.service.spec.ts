import { Test, TestingModule } from '@nestjs/testing';
import { DishesService } from './dishes.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DishDto } from './dto/dish.dto';

const mockPrismaService = {
  dish: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  favoriteDish: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  dishUpload: {
    create: jest.fn(),
  },
  window: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  canteen: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  browseHistory: {
    upsert: jest.fn(),
  },
};

const mockRecommendationService = {
  getRecommendations: jest.fn(),
};

const mockEmbeddingQueueService = {
  enqueueRefreshUser: jest.fn(),
};

describe('DishesService', () => {
  let service: DishesService;
  let prisma: typeof mockPrismaService;
  let recommendationService: typeof mockRecommendationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RecommendationService, useValue: mockRecommendationService },
        { provide: EmbeddingQueueService, useValue: mockEmbeddingQueueService },
      ],
    }).compile();

    service = module.get<DishesService>(DishesService);
    prisma = mockPrismaService;
    recommendationService = mockRecommendationService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDishById', () => {
    const mockDish = {
      id: 'd1',
      name: 'Test Dish',
      description: 'Test description',
      price: 10,
      images: ['image.jpg'],
      tags: ['tag1'],
      ingredients: ['ingredient1'],
      allergens: [],
      status: 'available',
      averageRating: 4.5,
      reviewCount: 10,
      spicyLevel: 1,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
      availableMealTime: ['breakfast'],
      canteen: { id: 'c1', name: 'Canteen 1' },
      window: { id: 'w1', name: 'Window 1', number: '001' },
      parentDish: null,
      subDishes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return a dish by id', async () => {
      prisma.dish.findUnique.mockResolvedValue(mockDish);
      prisma.browseHistory.upsert.mockResolvedValue({});

      const result = await service.getDishById('d1', 'user-1');

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('d1');
    });

    it('should throw NotFoundException if dish not found', async () => {
      prisma.dish.findUnique.mockResolvedValue(null);

      await expect(service.getDishById('unknown', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should record browse history', async () => {
      prisma.dish.findUnique.mockResolvedValue(mockDish);
      prisma.browseHistory.upsert.mockResolvedValue({});

      await service.getDishById('d1', 'user-1');

      expect(prisma.browseHistory.upsert).toHaveBeenCalled();
    });
  });

  describe('getDishesByIds', () => {
    it('should return dishes by ids', async () => {
      const mockDishes = [
        {
          id: 'd1',
          name: 'Dish 1',
          description: 'Description',
          price: 10,
          images: [],
          tags: [],
          ingredients: [],
          allergens: [],
          status: 'available',
          averageRating: 4.0,
          reviewCount: 5,
          spicyLevel: 0,
          sweetness: 0,
          saltiness: 0,
          oiliness: 0,
          availableMealTime: [],
          canteen: { id: 'c1', name: 'Canteen 1' },
          window: { id: 'w1', name: 'Window 1' },
          parentDish: null,
          subDishes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.dish.findMany.mockResolvedValue(mockDishes);

      const result = await service.getDishesByIds(['d1'], 'user-1');

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });

    it('should return empty list if no ids provided', async () => {
      const result = await service.getDishesByIds([], 'user-1');

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(0);
    });
  });

  describe('getDishes', () => {
    const mockDishes = [
      {
        id: 'd1',
        name: 'Dish 1',
        description: 'Description',
        price: 10,
        images: [],
        tags: [],
        ingredients: [],
        allergens: [],
        status: 'online',
        averageRating: 4.0,
        reviewCount: 5,
        spicyLevel: 0,
        sweetness: 0,
        saltiness: 0,
        oiliness: 0,
        availableMealTime: [],
        canteen: { id: 'c1', name: 'Canteen 1' },
        window: { id: 'w1', name: 'Window 1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const baseQuery = {
      filter: {},
      search: {},
      sort: {},
      pagination: { page: 1, pageSize: 20 },
    };

    beforeEach(() => {
      prisma.dish.findMany.mockResolvedValue(mockDishes);
      prisma.dish.count.mockResolvedValue(1);
    });

    it('should return list of dishes', async () => {
      const result = await service.getDishes(baseQuery as any, 'user-1');

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });

    it('should filter by keyword', async () => {
      await service.getDishes(
        { ...baseQuery, search: { keyword: 'test' } } as any,
        'user-1',
      );

      expect(prisma.dish.findMany).toHaveBeenCalled();
    });

    it('should filter by canteenId', async () => {
      await service.getDishes(
        { ...baseQuery, filter: { canteenId: ['c1'] } } as any,
        'user-1',
      );

      expect(prisma.dish.findMany).toHaveBeenCalled();
    });

    it('should filter by tags', async () => {
      await service.getDishes(
        { ...baseQuery, filter: { tag: ['tag1'] } } as any,
        'user-1',
      );

      expect(prisma.dish.findMany).toHaveBeenCalled();
    });

    it('should filter by price range', async () => {
      await service.getDishes(
        { ...baseQuery, filter: { price: { min: 5, max: 20 } } } as any,
        'user-1',
      );

      expect(prisma.dish.findMany).toHaveBeenCalled();
    });

    it('should sort by rating', async () => {
      await service.getDishes(
        {
          ...baseQuery,
          sort: { field: 'averageRating', order: 'desc' },
        } as any,
        'user-1',
      );

      expect(prisma.dish.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { averageRating: 'desc' },
        }),
      );
    });

    it('should sort by price', async () => {
      await service.getDishes(
        { ...baseQuery, sort: { field: 'price', order: 'asc' } } as any,
        'user-1',
      );

      expect(prisma.dish.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'asc' },
        }),
      );
    });
  });

  describe('favoriteDish', () => {
    it('should add dish to favorites', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.favoriteDish.findUnique.mockResolvedValue(null);
      prisma.favoriteDish.create.mockResolvedValue({ id: 'fav-1' });
      prisma.favoriteDish.count.mockResolvedValue(1);

      const result = await service.favoriteDish('d1', 'user-1');

      expect(result.code).toBe(200);
      expect(result.data.isFavorited).toBe(true);
      expect(prisma.favoriteDish.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if dish not found', async () => {
      prisma.dish.findUnique.mockResolvedValue(null);

      await expect(service.favoriteDish('unknown', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already favorited', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.favoriteDish.findUnique.mockResolvedValue({ id: 'fav-1' });

      await expect(service.favoriteDish('d1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unfavoriteDish', () => {
    it('should remove dish from favorites', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.favoriteDish.findUnique.mockResolvedValue({ id: 'fav-1' });
      prisma.favoriteDish.delete.mockResolvedValue({});
      prisma.favoriteDish.count.mockResolvedValue(0);

      const result = await service.unfavoriteDish('d1', 'user-1');

      expect(result.code).toBe(200);
      expect(result.data.isFavorited).toBe(false);
      expect(prisma.favoriteDish.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if dish not found', async () => {
      prisma.dish.findUnique.mockResolvedValue(null);

      await expect(service.unfavoriteDish('unknown', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if not favorited', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.favoriteDish.findUnique.mockResolvedValue(null);

      await expect(service.unfavoriteDish('d1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadDish', () => {
    const uploadDto = {
      name: 'New Dish',
      description: 'Description',
      price: 15,
      images: ['image.jpg'],
      canteenId: 'c1',
    };

    beforeEach(() => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
      });
    });

    it('should upload a new dish', async () => {
      prisma.dishUpload.create.mockResolvedValue({
        id: 'upload-1',
        name: 'New Dish',
        status: 'pending',
      });

      const result = await service.uploadDish(uploadDto as any, 'user-1');

      expect(result.code).toBe(201);
      expect(result.data.status).toBe('pending');
    });

    it('should throw BadRequestException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadDish(uploadDto as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload dish by canteen name', async () => {
      const uploadDtoWithName = {
        name: 'New Dish',
        description: 'Description',
        price: 15,
        images: ['image.jpg'],
        canteenName: 'Canteen 1',
      };
      prisma.canteen.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
      });
      prisma.dishUpload.create.mockResolvedValue({
        id: 'upload-1',
        name: 'New Dish',
        status: 'pending',
      });

      const result = await service.uploadDish(
        uploadDtoWithName as any,
        'user-1',
      );

      expect(result.code).toBe(201);
    });

    it('should throw BadRequestException if canteen name not found', async () => {
      const uploadDtoWithName = {
        name: 'New Dish',
        canteenName: 'Unknown Canteen',
      };
      prisma.canteen.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadDish(uploadDtoWithName as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload dish with window id', async () => {
      const uploadDtoWithWindow = {
        ...uploadDto,
        windowId: 'w1',
      };
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'Window 1',
        number: '001',
        canteenId: 'c1',
      });
      prisma.dishUpload.create.mockResolvedValue({
        id: 'upload-1',
        status: 'pending',
      });

      const result = await service.uploadDish(
        uploadDtoWithWindow as any,
        'user-1',
      );

      expect(result.code).toBe(201);
    });

    it('should throw BadRequestException if window belongs to different canteen', async () => {
      const uploadDtoWithWindow = {
        ...uploadDto,
        windowId: 'w1',
      };
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'Window 1',
        canteenId: 'c2',
      });

      await expect(
        service.uploadDish(uploadDtoWithWindow as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
