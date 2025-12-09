import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  UpdateGlobalConfigDto,
  UpdateCanteenConfigDto,
} from './dto/update-config.dto';
import {
  GlobalConfigResponseDto,
  CanteenConfigResponseDto,
  ConfigTemplateListResponseDto,
  ConfigItemResponseDto,
  EffectiveConfigListResponseDto,
  ConfigSuccessResponseDto,
  ConfigItemDto,
  AdminConfigDto,
  ConfigTemplateDto,
  EffectiveConfigValueDto,
} from './dto/admin-config-response.dto';

@Injectable()
export class AdminConfigService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取全局配置
   */
  async getGlobalConfig(): Promise<GlobalConfigResponseDto> {
    const [config, templates] = await Promise.all([
      this.prisma.adminConfig.findFirst({
        where: { canteenId: null },
        include: { items: true },
      }),
      this.prisma.adminConfigTemplate.findMany({
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        config: config ? this.toAdminConfigDto(config as any) : null,
        templates: templates.map((t) => this.toConfigTemplateDto(t)),
      },
    };
  }

  /**
   * 获取食堂配置
   */
  async getCanteenConfig(canteenId: string): Promise<CanteenConfigResponseDto> {
    // 验证食堂是否存在
    const canteen = await this.prisma.canteen.findUnique({
      where: { id: canteenId },
    });

    if (!canteen) {
      throw new NotFoundException('食堂不存在');
    }

    const [config, globalConfig, templates] = await Promise.all([
      this.prisma.adminConfig.findUnique({
        where: { canteenId },
        include: { items: true },
      }),
      this.prisma.adminConfig.findFirst({
        where: { canteenId: null },
        include: { items: true },
      }),
      this.prisma.adminConfigTemplate.findMany({
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        config: config ? this.toAdminConfigDto(config as any) : null,
        globalConfig: globalConfig
          ? this.toAdminConfigDto(globalConfig as any)
          : null,
        templates: templates.map((t) => this.toConfigTemplateDto(t)),
      },
    };
  }

  /**
   * 获取食堂的有效配置（合并 global 和食堂配置）
   */
  async getEffectiveConfig(
    canteenId: string,
  ): Promise<EffectiveConfigListResponseDto> {
    // 验证食堂是否存在
    const canteen = await this.prisma.canteen.findUnique({
      where: { id: canteenId },
    });

    if (!canteen) {
      throw new NotFoundException('食堂不存在');
    }

    const [canteenConfig, globalConfig, templates] = await Promise.all([
      this.prisma.adminConfig.findUnique({
        where: { canteenId },
        include: { items: true },
      }),
      this.prisma.adminConfig.findFirst({
        where: { canteenId: null },
        include: { items: true },
      }),
      this.prisma.adminConfigTemplate.findMany(),
    ]);

    // 构建有效配置：食堂配置 > 全局配置 > 默认值
    const effectiveItems: EffectiveConfigValueDto[] = [];

    for (const template of templates) {
      // 首先尝试从食堂配置获取
      const canteenItem = canteenConfig?.items.find(
        (item) => item.key === template.key,
      );
      if (canteenItem) {
        effectiveItems.push({
          key: template.key,
          value: canteenItem.value,
          valueType: canteenItem.valueType,
          source: 'canteen',
        });
        continue;
      }

      // 其次从全局配置获取
      const globalItem = globalConfig?.items.find(
        (item) => item.key === template.key,
      );
      if (globalItem) {
        effectiveItems.push({
          key: template.key,
          value: globalItem.value,
          valueType: globalItem.valueType,
          source: 'global',
        });
        continue;
      }

      // 最后使用默认值
      effectiveItems.push({
        key: template.key,
        value: template.defaultValue,
        valueType: template.valueType,
        source: 'default',
      });
    }

    return {
      code: 200,
      message: 'success',
      data: {
        items: effectiveItems,
      },
    };
  }

  /**
   * 获取所有配置模板
   */
  async getTemplates(
    page: number = 1,
    pageSize: number = 50,
  ): Promise<ConfigTemplateListResponseDto> {
    const skip = (page - 1) * pageSize;

    const [total, templates] = await Promise.all([
      this.prisma.adminConfigTemplate.count(),
      this.prisma.adminConfigTemplate.findMany({
        skip,
        take: pageSize,
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: templates.map((t) => this.toConfigTemplateDto(t)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  /**
   * 更新全局配置项
   * 只有全局管理员可以操作
   */
  async updateGlobalConfig(
    adminId: string,
    adminCanteenId: string | null,
    dto: UpdateGlobalConfigDto,
  ): Promise<ConfigItemResponseDto> {
    // 验证权限：必须是全局管理员（没有绑定食堂）
    if (adminCanteenId) {
      throw new ForbiddenException('只有全局管理员可以修改全局配置');
    }

    // 验证配置项是否存在于模板中
    const template = await this.prisma.adminConfigTemplate.findUnique({
      where: { key: dto.key },
    });

    if (!template) {
      throw new BadRequestException(`配置项 ${dto.key} 不存在`);
    }

    // 验证值类型
    this.validateValueType(dto.value, template.valueType);

    // 获取或创建全局配置
    let globalConfig = await this.prisma.adminConfig.findFirst({
      where: { canteenId: null },
    });

    if (!globalConfig) {
      globalConfig = await this.prisma.adminConfig.create({
        data: { canteenId: null },
      });
    }

    // 更新或创建配置项
    const configItem = await this.prisma.adminConfigItem.upsert({
      where: {
        adminConfigId_key: {
          adminConfigId: globalConfig.id,
          key: dto.key,
        },
      },
      update: {
        value: dto.value,
      },
      create: {
        adminConfigId: globalConfig.id,
        templateId: template.id,
        key: dto.key,
        value: dto.value,
        valueType: template.valueType,
        description: template.description,
        category: template.category,
      },
    });

    return {
      code: 200,
      message: 'success',
      data: this.toConfigItemDto(configItem),
    };
  }

  /**
   * 更新食堂配置项
   * 管理员只能修改自己所属食堂的配置，全局管理员可以修改任意食堂配置
   */
  async updateCanteenConfig(
    adminId: string,
    adminCanteenId: string | null,
    canteenId: string,
    dto: UpdateCanteenConfigDto,
  ): Promise<ConfigItemResponseDto> {
    // 验证权限：必须是超级管理员或该食堂的管理员
    if (adminCanteenId && adminCanteenId !== canteenId) {
      throw new ForbiddenException('您只能修改自己所属食堂的配置');
    }

    // 验证食堂是否存在
    const canteen = await this.prisma.canteen.findUnique({
      where: { id: canteenId },
    });

    if (!canteen) {
      throw new NotFoundException('食堂不存在');
    }

    // 验证配置项是否存在于模板中
    const template = await this.prisma.adminConfigTemplate.findUnique({
      where: { key: dto.key },
    });

    if (!template) {
      throw new BadRequestException(
        `配置项 ${dto.key} 不存在于全局配置模板中，无法创建`,
      );
    }

    // 验证值类型
    this.validateValueType(dto.value, template.valueType);

    // 获取或创建食堂配置
    let canteenConfig = await this.prisma.adminConfig.findUnique({
      where: { canteenId },
    });

    if (!canteenConfig) {
      canteenConfig = await this.prisma.adminConfig.create({
        data: { canteenId },
      });
    }

    // 更新或创建配置项
    const configItem = await this.prisma.adminConfigItem.upsert({
      where: {
        adminConfigId_key: {
          adminConfigId: canteenConfig.id,
          key: dto.key,
        },
      },
      update: {
        value: dto.value,
      },
      create: {
        adminConfigId: canteenConfig.id,
        templateId: template.id,
        key: dto.key,
        value: dto.value,
        valueType: template.valueType,
        description: template.description,
        category: template.category,
      },
    });

    return {
      code: 200,
      message: 'success',
      data: this.toConfigItemDto(configItem),
    };
  }

  /**
   * 删除食堂配置项（恢复为使用全局配置）
   */
  async deleteCanteenConfigItem(
    adminId: string,
    adminCanteenId: string | null,
    canteenId: string,
    key: string,
  ): Promise<ConfigSuccessResponseDto> {
    // 验证权限
    if (adminCanteenId && adminCanteenId !== canteenId) {
      throw new ForbiddenException('您只能修改自己所属食堂的配置');
    }

    // 获取食堂配置
    const canteenConfig = await this.prisma.adminConfig.findUnique({
      where: { canteenId },
    });

    if (!canteenConfig) {
      throw new NotFoundException('食堂配置不存在');
    }

    // 删除配置项
    await this.prisma.adminConfigItem.deleteMany({
      where: {
        adminConfigId: canteenConfig.id,
        key,
      },
    });

    return {
      code: 200,
      message: '配置项已删除，将使用全局配置',
      data: null,
    };
  }

  /**
   * 获取单个配置项的有效值（用于业务逻辑中查询）
   */
  async getConfigValue(
    key: string,
    canteenId?: string,
  ): Promise<string | null> {
    // 如果有食堂ID，先尝试获取食堂配置
    if (canteenId) {
      const canteenConfig = await this.prisma.adminConfig.findUnique({
        where: { canteenId },
        include: { items: true },
      });

      const canteenItem = canteenConfig?.items.find((item) => item.key === key);
      if (canteenItem) {
        return canteenItem.value;
      }
    }

    // 尝试获取全局配置
    const globalConfig = await this.prisma.adminConfig.findFirst({
      where: { canteenId: null },
      include: { items: true },
    });

    const globalItem = globalConfig?.items.find((item) => item.key === key);
    if (globalItem) {
      return globalItem.value;
    }

    // 使用默认值
    const template = await this.prisma.adminConfigTemplate.findUnique({
      where: { key },
    });

    return template?.defaultValue ?? null;
  }

  /**
   * 获取布尔类型配置值
   */
  async getBooleanConfigValue(
    key: string,
    canteenId?: string,
  ): Promise<boolean> {
    const value = await this.getConfigValue(key, canteenId);
    return value === 'true';
  }

  // ===== 私有辅助方法 =====

  private validateValueType(value: string, expectedType: string): void {
    switch (expectedType) {
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException(`配置值必须是 'true' 或 'false'`);
        }
        break;
      case 'number':
        if (isNaN(Number(value))) {
          throw new BadRequestException('配置值必须是数字');
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new BadRequestException('配置值必须是有效的 JSON');
        }
        break;
      // string 类型不需要验证
    }
  }

  private toConfigTemplateDto(template: any): ConfigTemplateDto {
    return {
      id: template.id,
      key: template.key,
      defaultValue: template.defaultValue,
      valueType: template.valueType,
      description: template.description,
      category: template.category,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  private toConfigItemDto(item: any): ConfigItemDto {
    return {
      id: item.id,
      adminConfigId: item.adminConfigId,
      templateId: item.templateId,
      key: item.key,
      value: item.value,
      valueType: item.valueType,
      description: item.description,
      category: item.category,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toAdminConfigDto(config: any): AdminConfigDto {
    return {
      id: config.id,
      canteenId: config.canteenId,
      items: config.items?.map((item: any) => this.toConfigItemDto(item)) ?? [],
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
