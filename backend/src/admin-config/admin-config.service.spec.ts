import { Test, TestingModule } from '@nestjs/testing';
import { AdminConfigService } from './admin-config.service';
import { PrismaService } from '@/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigKeys, CONFIG_DEFINITIONS } from './config-definitions';

const mockPrismaService = {
  canteen: {
    findUnique: jest.fn(),
  },
  adminConfig: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  adminConfigTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  adminConfigItem: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('AdminConfigService', () => {
  let service: AdminConfigService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminConfigService>(AdminConfigService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGlobalConfig', () => {
    it('should return global config with templates', async () => {
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
        items: [
          {
            id: 'item-1',
            adminConfigId: 'config-1',
            templateId: 'template-1',
            key: 'review.autoApprove',
            value: 'false',
            valueType: 'boolean',
            description: '是否自动通过评价',
            category: 'review',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTemplates = [
        {
          id: 'template-1',
          key: 'review.autoApprove',
          defaultValue: 'false',
          valueType: 'boolean',
          description: '是否自动通过评价',
          category: 'review',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);
      prisma.adminConfigTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getGlobalConfig();

      expect(result.code).toBe(200);
      expect(result.data.config).not.toBeNull();
      expect(result.data.config?.items).toHaveLength(1);
      expect(result.data.templates).toHaveLength(1);
    });

    it('should return null config if no global config exists', async () => {
      prisma.adminConfig.findFirst.mockResolvedValue(null);
      prisma.adminConfigTemplate.findMany.mockResolvedValue([]);

      const result = await service.getGlobalConfig();

      expect(result.code).toBe(200);
      expect(result.data.config).toBeNull();
    });
  });

  describe('getCanteenConfig', () => {
    it('should return canteen config with global config and templates', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
        items: [
          {
            id: 'item-1',
            key: 'review.autoApprove',
            value: 'false',
            valueType: 'boolean',
            description: null,
            category: 'review',
            adminConfigId: 'config-1',
            templateId: 'template-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockTemplates = [
        {
          id: 'template-1',
          key: 'review.autoApprove',
          defaultValue: 'false',
          valueType: 'boolean',
          description: null,
          category: 'review',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);
      prisma.adminConfigTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getCanteenConfig('canteen-1');

      expect(result.code).toBe(200);
      expect(result.data.config).not.toBeNull();
      expect(result.data.globalConfig).not.toBeNull();
    });

    it('should throw NotFoundException if canteen not found', async () => {
      // Ensure canteen.findUnique returns null
      prisma.canteen.findUnique.mockResolvedValue(null);

      // Call the method and expect it to throw
      await expect(service.getCanteenConfig('not-exist')).rejects.toThrow(
        NotFoundException,
      );

      // Verify that canteen.findUnique was called with correct parameters
      expect(prisma.canteen.findUnique).toHaveBeenCalledWith({
        where: { id: 'not-exist' },
      });
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return effective config with canteen overrides', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
        items: [
          {
            id: 'item-2',
            key: 'review.autoApprove',
            value: 'true',
            valueType: 'boolean',
          },
        ],
      };
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
        items: [
          {
            id: 'item-1',
            key: 'comment.autoApprove',
            value: 'false',
            valueType: 'boolean',
          },
        ],
      };
      const mockTemplates = [
        {
          id: 'template-1',
          key: 'review.autoApprove',
          defaultValue: 'false',
          valueType: 'boolean',
        },
        {
          id: 'template-2',
          key: 'comment.autoApprove',
          defaultValue: 'false',
          valueType: 'boolean',
        },
      ];

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);
      prisma.adminConfigTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getEffectiveConfig('canteen-1');

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(2);

      const reviewConfig = result.data.items.find(
        (i) => i.key === 'review.autoApprove',
      );
      expect(reviewConfig?.value).toBe('true');
      expect(reviewConfig?.source).toBe('canteen');

      const commentConfig = result.data.items.find(
        (i) => i.key === 'comment.autoApprove',
      );
      expect(commentConfig?.value).toBe('false');
      expect(commentConfig?.source).toBe('global');
    });

    it('should use default value when no config exists', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };
      const mockTemplates = [
        {
          id: 'template-1',
          key: 'review.autoApprove',
          defaultValue: 'false',
          valueType: 'boolean',
        },
      ];

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(null);
      prisma.adminConfigTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getEffectiveConfig('canteen-1');

      expect(result.code).toBe(200);
      expect(result.data.items[0].source).toBe('default');
    });
  });

  describe('getTemplates', () => {
    it('should return paginated templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          key: 'review.autoApprove',
          defaultValue: 'false',
          valueType: 'boolean',
          description: null,
          category: 'review',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.adminConfigTemplate.count.mockResolvedValue(1);
      prisma.adminConfigTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getTemplates(1, 10);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });
  });

  describe('updateGlobalConfig', () => {
    it('should update global config for super admin', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        defaultValue: 'false',
        valueType: 'boolean',
        description: null,
        category: 'review',
      };
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
      };
      const mockConfigItem = {
        id: 'item-1',
        adminConfigId: 'config-1',
        templateId: 'template-1',
        key: 'review.autoApprove',
        value: 'true',
        valueType: 'boolean',
        description: null,
        category: 'review',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);
      prisma.adminConfigItem.upsert.mockResolvedValue(mockConfigItem);

      const result = await service.updateGlobalConfig('admin-1', null, {
        key: 'review.autoApprove',
        value: 'true',
      });

      expect(result.code).toBe(200);
      expect(result.data.value).toBe('true');
    });

    it('should throw ForbiddenException for canteen admin', async () => {
      await expect(
        service.updateGlobalConfig('admin-1', 'canteen-1', {
          key: 'review.autoApprove',
          value: 'true',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-existent key', async () => {
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.updateGlobalConfig('admin-1', null, {
          key: 'non.existent.key',
          value: 'true',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid boolean value', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        valueType: 'boolean',
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);

      await expect(
        service.updateGlobalConfig('admin-1', null, {
          key: 'review.autoApprove',
          value: 'invalid',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create global config if not exists', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        defaultValue: 'false',
        valueType: 'boolean',
        description: null,
        category: 'review',
      };
      const mockNewGlobalConfig = {
        id: 'new-config-1',
        canteenId: null,
      };
      const mockConfigItem = {
        id: 'item-1',
        adminConfigId: 'new-config-1',
        templateId: 'template-1',
        key: 'review.autoApprove',
        value: 'true',
        valueType: 'boolean',
        description: null,
        category: 'review',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findFirst.mockResolvedValue(null); // No global config exists
      prisma.adminConfig.create.mockResolvedValue(mockNewGlobalConfig);
      prisma.adminConfigItem.upsert.mockResolvedValue(mockConfigItem);

      const result = await service.updateGlobalConfig('admin-1', null, {
        key: 'review.autoApprove',
        value: 'true',
      });

      expect(prisma.adminConfig.create).toHaveBeenCalledWith({
        data: { canteenId: null },
      });
      expect(result.code).toBe(200);
      expect(result.data.value).toBe('true');
    });

    it('should throw BadRequestException for invalid JSON value', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'some.json.config',
        defaultValue: '{}',
        valueType: 'json',
        description: null,
        category: 'config',
      };
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);

      await expect(
        service.updateGlobalConfig('admin-1', null, {
          key: 'some.json.config',
          value: 'invalid json',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid number value', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'some.number.config',
        defaultValue: '10',
        valueType: 'number',
        description: null,
        category: 'config',
      };
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);

      await expect(
        service.updateGlobalConfig('admin-1', null, {
          key: 'some.number.config',
          value: 'not-a-number',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept string value without validation', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'some.string.config',
        defaultValue: 'default',
        valueType: 'string',
        description: null,
        category: 'config',
      };
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
      };
      const mockConfigItem = {
        id: 'item-1',
        adminConfigId: 'config-1',
        templateId: 'template-1',
        key: 'some.string.config',
        value: 'any string value',
        valueType: 'string',
        description: null,
        category: 'config',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);
      prisma.adminConfigItem.upsert.mockResolvedValue(mockConfigItem);

      const result = await service.updateGlobalConfig('admin-1', null, {
        key: 'some.string.config',
        value: 'any string value',
      });

      expect(result.code).toBe(200);
      expect(result.data.value).toBe('any string value');
    });
  });

  describe('updateCanteenConfig', () => {
    it('should update canteen config for super admin', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        valueType: 'boolean',
        description: null,
        category: 'review',
      };
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
      };
      const mockConfigItem = {
        id: 'item-2',
        adminConfigId: 'config-2',
        templateId: 'template-1',
        key: 'review.autoApprove',
        value: 'true',
        valueType: 'boolean',
        description: null,
        category: 'review',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);
      prisma.adminConfigItem.upsert.mockResolvedValue(mockConfigItem);

      const result = await service.updateCanteenConfig(
        'admin-1',
        null, // super admin
        'canteen-1',
        { key: 'review.autoApprove', value: 'true' },
      );

      expect(result.code).toBe(200);
      expect(result.data.value).toBe('true');
    });

    it('should update canteen config for canteen admin', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        valueType: 'boolean',
        description: null,
        category: 'review',
      };
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
      };
      const mockConfigItem = {
        id: 'item-2',
        adminConfigId: 'config-2',
        templateId: 'template-1',
        key: 'review.autoApprove',
        value: 'true',
        valueType: 'boolean',
        description: null,
        category: 'review',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);
      prisma.adminConfigItem.upsert.mockResolvedValue(mockConfigItem);

      const result = await service.updateCanteenConfig(
        'admin-1',
        'canteen-1', // canteen admin
        'canteen-1',
        { key: 'review.autoApprove', value: 'true' },
      );

      expect(result.code).toBe(200);
    });

    it('should throw ForbiddenException for admin of different canteen', async () => {
      await expect(
        service.updateCanteenConfig(
          'admin-1',
          'canteen-2', // different canteen
          'canteen-1',
          { key: 'review.autoApprove', value: 'true' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent canteen', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCanteenConfig('admin-1', null, 'not-exist', {
          key: 'review.autoApprove',
          value: 'true',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-existent key in template', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCanteenConfig('admin-1', null, 'canteen-1', {
          key: 'non.existent.key',
          value: 'true',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create canteen config if not exists', async () => {
      const mockCanteen = { id: 'canteen-1', name: '第一食堂' };
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        valueType: 'boolean',
        description: null,
        category: 'review',
      };
      const newConfig = {
        id: 'config-new',
        canteenId: 'canteen-1',
      };
      const mockConfigItem = {
        id: 'item-new',
        adminConfigId: 'config-new',
        templateId: 'template-1',
        key: 'review.autoApprove',
        value: 'true',
        valueType: 'boolean',
        description: null,
        category: 'review',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.create.mockResolvedValue(newConfig);
      prisma.adminConfigItem.upsert.mockResolvedValue(mockConfigItem);

      const result = await service.updateCanteenConfig(
        'admin-1',
        null,
        'canteen-1',
        { key: 'review.autoApprove', value: 'true' },
      );

      expect(result.code).toBe(200);
      expect(prisma.adminConfig.create).toHaveBeenCalled();
    });
  });

  describe('deleteCanteenConfigItem', () => {
    it('should delete canteen config item for super admin', async () => {
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
      };

      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);
      prisma.adminConfigItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteCanteenConfigItem(
        'admin-1',
        null,
        'canteen-1',
        'review.autoApprove',
      );

      expect(result.code).toBe(200);
      expect(result.message).toContain('已删除');
    });

    it('should throw ForbiddenException for admin of different canteen', async () => {
      await expect(
        service.deleteCanteenConfigItem(
          'admin-1',
          'canteen-2',
          'canteen-1',
          'review.autoApprove',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if canteen config not exists', async () => {
      prisma.adminConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteCanteenConfigItem(
          'admin-1',
          null,
          'canteen-1',
          'review.autoApprove',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConfigValue', () => {
    it('should return canteen config value when exists', async () => {
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
        items: [
          {
            key: 'review.autoApprove',
            value: 'true',
          },
        ],
      };

      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);

      const result = await service.getConfigValue(
        'review.autoApprove',
        'canteen-1',
      );

      expect(result).toBe('true');
    });

    it('should fallback to global config when canteen config not exists', async () => {
      const mockGlobalConfig = {
        id: 'config-1',
        canteenId: null,
        items: [
          {
            key: 'review.autoApprove',
            value: 'false',
          },
        ],
      };

      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(mockGlobalConfig);

      const result = await service.getConfigValue(
        'review.autoApprove',
        'canteen-1',
      );

      expect(result).toBe('false');
    });

    it('should fallback to template default when no config exists', async () => {
      const mockTemplate = {
        id: 'template-1',
        key: 'review.autoApprove',
        defaultValue: 'false',
      };

      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(null);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.getConfigValue(
        'review.autoApprove',
        'canteen-1',
      );

      expect(result).toBe('false');
    });
  });

  describe('getBooleanConfigValue', () => {
    it('should return true for "true" string', async () => {
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
        items: [
          {
            key: 'review.autoApprove',
            value: 'true',
          },
        ],
      };

      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);

      const result = await service.getBooleanConfigValue(
        'review.autoApprove',
        'canteen-1',
      );

      expect(result).toBe(true);
    });

    it('should return false for "false" string', async () => {
      const mockCanteenConfig = {
        id: 'config-2',
        canteenId: 'canteen-1',
        items: [
          {
            key: 'review.autoApprove',
            value: 'false',
          },
        ],
      };

      prisma.adminConfig.findUnique.mockResolvedValue(mockCanteenConfig);

      const result = await service.getBooleanConfigValue(
        'review.autoApprove',
        'canteen-1',
      );

      expect(result).toBe(false);
    });

    it('should return hardcoded default when no config and no template exists', async () => {
      // Simulate production environment where database has no config data
      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(null);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(null);

      // Should use hardcoded default from config-definitions.ts
      const result = await service.getBooleanConfigValue(
        ConfigKeys.REVIEW_AUTO_APPROVE,
        'canteen-1',
      );

      // Default for review.autoApprove is 'false' in CONFIG_DEFINITIONS
      expect(result).toBe(false);
    });

    it('should use config definition default when value is null', async () => {
      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(null);
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(null);

      // Test with known config key that has boolean default
      const result = await service.getBooleanConfigValue(
        ConfigKeys.COMMENT_AUTO_APPROVE,
      );

      expect(result).toBe(false);
    });
  });

  describe('getNumberConfigValue', () => {
    it('should return number value from config', async () => {
      const mockConfig = {
        id: 'config-1',
        canteenId: null,
        items: [{ key: 'test.number', value: '42' }],
      };

      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await service.getNumberConfigValue('test.number');

      expect(result).toBe(42);
    });

    it('should return null for non-numeric value', async () => {
      const mockConfig = {
        id: 'config-1',
        canteenId: null,
        items: [{ key: 'test.number', value: 'not-a-number' }],
      };

      prisma.adminConfig.findUnique.mockResolvedValue(null);
      prisma.adminConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await service.getNumberConfigValue('test.number');

      expect(result).toBeNull();
    });
  });

  describe('syncConfigTemplates (via onModuleInit)', () => {
    it('should create missing config templates on init', async () => {
      // All templates missing
      prisma.adminConfigTemplate.findUnique.mockResolvedValue(null);
      prisma.adminConfigTemplate.create.mockResolvedValue({});

      await service.onModuleInit();

      // Should attempt to create templates for all definitions
      expect(prisma.adminConfigTemplate.create).toHaveBeenCalledTimes(
        CONFIG_DEFINITIONS.length,
      );
    });

    it('should update existing templates with changed metadata', async () => {
      const existingTemplate = {
        id: 'template-1',
        key: ConfigKeys.REVIEW_AUTO_APPROVE,
        defaultValue: 'false',
        valueType: 'boolean',
        description: 'old description',
        category: 'old-category',
      };

      prisma.adminConfigTemplate.findUnique.mockResolvedValue(existingTemplate);
      prisma.adminConfigTemplate.update.mockResolvedValue({});

      await service.onModuleInit();

      // Should update templates with changed description/category
      expect(prisma.adminConfigTemplate.update).toHaveBeenCalled();
    });
  });
});
