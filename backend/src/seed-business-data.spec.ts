import type { PrismaClient } from '@prisma/client';
import { clearSeedBusinessData } from '../prisma/clear-seed-data';

describe('clearSeedBusinessData', () => {
  const models = [
    'operationLog',
    'recommendationEvent',
    'userExperimentAssignment',
    'dishEmbedding',
    'mealPlanDish',
    'mealPlan',
    'browseHistory',
    'favoriteDish',
    'report',
    'comment',
    'review',
    'dishUpload',
    'dish',
    'window',
    'floor',
    'news',
    'adminPermission',
    'admin',
    'canteen',
    'user',
  ];

  const fixture = () => {
    const operations = models.map((model) => ({ model, action: 'deleteMany' }));
    const prisma = {
      ...Object.fromEntries(
        models.map((model, index) => [
          model,
          { deleteMany: jest.fn().mockReturnValue(operations[index]) },
        ]),
      ),
      aiConfig: { deleteMany: jest.fn() },
      experiment: { deleteMany: jest.fn() },
      adminConfigTemplate: { deleteMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    return { prisma, operations };
  };

  it('clears restrictive and logical dependents before their parents in one transaction', async () => {
    const { prisma, operations } = fixture();
    await clearSeedBusinessData(prisma as unknown as PrismaClient);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(operations);
    expect(prisma.aiConfig.deleteMany).not.toHaveBeenCalled();
    expect(prisma.experiment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.adminConfigTemplate.deleteMany).not.toHaveBeenCalled();
  });

  it('propagates a failed cleanup transaction so seeding cannot continue', async () => {
    const { prisma } = fixture();
    const error = new Error('Cleanup transaction failed');
    prisma.$transaction.mockRejectedValue(error);

    await expect(
      clearSeedBusinessData(prisma as unknown as PrismaClient),
    ).rejects.toBe(error);
  });
});
