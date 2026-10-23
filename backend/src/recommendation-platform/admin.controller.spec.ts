import { RecommendationPlatformController } from './admin.controller';
import { RecommendationCatalogService } from './catalog.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { PrismaService } from '@/prisma.service';

function fixture() {
  const result = {
    code: 200,
    message: 'success',
    data: {
      mode: 'preview',
      strategyRevisionId: 'baseline',
      items: [
        { id: 'dish-b', score: 0.75, scoreBreakdown: { preferenceScore: 0.9 } },
        { id: 'dish-a', score: 0.8 },
      ],
    },
  };
  const recommendation = {
    getRecommendations: jest.fn().mockResolvedValue(result),
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user' }) },
    recommendationStrategy: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'baseline', scene: 'home' }),
    },
    dish: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'dish-a',
          name: '清蒸鲈鱼',
          canteenName: '食堂',
          windowName: '蒸菜',
          price: 18,
          priceUnit: null,
        },
        {
          id: 'dish-b',
          name: '番茄炒蛋',
          canteenName: '食堂',
          windowName: '家常菜',
          price: 12.5,
          priceUnit: '份',
        },
      ]),
    },
  };
  const controller = new RecommendationPlatformController(
    {} as RecommendationCatalogService,
    recommendation as unknown as RecommendationService,
    prisma as unknown as PrismaService,
  );
  return { controller, recommendation, prisma, result };
}

describe('recommendation administrator preview display data', () => {
  it('batches dish metadata while retaining recommendation order, scores and preview isolation', async () => {
    const f = fixture();
    const response = await f.controller.preview({
      userId: 'user',
      strategyRevisionId: 'baseline',
    });
    expect(response.data.items.map((item) => item.id)).toEqual([
      'dish-b',
      'dish-a',
    ]);
    expect(response.data.items[0]).toMatchObject({
      id: 'dish-b',
      score: 0.75,
      scoreBreakdown: { preferenceScore: 0.9 },
      dish: { name: '番茄炒蛋', price: 12.5 },
    });
    expect(f.prisma.dish.findMany).toHaveBeenCalledTimes(1);
    expect(f.prisma.dish.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['dish-b', 'dish-a'] } },
      select: {
        id: true,
        name: true,
        canteenName: true,
        windowName: true,
        price: true,
        priceUnit: true,
      },
    });
    expect(f.recommendation.getRecommendations).toHaveBeenCalledWith(
      'user',
      expect.anything(),
      { mode: 'preview', strategyRevisionId: 'baseline' },
    );
  });
  it('retains a scored item if its dish disappears before display metadata is read', async () => {
    const f = fixture();
    f.prisma.dish.findMany.mockResolvedValue([]);
    const response = await f.controller.preview({
      userId: 'user',
      strategyRevisionId: 'baseline',
    });
    expect(response.data.items).toHaveLength(2);
    expect(response.data.items[0]).toMatchObject({ id: 'dish-b', score: 0.75 });
    expect(response.data.items[0].dish).toBeUndefined();
  });
});
