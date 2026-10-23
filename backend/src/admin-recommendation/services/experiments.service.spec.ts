import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { ExperimentService } from '@/recommendation/services/experiment.service';
import { RecommendationCatalogService } from '@/recommendation-platform/catalog.service';
import { ExperimentsService } from './experiments.service';

const experimentFixture = (status = 'draft') => ({
  id: 'exp-1',
  name: 'Test Experiment',
  description: 'Test description',
  scene: 'home',
  priority: 0,
  trafficRatio: 0.5,
  status,
  startTime: new Date('2026-01-01'),
  endTime: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  groupItems: [
    {
      id: 'group-1',
      name: 'control',
      ratio: 0.5,
      config: {},
      strategyRevisionId: null,
      experimentId: 'exp-1',
    },
    {
      id: 'group-2',
      name: 'treatment',
      ratio: 0.5,
      config: { weights: { preferenceMatch: 25 } },
      strategyRevisionId: null,
      experimentId: 'exp-1',
    },
  ],
});
const validDto = () => ({
  name: 'New Experiment',
  description: 'Description',
  trafficRatio: 0.5,
  startTime: '2026-01-01T00:00:00.000Z',
  groups: [
    { name: 'control', ratio: 0.5, config: {} },
    {
      name: 'treatment',
      ratio: 0.5,
      config: { weights: { preferenceMatch: 25 } },
    },
  ],
});
const mocks = () => ({
  experiment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  experimentGroupItem: {
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  recommendationStrategy: { findUnique: jest.fn() },
  $transaction: jest.fn(),
});

describe('ExperimentsService', () => {
  let service: ExperimentsService;
  let prisma: ReturnType<typeof mocks>;
  let experimentService: { refreshActiveExperiments: jest.Mock };
  let catalog: { validateReferences: jest.Mock };

  beforeEach(async () => {
    prisma = mocks();
    prisma.experiment.findUnique.mockResolvedValue(experimentFixture());
    prisma.experiment.create.mockResolvedValue({
      ...experimentFixture(),
      id: 'new-exp-1',
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    experimentService = {
      refreshActiveExperiments: jest.fn().mockResolvedValue(undefined),
    };
    catalog = { validateReferences: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExperimentService, useValue: experimentService },
        { provide: RecommendationCatalogService, useValue: catalog },
      ],
    }).compile();
    service = module.get(ExperimentsService);
  });

  const expectNoWrites = () => {
    expect(prisma.experiment.create).not.toHaveBeenCalled();
    expect(prisma.experiment.update).not.toHaveBeenCalled();
    expect(prisma.experiment.delete).not.toHaveBeenCalled();
    expect(prisma.experimentGroupItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.experimentGroupItem.createMany).not.toHaveBeenCalled();
    expect(experimentService.refreshActiveExperiments).not.toHaveBeenCalled();
  };

  it('is defined', () => expect(service).toBeDefined());

  it.each([
    { weights: { dishQuality: -1 } },
    { recallQuota: { vectorQuota: 1 } },
    { algorithm: 'unused' },
  ])(
    'rejects unsupported group config before any mutation: %j',
    async (config) => {
      const groups = [{ name: 'control', ratio: 1, config }];
      await expect(
        service.createExperiment({ ...validDto(), groups }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateExperiment('exp-1', { groups }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    },
  );

  describe('reads', () => {
    it('returns all experiment fields and groups', async () => {
      prisma.experiment.findMany.mockResolvedValue([experimentFixture()]);
      const result = await service.getAllExperiments();
      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]).toMatchObject({
        name: 'Test Experiment',
        scene: 'home',
        priority: 0,
        groups: [{ id: 'group-1' }, { id: 'group-2' }],
      });
    });
    it('returns an empty list', async () => {
      prisma.experiment.findMany.mockResolvedValue([]);
      expect((await service.getAllExperiments()).data.items).toEqual([]);
    });
    it('returns the requested experiment', async () => {
      expect((await service.getExperiment('exp-1')).data.name).toBe(
        'Test Experiment',
      );
    });
    it('returns 404 for a missing experiment', async () => {
      prisma.experiment.findUnique.mockResolvedValue(null);
      await expect(service.getExperiment('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
    it('returns group config and rejects an absent group', async () => {
      const group = experimentFixture().groupItems[0];
      prisma.experimentGroupItem.findUnique
        .mockResolvedValueOnce(group)
        .mockResolvedValueOnce(null);
      expect((await service.getGroupConfig(group.id)).data).toEqual(group);
      await expect(service.getGroupConfig('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createExperiment', () => {
    it('creates a draft in a serializable transaction and refreshes after commit', async () => {
      const result = await service.createExperiment(validDto());
      expect(result).toMatchObject({ code: 201, data: 'new-exp-1' });
      expect(prisma.experiment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'draft',
          startTime: new Date('2026-01-01'),
        }),
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      expect(experimentService.refreshActiveExperiments).toHaveBeenCalledTimes(
        1,
      );
    });
    it.each(
      [
        [
          { name: 'control', ratio: 0.3 },
          { name: 'treatment', ratio: 0.3 },
        ],
        [
          { name: 'same', ratio: 0.5 },
          { name: 'same', ratio: 0.5 },
        ],
        [
          { name: 'control', ratio: -1 },
          { name: 'treatment', ratio: 2 },
        ],
        [],
      ].map((groups) => [groups]),
    )('rejects invalid group names and proportions %j', async (groups) => {
      await expect(
        service.createExperiment({ ...validDto(), groups }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
    it.each([
      '2025-12-31T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      'invalid',
    ])('rejects invalid end time %s', async (endTime) => {
      await expect(
        service.createExperiment({ ...validDto(), endTime }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
    it('preserves creation failures without refreshing active experiments', async () => {
      const error = new Error('Database unavailable');
      prisma.experiment.create.mockRejectedValue(error);
      await expect(service.createExperiment(validDto())).rejects.toBe(error);
      expect(experimentService.refreshActiveExperiments).not.toHaveBeenCalled();
    });
  });

  describe('draft updates', () => {
    it('updates draft fields', async () => {
      expect(
        (await service.updateExperiment('exp-1', { name: 'Updated Name' }))
          .code,
      ).toBe(200);
      expect(prisma.experiment.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({ name: 'Updated Name' }),
      });
    });
    it('replaces draft groups and persists an explicitly empty configuration', async () => {
      await service.updateExperiment('exp-1', {
        groups: [{ id: 'group-2', name: 'treatment', ratio: 1, config: {} }],
      });
      expect(prisma.experimentGroupItem.deleteMany).toHaveBeenCalledWith({
        where: { experimentId: 'exp-1' },
      });
      expect(prisma.experimentGroupItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            id: 'group-2',
            experimentId: 'exp-1',
            name: 'treatment',
            ratio: 1,
            strategyRevisionId: null,
            config: {},
          },
        ],
      });
    });
    it.each(
      [
        [{ id: 'foreign-group', name: 'other', ratio: 1 }],
        [
          { id: 'group-1', name: 'one', ratio: 0.5 },
          { id: 'group-1', name: 'two', ratio: 0.5 },
        ],
      ].map((groups) => [groups]),
    )('rejects unknown or duplicate group IDs %j', async (groups) => {
      await expect(
        service.updateExperiment('exp-1', { groups }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
    it('validates updated times against the stored start time', async () => {
      await expect(
        service.updateExperiment('exp-1', {
          endTime: '2025-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
  });

  describe('published strategy references', () => {
    const boundGroups = [
      { name: 'variant', ratio: 1, strategyRevisionId: 'strategy-1' },
    ];
    it('validates same-scene published references inside the transaction', async () => {
      const strategy = { id: 'strategy-1', status: 'published', scene: 'home' };
      prisma.recommendationStrategy.findUnique.mockResolvedValue(strategy);
      await service.createExperiment({ ...validDto(), groups: boundGroups });
      expect(catalog.validateReferences).toHaveBeenCalledWith(prisma, strategy);
      expect(prisma.experiment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupItems: { create: [{ ...boundGroups[0], config: {} }] },
        }),
      });
    });
    it.each([
      null,
      { id: 'strategy-1', status: 'draft', scene: 'home' },
      { id: 'strategy-1', status: 'published', scene: 'search' },
    ])('rejects absent, draft or cross-scene strategy %j', async (strategy) => {
      prisma.recommendationStrategy.findUnique.mockResolvedValue(strategy);
      await expect(
        service.createExperiment({ ...validDto(), groups: boundGroups }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
    it('rejects simultaneous strategy and inline configuration', async () => {
      await expect(
        service.createExperiment({
          ...validDto(),
          groups: [
            { ...boundGroups[0], config: { weights: { dishQuality: 10 } } },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
    it('propagates invalid model/index references without mutating the experiment', async () => {
      prisma.recommendationStrategy.findUnique.mockResolvedValue({
        id: 'strategy-1',
        status: 'published',
        scene: 'home',
      });
      const error = new BadRequestException('Index is not ready');
      catalog.validateReferences.mockRejectedValue(error);
      await expect(
        service.createExperiment({ ...validDto(), groups: boundGroups }),
      ).rejects.toBe(error);
      expectNoWrites();
    });
    it('revalidates the stored group strategy when enabling a draft', async () => {
      prisma.experiment.findUnique.mockResolvedValue({
        ...experimentFixture(),
        groupItems: [{ id: 'group-1', ...boundGroups[0], config: {} }],
      });
      const strategy = { id: 'strategy-1', status: 'published', scene: 'home' };
      prisma.recommendationStrategy.findUnique.mockResolvedValue(strategy);
      await service.enableExperiment('exp-1');
      expect(catalog.validateReferences).toHaveBeenCalledWith(prisma, strategy);
    });
    it('validates the new scene against existing group bindings', async () => {
      prisma.experiment.findUnique.mockResolvedValue({
        ...experimentFixture(),
        groupItems: [{ id: 'group-1', ...boundGroups[0], config: {} }],
      });
      prisma.recommendationStrategy.findUnique.mockResolvedValue({
        id: 'strategy-1',
        status: 'published',
        scene: 'home',
      });
      await expect(
        service.updateExperiment('exp-1', { scene: 'search' }),
      ).rejects.toThrow(BadRequestException);
      expectNoWrites();
    });
  });

  describe('lifecycle', () => {
    it.each([
      ['draft', 'enableExperiment', 'running'],
      ['running', 'disableExperiment', 'paused'],
      ['running', 'completeExperiment', 'completed'],
      ['paused', 'enableExperiment', 'running'],
      ['paused', 'completeExperiment', 'completed'],
    ] as const)(
      'transitions %s with %s to %s',
      async (from, method, status) => {
        prisma.experiment.findUnique.mockResolvedValue(experimentFixture(from));
        expect((await service[method]('exp-1')).code).toBe(200);
        expect(prisma.experiment.update).toHaveBeenCalledWith({
          where: { id: 'exp-1' },
          data: expect.objectContaining({ status }),
        });
        expect(
          experimentService.refreshActiveExperiments,
        ).toHaveBeenCalledTimes(1);
      },
    );
    it.each(['running', 'paused'])(
      'allows traffic changes for %s experiments',
      async (status) => {
        prisma.experiment.findUnique.mockResolvedValue(
          experimentFixture(status),
        );
        await service.updateExperiment('exp-1', { trafficRatio: 0.75 });
        expect(prisma.experiment.update).toHaveBeenCalledWith({
          where: { id: 'exp-1' },
          data: expect.objectContaining({ trafficRatio: 0.75 }),
        });
      },
    );
    it.each(['running', 'paused'])(
      'locks groups, times and metadata for %s experiments',
      async (status) => {
        prisma.experiment.findUnique.mockResolvedValue(
          experimentFixture(status),
        );
        for (const data of [
          { name: 'Changed' },
          { scene: 'search' },
          { priority: 2 },
          { startTime: '2026-02-01' },
          { groups: [{ name: 'replacement', ratio: 1 }] },
        ]) {
          await expect(service.updateExperiment('exp-1', data)).rejects.toThrow(
            ConflictException,
          );
        }
        expectNoWrites();
      },
    );
    it('keeps completed experiments read-only', async () => {
      prisma.experiment.findUnique.mockResolvedValue(
        experimentFixture('completed'),
      );
      await expect(
        service.updateExperiment('exp-1', { trafficRatio: 0.75 }),
      ).rejects.toThrow(ConflictException);
      await expect(service.enableExperiment('exp-1')).rejects.toThrow(
        ConflictException,
      );
      expectNoWrites();
    });
    it('rejects invalid state transitions', async () => {
      await expect(service.disableExperiment('exp-1')).rejects.toThrow(
        ConflictException,
      );
      expectNoWrites();
    });
    it('deletes a draft and refreshes active experiments', async () => {
      expect((await service.deleteExperiment('exp-1')).code).toBe(200);
      expect(prisma.experiment.delete).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
      });
      expect(experimentService.refreshActiveExperiments).toHaveBeenCalledTimes(
        1,
      );
    });
    it.each(['running', 'paused', 'completed'])(
      'preserves %s experiment configuration and statistics',
      async (status) => {
        prisma.experiment.findUnique.mockResolvedValue(
          experimentFixture(status),
        );
        await expect(service.deleteExperiment('exp-1')).rejects.toThrow(
          ConflictException,
        );
        expectNoWrites();
      },
    );
  });

  describe.each([
    'updateExperiment',
    'deleteExperiment',
    'enableExperiment',
    'disableExperiment',
    'completeExperiment',
  ] as const)('%s failure handling', (method) => {
    const invoke = () =>
      method === 'updateExperiment'
        ? service.updateExperiment('missing-id', { name: 'Updated' })
        : service[method]('missing-id');
    it('returns 404 when the transactional lookup finds no experiment', async () => {
      prisma.experiment.findUnique.mockResolvedValue(null);
      await expect(invoke()).rejects.toThrow(NotFoundException);
      expectNoWrites();
    });
    it('preserves unexpected transaction errors without refreshing caches', async () => {
      const error = new Error('Database unavailable');
      prisma.$transaction.mockRejectedValue(error);
      await expect(invoke()).rejects.toBe(error);
      expectNoWrites();
    });
  });

  it('retries serialization conflicts before refreshing once', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Conflict', {
        code: 'P2034',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );
    await service.createExperiment(validDto());
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.experiment.create).toHaveBeenCalledTimes(1);
    expect(experimentService.refreshActiveExperiments).toHaveBeenCalledTimes(1);
  });
});
