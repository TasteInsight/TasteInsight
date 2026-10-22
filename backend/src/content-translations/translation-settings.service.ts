import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { AIProviderConfig } from '@/ai-chat/services/ai-provider/base-ai-provider.interface';
import { UpdateTranslationSettingsDto } from './dto/update-translation-settings.dto';

const FIELDS = ['enabled', 'model', 'baseUrl', 'apiKey'] as const;
const KEYS = {
  enabled: 'ai.translation.enabled',
  model: 'ai.translation.model',
  baseUrl: 'ai.translation.base_url',
  apiKey: 'ai.translation.api_key',
} as const;
const ENV_KEYS = {
  enabled: 'AI_TRANSLATION_ENABLED',
  model: 'AI_TRANSLATION_MODEL',
  baseUrl: 'AI_TRANSLATION_BASE_URL',
  apiKey: 'AI_TRANSLATION_API_KEY',
} as const;

type Field = (typeof FIELDS)[number];
export interface TranslationSettings {
  enabled: boolean;
  available: boolean;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  managedByEnv: Record<Field, boolean>;
  invalidFields: ('enabled' | 'baseUrl')[];
}

function validBaseUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !value.includes('?') &&
      !value.includes('#')
    );
  } catch {
    return false;
  }
}

@Injectable()
export class TranslationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(): Promise<
    Pick<TranslationSettings, 'enabled' | 'available'>
  > {
    const { settings } = await this.readConfiguration();
    return { enabled: settings.enabled, available: settings.available };
  }

  async getSettings(admin: AdminInfo): Promise<TranslationSettings> {
    this.requireGlobalScope(admin);
    return (await this.readConfiguration()).settings;
  }

  async updateSettings(
    dto: UpdateTranslationSettingsDto,
    admin: AdminInfo,
  ): Promise<TranslationSettings> {
    this.requireGlobalScope(admin);
    const environment = this.environment();
    const updates = FIELDS.filter((field) => dto[field] !== undefined);
    for (const field of updates) {
      if (environment[field] !== undefined) {
        throw new BadRequestException(
          '环境变量管理的翻译配置需由部署管理员修改',
        );
      }
    }
    if (dto.baseUrl !== undefined && !validBaseUrl(dto.baseUrl)) {
      throw new BadRequestException(
        '服务地址须为 HTTP(S) 地址，且不含用户名、密码、查询参数或片段',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Separate field rows share the enabled/configured invariant.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('tasteinsight.translation-settings'))`;
        for (const field of updates) {
          const value = dto[field];
          if (field === 'apiKey' && value === null) {
            await tx.aIConfig.deleteMany({ where: { key: KEYS.apiKey } });
          } else if (field !== 'apiKey' || value !== '') {
            await tx.aIConfig.upsert({
              where: { key: KEYS[field] },
              create: {
                key: KEYS[field],
                value: String(value),
                category: 'translation',
              },
              update: { value: String(value), category: 'translation' },
            });
          }
        }
        const { settings } = await this.readConfiguration(tx);
        if (settings.enabled && !settings.available) {
          throw new BadRequestException(
            '启用翻译辅助需配置模型、API Key 与有效服务地址；清除 API Key 时请同时关闭翻译辅助',
          );
        }
        return settings;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // Prisma errors can contain write arguments, including the secret value.
      throw new InternalServerErrorException('翻译配置保存失败，请稍后重试');
    }
  }

  async getProviderConfig(): Promise<AIProviderConfig> {
    const { settings, apiKey } = await this.readConfiguration();
    if (!settings.enabled) {
      throw new ServiceUnavailableException(
        '翻译辅助尚未启用，请手工填写英文或联系全局配置管理员',
      );
    }
    if (!settings.available) {
      throw new ServiceUnavailableException(
        '翻译辅助配置尚未完成，请手工填写英文或联系全局配置管理员',
      );
    }
    return {
      apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl || 'https://api.openai.com/v1',
    };
  }

  private requireGlobalScope(admin: AdminInfo): void {
    if (admin.scope !== 'GLOBAL') {
      throw new ForbiddenException('翻译配置需要全局管理权限');
    }
  }

  private environment(): Record<Field, string | undefined> {
    return Object.fromEntries(
      FIELDS.map((field) => {
        const value = this.config.get<string>(ENV_KEYS[field])?.trim();
        return [field, value || undefined];
      }),
    ) as Record<Field, string | undefined>;
  }

  private async readConfiguration(
    client: Pick<Prisma.TransactionClient, 'aIConfig'> = this.prisma,
  ): Promise<{ settings: TranslationSettings; apiKey: string }> {
    const rows = await client.aIConfig.findMany({
      where: { key: { in: Object.values(KEYS) } },
      select: { key: true, value: true },
    });
    const values = new Map(rows.map(({ key, value }) => [key, value]));
    const environment = this.environment();
    const effective = (field: Field) =>
      environment[field] ?? values.get(KEYS[field])?.trim() ?? '';
    const enabledValue = effective('enabled');
    const enabled = enabledValue === 'true';
    const apiKey = effective('apiKey');
    const model = effective('model');
    const baseUrl = effective('baseUrl');
    const validUrl = validBaseUrl(baseUrl);
    return {
      apiKey,
      settings: {
        enabled,
        available: enabled && Boolean(apiKey && model) && validUrl,
        model,
        baseUrl: validUrl ? baseUrl : '',
        apiKeyConfigured: Boolean(apiKey),
        invalidFields: [
          ...(!['', 'true', 'false'].includes(enabledValue)
            ? (['enabled'] as const)
            : []),
          ...(!validUrl ? (['baseUrl'] as const) : []),
        ],
        managedByEnv: Object.fromEntries(
          FIELDS.map((field) => [field, environment[field] !== undefined]),
        ) as Record<Field, boolean>,
      },
    };
  }
}
