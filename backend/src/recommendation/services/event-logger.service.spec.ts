import { Test, TestingModule } from '@nestjs/testing';
import { EventLoggerService } from './event-logger.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './cache.service';
import {
  RecommendationEventType,
  RecommendationScene,
} from '../constants/recommendation.constants';

describe('EventLoggerService', () => {
  let service: EventLoggerService;
  let prisma: any;
  let cacheService: any;

  beforeEach(async () => {
    prisma = {
      recommendationEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    cacheService = {
      incrementEventCount: jest.fn().mockResolvedValue(undefined),
      invalidateUserFeatures: jest.fn().mockResolvedValue(undefined),
      invalidateUserRecommendations: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLoggerService,
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

    service = module.get<EventLoggerService>(EventLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logImpressions', () => {
    it('should log multiple impressions', async () => {
      const userId = 'user-1';
      const dishIds = ['dish-1', 'dish-2'];
      const context = {
        scene: RecommendationScene.HOME,
        requestId: 'req-1',
      };

      await service.logImpressions(userId, dishIds, context);

      expect(prisma.recommendationEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId,
              dishId: 'dish-1',
              eventType: RecommendationEventType.IMPRESSION,
              position: 0,
            }),
            expect.objectContaining({
              userId,
              dishId: 'dish-2',
              eventType: RecommendationEventType.IMPRESSION,
              position: 1,
            }),
          ]),
        }),
      );
    });

    it('should increment event counts for each dish', async () => {
      const dishIds = ['dish-1', 'dish-2'];

      await service.logImpressions('user-1', dishIds, {
        scene: RecommendationScene.HOME,
        requestId: 'req-1',
      });

      expect(cacheService.incrementEventCount).toHaveBeenCalledTimes(2);
    });

    it('should include scores when provided', async () => {
      const scores = new Map([
        ['dish-1', 0.9],
        ['dish-2', 0.8],
      ]);

      await service.logImpressions('user-1', ['dish-1', 'dish-2'], {
        scene: RecommendationScene.HOME,
        requestId: 'req-1',
        scores,
      });

      expect(prisma.recommendationEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              dishId: 'dish-1',
              score: 0.9,
            }),
          ]),
        }),
      );
    });
  });

  describe('logEvent', () => {
    it('should create a single event', async () => {
      const event = {
        eventType: RecommendationEventType.CLICK,
        userId: 'user-1',
        dishId: 'dish-1',
        scene: RecommendationScene.HOME,
        requestId: 'req-1',
      };

      const result = await service.logEvent(event);

      expect(result).toBe('event-1');
      expect(prisma.recommendationEvent.create).toHaveBeenCalled();
      expect(cacheService.incrementEventCount).toHaveBeenCalled();
    });
  });

  describe('logClick', () => {
    it('should log click event', async () => {
      const result = await service.logClick('user-1', 'dish-1', {
        scene: RecommendationScene.HOME,
        requestId: 'req-1',
        position: 0,
      });

      expect(result).toBe('event-1');
      expect(prisma.recommendationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: RecommendationEventType.CLICK,
            userId: 'user-1',
            dishId: 'dish-1',
          }),
        }),
      );
    });

    it('should include experiment info when provided', async () => {
      await service.logClick('user-1', 'dish-1', {
        scene: RecommendationScene.HOME,
        experimentId: 'exp-1',
        groupItemId: 'group-1',
      });

      expect(prisma.recommendationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            experimentId: 'exp-1',
            groupItemId: 'group-1',
          }),
        }),
      );
    });
  });

  describe('logFavorite', () => {
    it('should log favorite event and invalidate cache', async () => {
      const result = await service.logFavorite('user-1', 'dish-1', {
        scene: RecommendationScene.HOME,
      });

      expect(result).toBe('event-1');
      expect(cacheService.invalidateUserFeatures).toHaveBeenCalledWith(
        'user-1',
      );
      expect(cacheService.invalidateUserRecommendations).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('logReview', () => {
    it('should log review event with rating', async () => {
      const result = await service.logReview('user-1', 'dish-1', {
        scene: RecommendationScene.DISH_DETAIL,
        rating: 5,
      });

      expect(result).toBe('event-1');
      expect(prisma.recommendationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: RecommendationEventType.REVIEW,
            extra: expect.objectContaining({ rating: 5 }),
          }),
        }),
      );
    });

    it('should update event counts on review', async () => {
      await service.logReview('user-1', 'dish-1', {
        scene: RecommendationScene.DISH_DETAIL,
        rating: 4,
      });

      expect(cacheService.incrementEventCount).toHaveBeenCalled();
    });
  });

  describe('logDislike', () => {
    it('should log dislike event', async () => {
      const result = await service.logDislike('user-1', 'dish-1', {
        scene: RecommendationScene.HOME,
      });

      expect(result).toBe('event-1');
      expect(prisma.recommendationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: RecommendationEventType.DISLIKE,
            userId: 'user-1',
            dishId: 'dish-1',
          }),
        }),
      );
    });

    it('should include reason in extra when provided', async () => {
      await service.logDislike('user-1', 'dish-1', {
        scene: RecommendationScene.HOME,
        reason: '不喜欢辣',
      });

      expect(prisma.recommendationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extra: expect.objectContaining({ reason: '不喜欢辣' }),
          }),
        }),
      );
    });
  });
});
