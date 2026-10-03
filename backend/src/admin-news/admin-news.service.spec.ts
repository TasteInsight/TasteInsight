import { Test, TestingModule } from '@nestjs/testing';
import { AdminNewsService } from './admin-news.service';
import { PrismaService } from '@/prisma.service';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminGetNewsDto } from './dto/news.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
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

  it('validates publisher identity as omitted, null, or a non-empty string', () => {
    for (const Dto of [CreateNewsDto, UpdateNewsDto]) {
      for (const canteenId of [undefined, null, 'c1']) {
        const dto = Object.assign(new Dto(), {
          title: 'News',
          content: 'Content',
          canteenId,
        });
        expect(validateSync(dto, { whitelist: true })).toEqual([]);
        expect(dto.canteenId).toBe(canteenId);
      }
      const invalid = Object.assign(new Dto(), {
        title: 'News',
        content: 'Content',
        canteenId: '',
      });
      expect(validateSync(invalid)).toEqual([
        expect.objectContaining({ property: 'canteenId' }),
      ]);
    }
  });

  describe('findAll', () => {
    it('filters keyword, canteen and publication dates before paging and counting', async () => {
      prisma.news.findMany.mockResolvedValue([]);
      prisma.news.count.mockResolvedValue(37);
      const result = await service.findAll({
        page: 2,
        pageSize: 10,
        status: 'published',
        keyword: '公告',
        canteenId: 'c1',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
      });
      const where = {
        status: 'published',
        canteenId: 'c1',
        title: { contains: '公告', mode: 'insensitive' },
        publishedAt: {
          gte: new Date('2026-10-01T00:00:00Z'),
          lte: new Date('2026-10-03T23:59:59.999Z'),
        },
      };
      expect(prisma.news.count).toHaveBeenCalledWith({ where });
      expect(prisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 10, take: 10 }),
      );
      expect(result.data.meta.total).toBe(37);
    });

    it('filters draft timestamps exactly and supports whole-school announcements', async () => {
      prisma.news.findMany.mockResolvedValue([]);
      prisma.news.count.mockResolvedValue(0);
      await service.findAll({
        status: 'draft',
        canteenId: 'all',
        startDate: '2026-10-01T08:30:00Z',
        endDate: '2026-10-03T09:15:00Z',
      });
      expect(prisma.news.count).toHaveBeenCalledWith({
        where: {
          status: 'draft',
          canteenId: null,
          createdAt: {
            gte: new Date('2026-10-01T08:30:00Z'),
            lte: new Date('2026-10-03T09:15:00Z'),
          },
        },
      });
    });

    it('does not allow filters to widen a canteen administrator scope', async () => {
      await expect(
        service.findAll({ canteenId: 'other' }, { canteenId: 'own' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects reversed date ranges before querying', async () => {
      await expect(
        service.findAll({ startDate: '2026-10-03', endDate: '2026-10-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.news.findMany).not.toHaveBeenCalled();
    });

    it('validates dates and preserves all supported query fields at the request boundary', () => {
      const query = plainToInstance(AdminGetNewsDto, {
        keyword: '公告',
        canteenId: 'all',
        startDate: '2026-10-01T08:30:00+08:00',
        endDate: '2026-10-03',
      });
      expect(validateSync(query, { whitelist: true })).toEqual([]);
      expect(query.keyword).toBe('公告');
      expect(query.canteenId).toBe('all');
      for (const invalid of ['not-a-date', '2026-02-30']) {
        expect(
          validateSync(
            plainToInstance(AdminGetNewsDto, { startDate: invalid }),
          ),
        ).toHaveLength(1);
      }
    });
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

    it('allows an unscoped administrator to explicitly create a whole-school announcement', async () => {
      prisma.news.create.mockResolvedValue({
        id: 'new-id',
        ...createDto,
        canteenId: null,
        canteenName: null,
      });
      await service.createNews({ ...createDto, canteenId: null }, adminInfo);
      expect(prisma.news.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ canteenId: null, canteenName: null }),
      });
      expect(prisma.canteen.findUnique).not.toHaveBeenCalled();
    });

    it('rejects explicit whole-school creation by a canteen-scoped administrator', async () => {
      await expect(
        service.createNews({ ...createDto, canteenId: null }, {
          id: 'scoped',
          canteenId: 'c1',
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.news.create).not.toHaveBeenCalled();
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

    it('preserves publisher fields when a canteen administrator omits them', async () => {
      const canteenAdmin = { id: 'admin-1', canteenId: 'c1' } as any;
      await service.updateNews('n1', updateDto, canteenAdmin);
      expect(prisma.news.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: updateDto,
      });
      expect(prisma.canteen.findUnique).not.toHaveBeenCalled();
    });

    it('clears both publisher fields for an unscoped explicit null update', async () => {
      await service.updateNews('n1', { canteenId: null }, {
        canteenId: null,
      } as any);
      expect(prisma.news.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { canteenId: null, canteenName: null },
      });
      expect(prisma.canteen.findUnique).not.toHaveBeenCalled();
    });

    it('preserves publisher fields for an unscoped omitted update', async () => {
      await service.updateNews('n1', updateDto, { canteenId: null } as any);
      expect(prisma.news.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: updateDto,
      });
      expect(prisma.canteen.findUnique).not.toHaveBeenCalled();
    });

    it('allows a canteen administrator to retain the same explicit publisher', async () => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
      });
      await service.updateNews('n1', { canteenId: 'c1' }, {
        canteenId: 'c1',
      } as any);
      expect(prisma.news.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { canteenId: 'c1', canteenName: 'Canteen 1' },
      });
    });

    it.each([null, 'c2'])(
      'rejects publisher %s outside a canteen administrator scope',
      async (canteenId) => {
        await expect(
          service.updateNews('n1', { canteenId }, { canteenId: 'c1' } as any),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.news.update).not.toHaveBeenCalled();
        expect(prisma.canteen.findUnique).not.toHaveBeenCalled();
      },
    );
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
