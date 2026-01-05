import { Test, TestingModule } from '@nestjs/testing';
import { AdminNewsService } from './admin-news.service';
import { PrismaService } from '@/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrismaService = {
  news: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  canteen: {
    findUnique: jest.fn(),
  },
};

describe('AdminNewsService', () => {
  let service: AdminNewsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminNewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminNewsService>(AdminNewsService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of news', async () => {
      const mockNews = [
        {
          id: 'n1',
          title: 'News 1',
          content: 'Content 1',
          summary: 'Summary 1',
          status: 'published',
          canteenId: 'c1',
          canteenName: 'Canteen 1',
          publishedAt: new Date(),
          createdBy: 'admin-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.news.findMany.mockResolvedValue(mockNews);
      prisma.news.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.news.findMany.mockResolvedValue([]);
      prisma.news.count.mockResolvedValue(0);

      await service.findAll({ status: 'draft' });

      expect(prisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
        }),
      );
    });

    it('should filter by canteenId for canteen admin', async () => {
      prisma.news.findMany.mockResolvedValue([]);
      prisma.news.count.mockResolvedValue(0);

      await service.findAll({}, { id: 'admin-1', canteenId: 'c1' } as any);

      expect(prisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ canteenId: 'c1' }),
        }),
      );
    });

    it('should filter by canteenName for superadmin', async () => {
      prisma.news.findMany.mockResolvedValue([]);
      prisma.news.count.mockResolvedValue(0);

      await service.findAll({ canteenName: 'Canteen' });

      expect(prisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            canteenName: { contains: 'Canteen', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('createNews', () => {
    const createDto = {
      title: 'New News',
      content: 'News content',
      summary: 'News summary',
      canteenId: 'c1',
    };

    const adminInfo = { id: 'admin-1', canteenId: null } as any;

    it('should create a new news', async () => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
      });
      prisma.news.create.mockResolvedValue({
        id: 'new-id',
        title: 'New News',
        content: 'News content',
        summary: 'News summary',
        status: 'draft',
        canteenId: 'c1',
        canteenName: 'Canteen 1',
        publishedAt: null,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createNews(createDto, adminInfo);

      expect(result.code).toBe(200);
      expect(result.data.title).toBe('New News');
      expect(result.data.status).toBe('draft');
    });

    it('should throw BadRequestException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(service.createNews(createDto, adminInfo)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use admin canteenId if provided', async () => {
      const canteenAdmin = { id: 'admin-1', canteenId: 'c1' } as any;
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
      });
      prisma.news.create.mockResolvedValue({
        id: 'new-id',
        title: 'New News',
        content: 'News content',
        summary: 'News summary',
        status: 'draft',
        canteenId: 'c1',
        canteenName: 'Canteen 1',
        publishedAt: null,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.createNews(
        { ...createDto, canteenId: undefined },
        canteenAdmin,
      );

      expect(prisma.news.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ canteenId: 'c1' }),
        }),
      );
    });

    it('should throw ForbiddenException if canteen admin tries to create for different canteen', async () => {
      const canteenAdmin = { id: 'admin-1', canteenId: 'c1' } as any;

      await expect(
        service.createNews({ ...createDto, canteenId: 'c2' }, canteenAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create news without canteenId', async () => {
      prisma.news.create.mockResolvedValue({
        id: 'new-id',
        title: 'New News',
        content: 'News content',
        summary: 'News summary',
        status: 'draft',
        canteenId: null,
        canteenName: null,
        publishedAt: null,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createNews(
        { ...createDto, canteenId: undefined },
        adminInfo,
      );

      expect(result.code).toBe(200);
      expect(result.data.canteenId).toBeNull();
    });
  });

  describe('updateNews', () => {
    const updateDto = {
      title: 'Updated News',
      content: 'Updated content',
    };

    beforeEach(() => {
      prisma.news.findUnique.mockResolvedValue({
        id: 'n1',
        title: 'Original News',
        status: 'draft',
        canteenId: 'c1',
      });
      prisma.news.update.mockResolvedValue({
        id: 'n1',
        title: 'Updated News',
        content: 'Updated content',
        summary: null,
        status: 'draft',
        canteenId: 'c1',
        canteenName: 'Canteen 1',
        publishedAt: null,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should update a news', async () => {
      const result = await service.updateNews('n1', updateDto);

      expect(result.code).toBe(200);
      expect(result.data.title).toBe('Updated News');
    });

    it('should throw NotFoundException if news not found', async () => {
      prisma.news.findUnique.mockResolvedValue(null);

      await expect(service.updateNews('unknown', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.updateNews('n1', updateDto, { canteenId: 'c2' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if trying to edit published news', async () => {
      prisma.news.findUnique.mockResolvedValue({
        id: 'n1',
        title: 'Published News',
        status: 'published',
        canteenId: 'c1',
      });

      await expect(service.updateNews('n1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update canteenName when canteenId changes', async () => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c2',
        name: 'Canteen 2',
      });

      await service.updateNews('n1', { canteenId: 'c2' });

      expect(prisma.news.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ canteenName: 'Canteen 2' }),
        }),
      );
    });

    it('should throw BadRequestException if new canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(
        service.updateNews('n1', { canteenId: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use admin canteenId if canteen admin', async () => {
      const canteenAdmin = { id: 'admin-1', canteenId: 'c1' } as any;
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
      });

      await service.updateNews('n1', updateDto, canteenAdmin);

      expect(prisma.news.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canteenId: 'c1',
            canteenName: 'Canteen 1',
          }),
        }),
      );
    });
  });

  describe('publishNews', () => {
    beforeEach(() => {
      prisma.news.findUnique.mockResolvedValue({
        id: 'n1',
        status: 'draft',
        canteenId: 'c1',
      });
    });

    it('should publish a news', async () => {
      prisma.news.update.mockResolvedValue({});

      const result = await service.publishNews('n1');

      expect(result.code).toBe(200);
      expect(prisma.news.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: 'published',
          publishedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if news not found', async () => {
      prisma.news.findUnique.mockResolvedValue(null);

      await expect(service.publishNews('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.publishNews('n1', { canteenId: 'c2' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeNews', () => {
    beforeEach(() => {
      prisma.news.findUnique.mockResolvedValue({
        id: 'n1',
        status: 'published',
        canteenId: 'c1',
      });
    });

    it('should revoke a news', async () => {
      prisma.news.update.mockResolvedValue({});

      const result = await service.revokeNews('n1');

      expect(result.code).toBe(200);
      expect(prisma.news.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: 'draft',
          publishedAt: null,
        },
      });
    });

    it('should throw NotFoundException if news not found', async () => {
      prisma.news.findUnique.mockResolvedValue(null);

      await expect(service.revokeNews('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.revokeNews('n1', { canteenId: 'c2' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteNews', () => {
    beforeEach(() => {
      prisma.news.findUnique.mockResolvedValue({
        id: 'n1',
        canteenId: 'c1',
      });
    });

    it('should delete a news', async () => {
      prisma.news.delete.mockResolvedValue({});

      const result = await service.deleteNews('n1');

      expect(result.code).toBe(200);
      expect(prisma.news.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });

    it('should throw NotFoundException if news not found', async () => {
      prisma.news.findUnique.mockResolvedValue(null);

      await expect(service.deleteNews('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.deleteNews('n1', { canteenId: 'c2' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
