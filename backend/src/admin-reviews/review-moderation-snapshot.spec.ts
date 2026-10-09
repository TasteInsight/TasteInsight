import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminReviewsService } from './admin-reviews.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { RejectReviewDto } from './dto/reject-review.dto';

describe('review moderation snapshot', () => {
  const expectedUpdatedAt = '2026-10-08T12:00:00.000Z';
  const admin = { id: 'a1', canteenId: 'c1' };
  let prisma: any;
  let stats: any;
  let service: AdminReviewsService;

  beforeEach(() => {
    prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1',
          dishId: 'd1',
          status: 'pending',
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          dish: { canteenId: 'c1' },
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    stats = { recomputeDishStats: jest.fn() };
    service = new AdminReviewsService(prisma, stats);
  });

  it.each(['approveReview', 'rejectReview'] as const)(
    '%s atomically checks the displayed version and pending lifecycle',
    async (method) => {
      const dto = { expectedUpdatedAt, reason: '不符合要求' };
      await (service[method] as any)('r1', dto, admin);
      expect(prisma.review.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'r1',
          deletedAt: null,
          status: 'pending',
          updatedAt: new Date(expectedUpdatedAt),
          dish: { canteenId: 'c1' },
        },
        data:
          method === 'approveReview'
            ? { status: 'approved', rejectReason: null }
            : { status: 'rejected', rejectReason: '不符合要求' },
      });
      expect(prisma.review.update).not.toHaveBeenCalled();
      expect(stats.recomputeDishStats).toHaveBeenCalledWith('d1');
    },
  );

  it.each(['approveReview', 'rejectReview'] as const)(
    '%s rejects a changed, deleted, or already moderated snapshot without updating statistics',
    async (method) => {
      prisma.review.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        (service[method] as any)(
          'r1',
          { expectedUpdatedAt, reason: 'reason' },
          admin,
        ),
      ).rejects.toThrow(ConflictException);
      expect(stats.recomputeDishStats).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing record before attempting moderation', async () => {
    prisma.review.findUnique.mockResolvedValue(null);
    await expect(
      (service.approveReview as any)('missing', { expectedUpdatedAt }, admin),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.review.updateMany).not.toHaveBeenCalled();
  });

  it('rejects another canteen before attempting moderation', async () => {
    await expect(
      (service.approveReview as any)(
        'r1',
        { expectedUpdatedAt },
        { canteenId: 'c2' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.review.updateMany).not.toHaveBeenCalled();
  });

  it.each([ModerateReviewDto, RejectReviewDto])(
    'requires a valid snapshot timestamp at the request boundary',
    async (Dto) => {
      expect(
        await validate(plainToInstance(Dto, { reason: 'reason' })),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'expectedUpdatedAt' }),
        ]),
      );
      expect(
        await validate(
          plainToInstance(Dto, {
            reason: 'reason',
            expectedUpdatedAt: 'invalid',
          }),
        ),
      ).not.toHaveLength(0);
      expect(
        await validate(
          plainToInstance(Dto, { reason: 'reason', expectedUpdatedAt }),
        ),
      ).toHaveLength(0);
    },
  );
});
