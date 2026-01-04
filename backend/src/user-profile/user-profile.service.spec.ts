import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service';
import { PrismaService } from '@/prisma.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  favoriteDish: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  browseHistory: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  dishUpload: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  report: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockEmbeddingQueueService = {
  enqueueRefreshUser: jest.fn(),
};

describe('UserProfileService', () => {
  let service: UserProfileService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmbeddingQueueService, useValue: mockEmbeddingQueueService },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        openId: 'open-id-1',
        nickname: 'User',
        avatar: null,
        preferences: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createUser('open-id-1');

      expect(result).toBeDefined();
      expect(result.openId).toBe('open-id-1');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        openId: 'open-id-1',
        nickname: 'User 1',
        avatar: 'avatar.jpg',
        gender: 'male',
        age: 25,
        allergens: [],
        preferences: { favoriteCuisines: ['chinese'] },
        settings: { pushNotifications: true },
        favoriteDishes: [],
        reviews: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getUserProfile('u1');

      expect(result.code).toBe(200);
      expect(result.data.nickname).toBe('User 1');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserProfile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      // update succeeds
      prisma.user.update.mockResolvedValue({});

      // getUserProfile called at the end needs the full object
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        openId: 'open-id-1',
        nickname: 'Updated Name',
        avatar: 'new-avatar.jpg',
        gender: null,
        age: null,
        allergens: [],
        preferences: {},
        settings: {},
        favoriteDishes: [],
        reviews: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUserProfile('u1', {
        nickname: 'Updated Name',
        avatar: 'new-avatar.jpg',
      });

      expect(result.code).toBe(200);
      expect(result.data.nickname).toBe('Updated Name');
    });

    it('should throw NotFoundException if user not found via getUserProfile', async () => {
      prisma.user.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserProfile('unknown', { nickname: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyReviews', () => {
    it('should return user reviews', async () => {
      const mockReviews = [
        {
          id: 'r1',
          userId: 'u1',
          dishId: 'd1',
          rating: 4,
          content: 'Great!',
          images: [],
          status: 'approved',
          spicyLevel: null,
          sweetness: null,
          saltiness: null,
          oiliness: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          dish: {
            id: 'd1',
            name: 'Dish 1',
            images: ['dish.jpg'],
          },
          user: {
            nickname: 'User 1',
            avatar: 'avatar.jpg',
          },
        },
      ];
      prisma.review.findMany.mockResolvedValue(mockReviews);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getMyReviews('u1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });
  });

  describe('getMyFavorites', () => {
    it('should return user favorites', async () => {
      const mockFavorites = [
        {
          id: 'f1',
          userId: 'u1',
          dishId: 'd1',
          addedAt: new Date(),
          dish: {
            id: 'd1',
            name: 'Dish 1',
            images: ['image.jpg'],
            price: 15,
            averageRating: 4.5,

            reviewCount: 10,
            canteen: {
              name: 'Canteen 1',
            },
          },
        },
      ];
      prisma.favoriteDish.findMany.mockResolvedValue(mockFavorites);
      prisma.favoriteDish.count.mockResolvedValue(1);

      const result = await service.getMyFavorites('u1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });
  });

  describe('getBrowseHistory', () => {
    it('should return browse history', async () => {
      const mockHistory = [
        {
          id: 'h1',
          userId: 'u1',
          dishId: 'd1',
          lastViewedAt: new Date(),
          dish: {
            id: 'd1',
            name: 'Dish 1',
            images: ['image.jpg'],
            price: 15,
            averageRating: 4.5,
            reviewCount: 10,
            canteen: {
              name: 'Canteen 1',
            },
          },
        },
      ];
      prisma.browseHistory.findMany.mockResolvedValue(mockHistory);
      prisma.browseHistory.count.mockResolvedValue(1);

      const result = await service.getBrowseHistory('u1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });
  });

  describe('clearBrowseHistory', () => {
    it('should clear all browse history for user', async () => {
      prisma.browseHistory.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.clearBrowseHistory('u1');

      expect(result.code).toBe(200);
      expect(result.message).toBe('操作成功');
    });
  });

  describe('getMyUploads', () => {
    it('should return user uploads', async () => {
      const mockUploads = [
        {
          id: 'up1',
          userId: 'u1',
          name: 'Uploaded Dish',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.dishUpload.findMany.mockResolvedValue(mockUploads);
      prisma.dishUpload.count.mockResolvedValue(1);

      const result = await service.getMyUploads('u1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });
  });

  describe('getMyReports', () => {
    it('should return user reports', async () => {
      const mockReports = [
        {
          id: 'rp1',
          reporterId: 'u1',
          targetType: 'review',
          targetId: 'r1',
          type: 'spam',
          reason: 'Spam content',
          status: 'pending',
          handleResult: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          reporter: {
            id: 'u1',
            nickname: 'User 1',
            avatar: 'avatar.jpg',
          },
          review: {
            id: 'r1',
            content: 'Review content',
            user: { nickname: 'User 2' },
          },
          comment: null,
        },
      ];
      prisma.report.findMany.mockResolvedValue(mockReports);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.getMyReports('u1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
    });
  });
});
