import { Test, TestingModule } from '@nestjs/testing';
import { NewsService } from './news.service';
import { PrismaService } from '@/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('NewsService', () => {
  let service: NewsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    news: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return a list of news', async () => {
      const publishedAt = new Date();
      const createdAt = new Date();
      const mockNews = [
        {
          id: '1',
          title: 'News 1',
          content: 'Content 1',
          summary: 'Summary 1',
          canteenId: 'c1',
          canteenName: 'Canteen 1',
          publishedAt,
          createdBy: 'admin1',
          createdAt,
        },
      ];
      const total = 1;

      mockPrismaService.news.findMany.mockResolvedValue(mockNews);
      mockPrismaService.news.count.mockResolvedValue(total);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        code: 200,
        message: '获取新闻列表成功',
        data: {
          items: [
            {
              id: '1',
              title: 'News 1',
              content: 'Content 1',
              summary: 'Summary 1',
              canteenId: 'c1',
              canteenName: 'Canteen 1',
              publishedAt: publishedAt.toISOString(),
              createdBy: 'admin1',
              createdAt: createdAt.toISOString(),
            },
          ],
          meta: {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });
      expect(mockPrismaService.news.findMany).toHaveBeenCalled();
      expect(mockPrismaService.news.count).toHaveBeenCalled();
    });

    it('should return all news when canteenId is not provided', async () => {
      const mockNews = [
        {
          id: '1',
          title: 'News 1',
          content: 'Content 1',
          summary: 'Summary 1',
          canteenId: 'c1',
          canteenName: 'Canteen 1',
          publishedAt: new Date(),
          createdBy: 'admin1',
          createdAt: new Date(),
        },
        {
          id: '2',
          title: 'News 2',
          content: 'Content 2',
          summary: 'Summary 2',
          canteenId: 'c2',
          canteenName: 'Canteen 2',
          publishedAt: new Date(),
          createdBy: 'admin2',
          createdAt: new Date(),
        },
      ];
      const total = 2;

      mockPrismaService.news.findMany.mockResolvedValue(mockNews);
      mockPrismaService.news.count.mockResolvedValue(total);

      await service.findAll({ page: 1, pageSize: 10 });

      expect(mockPrismaService.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published' },
        }),
      );
      expect(mockPrismaService.news.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published' },
        }),
      );
    });

    it('should filter by canteenId', async () => {
      const canteenId = 'c1';
      mockPrismaService.news.findMany.mockResolvedValue([]);
      mockPrismaService.news.count.mockResolvedValue(0);
      await service.findAll({ page: 1, pageSize: 10, canteenId });

      expect(mockPrismaService.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { canteenId, status: 'published' },
        }),
      );
      expect(mockPrismaService.news.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { canteenId, status: 'published' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single news', async () => {
      const publishedAt = new Date();
      const createdAt = new Date();
      const mockNews = {
        id: '1',
        title: 'News 1',
        content: 'Content 1',
        summary: 'Summary 1',
        canteenId: 'c1',
        canteenName: 'Canteen 1',
        status: 'published',
        publishedAt,
        createdBy: 'admin1',
        createdAt,
      };

      mockPrismaService.news.findUnique.mockResolvedValue(mockNews);

      const result = await service.findOne('1');

      expect(result).toEqual({
        code: 200,
        message: '获取新闻详情成功',
        data: {
          id: '1',
          title: 'News 1',
          content: 'Content 1',
          summary: 'Summary 1',
          canteenId: 'c1',
          canteenName: 'Canteen 1',
          publishedAt: publishedAt.toISOString(),
          createdBy: 'admin1',
          createdAt: createdAt.toISOString(),
        },
      });
      expect(mockPrismaService.news.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException if news not found', async () => {
      mockPrismaService.news.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });
});
