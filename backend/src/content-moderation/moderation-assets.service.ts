import { canonicalModerationImageUrl } from '@/upload/moderation-image-url';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentModerationAsset, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { LocalStorageStrategy } from '@/upload/strategies/local-storage.strategy';
import { OssStorageStrategy } from '@/upload/strategies/oss-storage.strategy';

@Injectable()
export class ModerationAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly local: LocalStorageStrategy,
    private readonly oss: OssStorageStrategy,
  ) {}

  private base() {
    return (
      this.config
        .getOrThrow<string>('MODERATION_PUBLIC_BASE_URL')
        .replace(/\/$/, '') + '/content-moderation/images/'
    );
  }
  private signature(id: string, expires: string) {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('MODERATION_MEDIA_SECRET'),
    )
      .update(`${id}:${expires}`)
      .digest('hex');
  }
  preview(id: string) {
    const expires = String(Date.now() + 60 * 60 * 1000);
    return `${canonicalModerationImageUrl(this.base() + id)}?expires=${expires}&signature=${this.signature(id, expires)}`;
  }
  assetId(url: string): string | undefined {
    if (!this.config.get<string>('MODERATION_PUBLIC_BASE_URL'))
      return undefined;
    const normalized = canonicalModerationImageUrl(url);
    const id = normalized.slice(normalized.lastIndexOf('/') + 1);
    return /^[a-zA-Z0-9_-]{15,80}$/.test(id) &&
      normalized === canonicalModerationImageUrl(this.base() + id)
      ? id
      : undefined;
  }

  async stage(file: Express.Multer.File, userId: string, animated = false) {
    const storageType = this.config.get<string>('UPLOAD_STORAGE_TYPE', 'local');
    const strategy = storageType === 'oss' ? this.oss : this.local;
    const result = await strategy.upload(file, true);
    try {
      const asset = await this.prisma.contentModerationAsset.create({
        data: {
          userId,
          storageType,
          storageKey: result.filename,
          mimeType: file.mimetype,
          animated,
        },
      });
      return { url: this.preview(asset.id), filename: result.filename };
    } catch (error) {
      await strategy.remove(result.filename).catch(() => undefined);
      throw error;
    }
  }

  async assertImages(
    tx: Prisma.TransactionClient,
    userId: string,
    images: string[],
  ) {
    for (const url of new Set(images)) {
      const id = this.assetId(url);
      if (!id) throw new BadRequestException('请重新上传图片后提交审核');
      const asset = await tx.contentModerationAsset.findUnique({
        where: { id },
      });
      if (!asset || (!asset.approved && asset.userId !== userId))
        throw new BadRequestException('图片不存在或暂不可使用');
      // Pin contribution uploads by immutable object identity before a different
      // UGC entry point can reference them. This also races safely with cleanup.
      const ledger = await tx.contributionImage.findFirst({
        where: { storageKey: asset.storageKey, storageType: asset.storageType },
      });
      if (ledger) {
        const pinned = await tx.contributionImage.updateMany({
          where: {
            id: ledger.id,
            deletedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          data: { expiresAt: null },
        });
        if (!pinned.count)
          throw new BadRequestException('图片已过期，请重新上传');
      }
    }
  }

  async approve(tx: Prisma.TransactionClient, images: string[]) {
    const ids = images
      .map((url) => this.assetId(url))
      .filter((id): id is string => !!id);
    if (ids.length)
      await tx.contentModerationAsset.updateMany({
        where: { id: { in: ids } },
        data: { approved: true },
      });
  }

  previewImages(images: string[]) {
    return images.map((url) => {
      const id = this.assetId(url);
      return id ? this.preview(id) : url;
    });
  }

  async read(
    id: string,
    expires?: string,
    signature?: string,
  ): Promise<{ asset: ContentModerationAsset; buffer: Buffer }> {
    const asset = await this.prisma.contentModerationAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('图片不存在');
    if (!asset.approved) {
      if (
        !expires ||
        !signature ||
        !/^\d{13}$/.test(expires) ||
        Number(expires) < Date.now() ||
        !/^[a-f0-9]{64}$/.test(signature)
      )
        throw new NotFoundException('图片尚未公开');
      const expected = this.signature(id, expires);
      if (
        !timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex'),
        )
      )
        throw new NotFoundException('图片尚未公开');
    }
    const strategy = asset.storageType === 'oss' ? this.oss : this.local;
    return { asset, buffer: await strategy.read(asset.storageKey) };
  }
}
