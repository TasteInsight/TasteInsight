import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentsService } from './experiments.service';
import { PrismaService } from '@/prisma.service';
import { ExperimentService } from '@/recommendation/services/experiment.service';
import { NotFoundException } from '@nestjs/common';

describe('ExperimentsService', () => {
  let service: ExperimentsService;
  let prisma: any;
  let experimentService: any;

  const mockExperiment = {
    id: 'exp-1',
    name: 'Test Experiment',
    description: 'Test description',
    trafficRatio: 0.5,
    status: 'draft',
    startTime: new Date(),
    endTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    groupItems: [
      {
        id: 'group-1',
        name: 'control',
        ratio: 0.5,
        config: {},
        experimentId: 'exp-1',
      },
      {
        id: 'group-2',
        name: 'treatment',
        ratio: 0.5,
        config: { algorithm: 'v2' },
        experimentId: 'exp-1',
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      experiment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      experimentGroupItem: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };

    experimentService = {
      refreshActiveExperiments: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ExperimentService,
          useValue: experimentService,
        },
      ],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllExperiments', () => {
    it('should return all experiments', async () => {
      prisma.experiment.findMany.mockResolvedValue([mockExperiment]);

      const result = await service.getAllExperiments();

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].name).toBe('Test Experiment');
    });

    it('should return empty list when no experiments', async () => {
      prisma.experiment.findMany.mockResolvedValue([]);

      const result = await service.getAllExperiments();

      expect(result.data.items).toHaveLength(0);
    });
  });

  describe('getExperiment', () => {
    it('should return experiment when found', async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockExperiment);

      const result = await service.getExperiment('exp-1');

      expect(result.code).toBe(200);
      expect(result.data.name).toBe('Test Experiment');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.experiment.findUnique.mockResolvedValue(null);

      await expect(service.getExperiment('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createExperiment', () => {
    const validDto = {
      name: 'New Experiment',
      description: 'Description',
      trafficRatio: 0.5,
      startTime: new Date().toISOString(),
      groups: [
        { name: 'control', ratio: 0.5, config: {} },
        { name: 'treatment', ratio: 0.5, config: { algorithm: 'v2' } },
      ],
    };

    it('should create experiment with valid data', async () => {
      prisma.experiment.create.mockResolvedValue({
        id: 'new-exp-1',
        ...mockExperiment,
      });

      const result = await service.createExperiment(validDto as any);

      expect(result.code).toBe(201);
      expect(result.message).toContain('successfully');
      expect(experimentService.refreshActiveExperiments).toHaveBeenCalled();
    });

    it('should throw error if group ratios do not sum to 1', async () => {
      const invalidDto = {
        ...validDto,
        groups: [
          { name: 'control', ratio: 0.3, config: {} },
          { name: 'treatment', ratio: 0.3, config: {} },
        ],
      };

      await expect(service.createExperiment(invalidDto as any)).rejects.toThrow(
        '分组占比之和必须为 1',
      );
    });

    it('should throw error if group names are duplicated', async () => {
      const invalidDto = {
        ...validDto,
        groups: [
          { name: 'control', ratio: 0.5, config: {} },
          { name: 'control', ratio: 0.5, config: {} },
        ],
      };

      await expect(service.createExperiment(invalidDto as any)).rejects.toThrow(
        '分组名称重复',
      );
    });
  });

  describe('updateExperiment', () => {
    it('should update experiment with valid data', async () => {
      prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback({
          experiment: {
            update: jest.fn().mockResolvedValue(mockExperiment),
          },
          experimentGroupItem: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn(),
            update: jest.fn(),
            createMany: jest.fn(),
          },
        });
      });

      const result = await service.updateExperiment('exp-1', {
        name: 'Updated Name',
      } as any);

      expect(result.code).toBe(200);
    });
  });

  describe('enableExperiment', () => {
    it('should enable experiment', async () => {
      prisma.experiment.update.mockResolvedValue({
        ...mockExperiment,
        status: 'running',
      });

      const result = await service.enableExperiment('exp-1');

      expect(result.code).toBe(200);
      expect(experimentService.refreshActiveExperiments).toHaveBeenCalled();
    });
  });

  describe('disableExperiment', () => {
    it('should disable experiment', async () => {
      prisma.experiment.update.mockResolvedValue({
        ...mockExperiment,
        status: 'paused',
      });

      const result = await service.disableExperiment('exp-1');

      expect(result.code).toBe(200);
      expect(experimentService.refreshActiveExperiments).toHaveBeenCalled();
    });
  });

  describe('completeExperiment', () => {
    it('should complete experiment', async () => {
      prisma.experiment.update.mockResolvedValue({
        ...mockExperiment,
        status: 'completed',
      });

      const result = await service.completeExperiment('exp-1');

      expect(result.code).toBe(200);
      expect(experimentService.refreshActiveExperiments).toHaveBeenCalled();
    });
  });

  describe('deleteExperiment', () => {
    it('should delete experiment', async () => {
      prisma.experiment.delete.mockResolvedValue(mockExperiment);

      const result = await service.deleteExperiment('exp-1');

      expect(result.code).toBe(200);
      expect(prisma.experiment.delete).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
      });
    });
  });
});
