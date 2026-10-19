import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { ModerationProviderService } from './providers/moderation-provider.service';
import {
  ModerationPolicy,
  UpdateModerationSettingsDto,
} from './moderation.types';

@Injectable()
export class ModerationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly providers: ModerationProviderService,
  ) {}

  async policy(
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ModerationPolicy> {
    const row = await tx.contentModerationSettings.findUnique({
      where: { id: 'global' },
    });
    return row
      ? {
          enabled: row.enabled,
          provider: row.provider as ModerationPolicy['provider'],
          mode: row.mode as ModerationPolicy['mode'],
        }
      : { enabled: false, provider: 'aliyun', mode: 'machine' };
  }

  private mediaMissing(): string[] {
    const missing: string[] = [];
    const secret = this.config.get<string>('MODERATION_MEDIA_SECRET', '');
    if (secret.length < 32) missing.push('MODERATION_MEDIA_SECRET');
    try {
      const url = new URL(
        this.config.get<string>('MODERATION_PUBLIC_BASE_URL', ''),
      );
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      if (
        this.config.get('NODE_ENV') === 'production' &&
        url.protocol !== 'https:'
      )
        throw new Error();
    } catch {
      missing.push('MODERATION_PUBLIC_BASE_URL');
    }
    return missing;
  }

  async get() {
    const readiness = this.providers.readiness();
    const common = this.mediaMissing();
    return {
      ...(await this.policy()),
      providers: Object.fromEntries(
        Object.entries(readiness).map(([key, value]) => [
          key,
          {
            configured: value.configured && common.length === 0,
            missing: [...value.missing, ...common],
          },
        ]),
      ),
      mediaConfigured: common.length === 0,
      mediaMissing: common,
    };
  }

  async update(dto: UpdateModerationSettingsDto) {
    const readiness = await this.get();
    if (dto.enabled) {
      if (readiness.mediaMissing.length)
        throw new BadRequestException(
          `请配置服务端环境变量：${readiness.mediaMissing.join('、')}`,
        );
      if (
        dto.mode !== 'manual' &&
        !readiness.providers[dto.provider].configured
      )
        throw new BadRequestException(
          `审核服务尚未就绪：${readiness.providers[dto.provider].missing.join('、')}`,
        );
    }
    await this.prisma.contentModerationSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...dto },
      update: dto,
    });
    return this.get();
  }
}
