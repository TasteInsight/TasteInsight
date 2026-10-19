import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  canAccessCanteen,
  canteenScopeFilter,
  defaultCanteenId,
} from '@/auth/admin-scope';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { CreateNewsSourceDto, UpdateNewsSourceDto } from './news-sources.dto';
import { WerssClient } from './werss.client';
import {
  cleanNewsContent,
  newsSummary,
  wechatArticleUrl,
} from './news-content';
import { Prisma } from '@prisma/client';

@Injectable()
export class NewsSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly werss: WerssClient,
  ) {}

  capabilities() {
    return {
      configured: this.werss.configured,
      adminUrl: this.werss.configured ? this.werss.adminUrl : null,
    };
  }

  async list(admin: AdminInfo) {
    return {
      ...this.capabilities(),
      items: await this.prisma.newsSource.findMany({
        where: { canteenId: canteenScopeFilter(admin) },
        include: { canteen: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
  async feeds() {
    return (await this.werss.feeds())
      .filter((f) => f.id !== 'MP_WXS_FEATURED_ARTICLES')
      .map((f) => ({ id: f.id, name: f.mp_name }));
  }

  async find(id: string, admin: AdminInfo) {
    const source = await this.prisma.newsSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('新闻来源不存在');
    if (!canAccessCanteen(admin, source.canteenId))
      throw new ForbiddenException('新闻来源不在您的管理范围内');
    return source;
  }
  private async validateCanteen(
    id: string | null | undefined,
    admin: AdminInfo,
  ) {
    if (!canAccessCanteen(admin, id))
      throw new ForbiddenException('请选择管理范围内的食堂');
    if (id && !(await this.prisma.canteen.findUnique({ where: { id } })))
      throw new BadRequestException('食堂不存在');
  }
  private validateAutoPublish(autoPublish: boolean, admin: AdminInfo) {
    if (
      autoPublish &&
      admin.role !== 'superadmin' &&
      !admin.permissions.includes('news:publish')
    )
      throw new ForbiddenException('启用自动发布需要新闻发布权限');
  }
  async create(dto: CreateNewsSourceDto, admin: AdminInfo) {
    this.validateAutoPublish(dto.autoPublish, admin);
    const canteenId =
      dto.canteenId === undefined ? defaultCanteenId(admin) : dto.canteenId;
    await this.validateCanteen(canteenId, admin);
    const feed = (await this.feeds()).find((f) => f.id === dto.mpId);
    if (!feed) throw new BadRequestException('请先在 WeRSS 订阅该公众号');
    try {
      return await this.prisma.newsSource.create({
        data: {
          ...dto,
          canteenId,
          name: feed.name,
          keyword: dto.keyword.trim(),
          createdBy: admin.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('该公众号已配置来源，请联系来源管理员');
      throw error;
    }
  }
  async update(id: string, dto: UpdateNewsSourceDto, admin: AdminInfo) {
    await this.find(id, admin);
    if (dto.canteenId !== undefined)
      await this.validateCanteen(dto.canteenId, admin);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM news_sources WHERE id = ${id} FOR UPDATE`;
      const source = await tx.newsSource.findUniqueOrThrow({ where: { id } });
      if (!canAccessCanteen(admin, source.canteenId))
        throw new ForbiddenException('新闻来源不在您的管理范围内');
      this.validateAutoPublish(dto.autoPublish ?? source.autoPublish, admin);
      if (source.syncLeaseUntil && source.syncLeaseUntil > new Date())
        throw new ConflictException('来源正在同步，请稍后修改');
      return tx.newsSource.update({
        where: { id },
        data: {
          ...dto,
          createdBy: admin.id,
          ...(dto.keyword === undefined ? {} : { keyword: dto.keyword.trim() }),
          nextSyncAt: new Date(),
        },
      });
    });
  }

  async sync(id: string) {
    const now = new Date();
    let lease = new Date(now.getTime() + 10 * 60000);
    const claimed = await this.prisma.newsSource.updateMany({
      where: {
        id,
        enabled: true,
        OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }],
      },
      data: { syncLeaseUntil: lease },
    });
    if (!claimed.count) return;
    let imported = 0;
    try {
      const source = await this.prisma.newsSource.findUniqueOrThrow({
        where: { id },
        include: {
          canteen: true,
          creator: { include: { canteens: true, permissions: true } },
        },
      });
      const owner = source.creator;
      if (
        owner.deletedAt ||
        !canAccessCanteen(
          {
            scope: owner.scope,
            canteenIds: owner.canteens.map((c) => c.canteenId),
          },
          source.canteenId,
        ) ||
        (owner.role !== 'superadmin' &&
          (!owner.permissions.some((p) => p.permission === 'news:create') ||
            (source.autoPublish &&
              !owner.permissions.some((p) => p.permission === 'news:publish'))))
      )
        throw new ForbiddenException(
          '来源创建者的新闻管理权限已变更，请由管理员重新配置',
        );
      await this.werss.refresh(source.mpId);
      for (let offset = 0; ; offset += 100) {
        const page = await this.werss.articles(source.mpId, offset);
        for (const article of page.list) {
          if (source.keyword && !article.title.includes(source.keyword))
            continue;
          const key = { sourceId: id, articleId: article.id };
          if (
            await this.prisma.newsImport.findUnique({
              where: { sourceId_articleId: key },
            })
          )
            continue;
          const renewed = new Date(Date.now() + 10 * 60000);
          const held = await this.prisma.newsSource.updateMany({
            where: { id, enabled: true, syncLeaseUntil: lease },
            data: { syncLeaseUntil: renewed },
          });
          if (!held.count)
            throw new ConflictException('同步任务已失效，请重新同步');
          lease = renewed;
          const detail = await this.werss.article(article.id);
          const url = wechatArticleUrl(detail.url);
          const content = detail.content
            ? cleanNewsContent(detail.content)
            : '';
          if (!url || !content.trim() || !detail.title?.trim()) continue;
          // Keep the import row after deletion so an editorial deletion survives future syncs.
          const saved = await this.prisma.$transaction(async (tx) => {
            if (
              await tx.newsImport.findUnique({
                where: { sourceId_articleId: key },
              })
            )
              return false;
            const news = await tx.news.create({
              data: {
                title: detail.title,
                content,
                summary: newsSummary(content),
                canteenId: source.canteenId,
                canteenName: source.canteen?.name,
                createdBy: source.createdBy,
                status: source.autoPublish ? 'published' : 'draft',
                publishedAt: source.autoPublish ? new Date() : null,
                sourceName: source.name,
                sourceUrl: url,
              },
            });
            await tx.newsImport.create({ data: { ...key, newsId: news.id } });
            return true;
          });
          if (saved) imported++;
        }
        if (offset + page.list.length >= page.total || page.list.length === 0)
          break;
      }
      await this.prisma.newsSource.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
          lastImportedCount: imported,
          nextSyncAt: new Date(Date.now() + source.intervalMinutes * 60000),
        },
      });
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : '新闻同步失败，请稍后重试';
      await this.prisma.newsSource.update({
        where: { id },
        data: {
          lastError: message.slice(0, 300),
          lastImportedCount: imported,
          nextSyncAt: new Date(Date.now() + 5 * 60000),
        },
      });
      throw error;
    } finally {
      await this.prisma.newsSource.updateMany({
        where: { id, syncLeaseUntil: lease },
        data: { syncLeaseUntil: null },
      });
    }
  }
}
