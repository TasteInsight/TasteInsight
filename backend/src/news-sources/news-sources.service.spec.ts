import { NewsSourcesService } from './news-sources.service';
import {
  ForbiddenException,
  ConflictException,
  BadGatewayException,
} from '@nestjs/common';
const admin = {
  id: 'admin',
  scope: 'GLOBAL',
  canteenIds: [],
  role: 'superadmin',
  username: 'a',
  permissions: [],
} as any;
const scoped = { ...admin, scope: 'CANTEENS', canteenIds: ['c1'] };
describe('news source imports', () => {
  let prisma: any, client: any, service: NewsSourcesService, source: any;
  beforeEach(() => {
    source = {
      id: 's1',
      mpId: 'MP_WXS_3518705034',
      name: '食在清华',
      canteenId: null,
      createdBy: 'admin',
      keyword: '',
      autoPublish: false,
      intervalMinutes: 30,
      canteen: null,
      creator: { ...admin, canteens: [], permissions: [] },
    };
    prisma = {
      newsSource: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(source),
        findUniqueOrThrow: jest
          .fn()
          .mockImplementation(() => Promise.resolve(source)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(source),
        create: jest.fn(),
      },
      newsImport: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      news: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
      canteen: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };
    prisma.$transaction = jest.fn((fn) => fn(prisma));
    client = {
      configured: true,
      feeds: jest
        .fn()
        .mockResolvedValue([{ id: source.mpId, mp_name: source.name }]),
      refresh: jest.fn(),
      articles: jest
        .fn()
        .mockResolvedValue({ list: [{ id: 'a1', title: '上新' }], total: 1 }),
      article: jest.fn().mockResolvedValue({
        id: 'a1',
        title: '上新',
        url: 'https://mp.weixin.qq.com/s/token',
        content: '<section style="padding:10px">正文</section>',
      }),
    };
    service = new NewsSourcesService(prisma, client);
  });
  it('returns the public panel link with source connection metadata', async () => {
    client.adminUrl = 'https://rss.school.example/';
    expect(await service.list(admin)).toEqual({
      configured: true,
      adminUrl: 'https://rss.school.example/',
      items: [],
    });
  });
  it('reports deployment capabilities without accessing storage or the upstream service', () => {
    client.adminUrl = 'http://localhost:8001/';
    expect(service.capabilities()).toEqual({
      configured: true,
      adminUrl: client.adminUrl,
    });
    expect(prisma.newsSource.findMany).not.toHaveBeenCalled();
    expect(client.feeds).not.toHaveBeenCalled();
    client.configured = false;
    expect(service.capabilities()).toEqual({
      configured: false,
      adminUrl: null,
    });
  });
  it('imports real content as a draft with original metadata and a dedupe record', async () => {
    await service.sync('s1');
    expect(prisma.news.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'draft',
        sourceName: '食在清华',
        sourceUrl: 'https://mp.weixin.qq.com/s/token',
        createdBy: 'admin',
      }),
    });
    expect(prisma.newsImport.create).toHaveBeenCalledWith({
      data: { sourceId: 's1', articleId: 'a1', newsId: 'n1' },
    });
    expect(prisma.newsSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastImportedCount: 1,
          lastError: null,
        }),
      }),
    );
  });
  it('publishes new articles with a publication date only when enabled', async () => {
    source.autoPublish = true;
    await service.sync('s1');
    expect(prisma.news.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
      }),
    });
  });
  it('requires publish permission for automatic publishing configuration', async () => {
    const editor = { ...admin, role: 'admin', permissions: ['news:create'] };
    await expect(
      service.create(
        {
          mpId: source.mpId,
          enabled: true,
          autoPublish: true,
          keyword: '',
          intervalMinutes: 30,
        },
        editor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    source.autoPublish = true;
    await expect(
      service.update('s1', { keyword: '上新' }, editor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.update('s1', { autoPublish: false }, editor);
    expect(prisma.newsSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ autoPublish: false }),
      }),
    );
  });
  it('stops automatic publishing after the owner loses publish permission', async () => {
    source.autoPublish = true;
    source.creator = {
      ...admin,
      role: 'admin',
      canteens: [],
      permissions: [{ permission: 'news:create' }],
    };
    await expect(service.sync('s1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.news.create).not.toHaveBeenCalled();
  });
  it('does not recreate a deleted imported article or overwrite edited content', async () => {
    prisma.newsImport.findUnique.mockResolvedValue({
      sourceId: 's1',
      articleId: 'a1',
      newsId: null,
    });
    await service.sync('s1');
    expect(prisma.news.create).not.toHaveBeenCalled();
    expect(client.article).not.toHaveBeenCalled();
  });
  it('skips a concurrent or paused source when it cannot claim the lease', async () => {
    prisma.newsSource.updateMany.mockResolvedValue({ count: 0 });
    await service.sync('s1');
    expect(client.refresh).not.toHaveBeenCalled();
  });
  it('records upstream failure, schedules retry and releases the lease', async () => {
    client.refresh.mockRejectedValue(new BadGatewayException('授权已过期'));
    await expect(service.sync('s1')).rejects.toThrow('授权已过期');
    expect(prisma.newsSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: '授权已过期' }),
      }),
    );
    expect(prisma.newsSource.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { syncLeaseUntil: null } }),
    );
  });
  it('rejects cross-scope source reads and creation', async () => {
    await expect(service.find('s1', scoped)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.create(
        {
          mpId: 'id',
          enabled: true,
          keyword: '',
          autoPublish: false,
          intervalMinutes: 30,
          canteenId: null,
        },
        scoped,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('refuses configuration changes during an active sync', async () => {
    source.syncLeaseUntil = new Date(Date.now() + 60000);
    await expect(
      service.update('s1', { enabled: false }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('uses keyword filtering and skips incomplete details', async () => {
    source.keyword = '停餐';
    await service.sync('s1');
    expect(client.article).not.toHaveBeenCalled();
    source.keyword = '';
    client.article.mockResolvedValue({
      title: '上新',
      url: 'https://mp.weixin.qq.com/s/a',
      content: '',
    });
    await service.sync('s1');
    expect(prisma.news.create).not.toHaveBeenCalled();
  });
  it('revalidates source creator scope and permissions for background work', async () => {
    source.creator = {
      ...scoped,
      canteens: [{ canteenId: 'c1' }],
      permissions: [],
    };
    await expect(service.sync('s1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.refresh).not.toHaveBeenCalled();
  });
  it('imports across all pages instead of stopping at 100 entries', async () => {
    client.articles
      .mockResolvedValueOnce({
        list: Array.from({ length: 100 }, (_, i) => ({
          id: `a${i}`,
          title: '上新',
        })),
        total: 101,
      })
      .mockResolvedValueOnce({
        list: [{ id: 'a100', title: '上新' }],
        total: 101,
      });
    await service.sync('s1');
    expect(client.articles.mock.calls).toEqual([
      [source.mpId, 0],
      [source.mpId, 100],
    ]);
    expect(prisma.news.create).toHaveBeenCalledTimes(101);
  });
});
