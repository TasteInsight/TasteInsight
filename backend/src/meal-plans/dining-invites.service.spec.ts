import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DiningInvitesService } from './dining-invites.service';

function fixture() {
  const applications = [
    {
      id: 'a',
      userId: 'alice',
      status: 'pending',
      updatedAt: new Date(),
      user: { id: 'alice', nickname: 'Alice', avatar: null },
    },
    {
      id: 'b',
      userId: 'bob',
      status: 'pending',
      updatedAt: new Date(),
      user: { id: 'bob', nickname: 'Bob', avatar: null },
    },
  ];
  const invite = {
    id: 'i',
    mealPlanId: 'p',
    date: new Date('2099-10-03'),
    startsAt: new Date('2099-10-03T04:00:00Z'),
    capacity: 2,
    status: 'open',
    canteenId: 'c',
    mealPlan: {
      userId: 'host',
      mealTime: 'lunch',
      startDate: new Date('2099-10-01'),
      endDate: new Date('2099-10-05'),
      dishes: ['private-dish'],
      user: {
        id: 'host',
        nickname: 'Host',
        avatar: null,
        studentVerification: {
          status: 'VERIFIED',
          expiresAt: new Date('2100-01-01'),
        },
      },
    },
    canteen: { id: 'c', name: '食堂' },
    applications,
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'i' }]),
    $transaction: jest.fn(),
    diningInvite: {
      findUnique: jest.fn().mockImplementation(async () => invite),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => invite),
      update: jest
        .fn()
        .mockImplementation(async ({ data }) => Object.assign(invite, data)),
      findMany: jest.fn().mockResolvedValue([invite]),
      count: jest.fn().mockResolvedValue(1),
    },
    diningApplication: {
      update: jest
        .fn()
        .mockImplementation(async ({ where, data }) =>
          Object.assign(
            applications.find((application) => application.id === where.id)!,
            data,
          ),
        ),
      upsert: jest
        .fn()
        .mockImplementation(async ({ where, update }) =>
          Object.assign(
            applications.find(
              (application) =>
                application.userId === where.inviteId_userId.userId,
            )!,
            update,
          ),
        ),
    },
  };
  prisma.$transaction.mockImplementation(async (operation) =>
    operation(prisma),
  );
  const notifications = { create: jest.fn(), withdraw: jest.fn() };
  const plans = { assertStudent: jest.fn(), lockOwnedPlan: jest.fn() };
  return {
    prisma,
    invite,
    applications,
    notifications,
    plans,
    service: new DiningInvitesService(
      prisma as never,
      plans as never,
      notifications as never,
    ),
  };
}

describe('dining invitations', () => {
  it('accepts one applicant while holding the invitation row lock and includes the host in capacity', async () => {
    const { service, prisma, notifications } = fixture();
    const response = await service.decide('i', 'a', 'host', 'accept');
    expect(response.data.status).toBe('full');
    expect(response.data.acceptedCount).toBe(1);
    expect(prisma.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.diningInvite.findUnique.mock.invocationCallOrder[0],
    );
    await expect(service.decide('i', 'b', 'host', 'accept')).rejects.toThrow(
      ConflictException,
    );
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        userId: 'alice',
        type: 'dining_accepted',
        targetId: 'i',
      }),
    );
  });

  it('repeated decisions are idempotent and conflicting decisions cannot overwrite a resolved request', async () => {
    const { service, notifications } = fixture();
    await service.decide('i', 'a', 'host', 'reject');
    await service.decide('i', 'a', 'host', 'reject');
    await expect(service.decide('i', 'a', 'host', 'accept')).rejects.toThrow(
      ConflictException,
    );
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('only the host may decide and application ids must belong to the invitation', async () => {
    const { service } = fixture();
    await expect(service.decide('i', 'a', 'alice', 'accept')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.decide('i', 'foreign', 'host', 'accept'),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses pending decisions at the exact start time', async () => {
    const { service, invite, prisma } = fixture();
    invite.startsAt = new Date(0);
    await expect(service.decide('i', 'a', 'host', 'accept')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.diningApplication.update).not.toHaveBeenCalled();
  });

  it('withdrawal releases an accepted seat and removes the owner pending-action notification', async () => {
    const { service, applications, notifications } = fixture();
    applications[0].status = 'accepted';
    expect((await service.withdraw('i', 'alice')).data.status).toBe('open');
    await service.decide('i', 'b', 'host', 'accept');
    expect(notifications.withdraw).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'host',
        actorId: 'alice',
        targetId: 'i',
      }),
    );
  });

  it('duplicate applications do not notify twice', async () => {
    const { service, applications, notifications } = fixture();
    applications[0].status = 'withdrawn';
    await service.apply('i', 'alice');
    await service.apply('i', 'alice');
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('publishes only one occurrence and never serializes the private plan or other applicants to a viewer', async () => {
    const { service } = fixture();
    const { data } = await service.get('i', 'viewer');
    expect(data).not.toHaveProperty('mealPlan');
    expect(data).not.toHaveProperty('mealPlanId');
    expect(data).not.toHaveProperty('applications');
    expect(data).not.toHaveProperty('dishes');
    expect(data.host).toEqual({ id: 'host', nickname: 'Host', avatar: '' });
  });

  it('cancel notifies active applicants once while retaining participant access to the cancelled state', async () => {
    const { service, notifications } = fixture();
    await service.cancel('i', 'host');
    await service.cancel('i', 'host');
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect((await service.get('i', 'alice')).data.status).toBe('cancelled');
    await expect(service.get('i', 'viewer')).rejects.toThrow(NotFoundException);
    await expect(service.apply('i', 'alice')).rejects.toThrow(
      ConflictException,
    );
  });
});
