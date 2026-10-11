import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { isCurrentStudent } from '@/auth/student-status';
import { NotificationService } from '@/notifications/notification.service';
import { MealPlansService } from './meal-plans.service';
import { CreateDiningInviteDto } from './dto/dining-invite.dto';
import { MealPlanQueryDto } from './dto/meal-plan-query.dto';
import {
  campusDate,
  mealDate,
  storedMealDate,
  validateMealRange,
} from './meal-plan-date';

const userSummary = { id: true, nickname: true, avatar: true } as const;
const inviteInclude = {
  mealPlan: {
    include: {
      user: {
        select: {
          ...userSummary,
          studentVerification: { select: { status: true, expiresAt: true } },
        },
      },
    },
  },
  canteen: { select: { id: true, name: true } },
  applications: {
    include: { user: { select: userSummary } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;
type Invite = Prisma.DiningInviteGetPayload<{ include: typeof inviteInclude }>;

@Injectable()
export class DiningInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: MealPlansService,
    private readonly notifications: NotificationService,
  ) {}

  private hostVerified(invite: Invite) {
    const verification = invite.mealPlan.user.studentVerification;
    return isCurrentStudent(verification);
  }

  private available(invite: Invite) {
    if (invite.status !== 'open' || invite.startsAt <= new Date())
      throw new ConflictException('邀请已取消或已到用餐时间');
    if (!this.hostVerified(invite))
      throw new ConflictException('发起人的学生认证已失效');
  }

  private hasRoom(invite: Invite) {
    if (
      invite.applications.filter(
        (application) => application.status === 'accepted',
      ).length +
        1 >=
      invite.capacity
    ) {
      throw new ConflictException('名额已满');
    }
  }

  private async lock(tx: Prisma.TransactionClient, id: string) {
    // 所有申请变更先锁邀请，名额统计与状态变更共享同一串行边界。
    await tx.$queryRaw`SELECT "id" FROM "dining_invites" WHERE "id" = ${id} FOR UPDATE`;
    const invite = await tx.diningInvite.findUnique({
      where: { id },
      include: inviteInclude,
    });
    if (!invite) throw new NotFoundException('约饭邀请不存在');
    return invite;
  }

  private present(invite: Invite, viewerId: string) {
    const acceptedCount = invite.applications.filter(
      (application) => application.status === 'accepted',
    ).length;
    const myApplication = invite.applications.find(
      (application) => application.userId === viewerId,
    );
    const owner = invite.mealPlan.user;
    const status =
      invite.status === 'cancelled'
        ? 'cancelled'
        : invite.startsAt <= new Date() || !this.hostVerified(invite)
          ? 'expired'
          : acceptedCount + 1 >= invite.capacity
            ? 'full'
            : 'open';
    return {
      id: invite.id,
      host: {
        id: owner.id,
        nickname: owner.nickname,
        avatar: owner.avatar ?? '',
      },
      date: invite.date.toISOString().slice(0, 10),
      startsAt: invite.startsAt.toISOString(),
      mealTime: invite.mealPlan.mealTime,
      canteen: invite.canteen,
      capacity: invite.capacity,
      acceptedCount,
      status,
      ...(myApplication
        ? {
            myApplication: {
              id: myApplication.id,
              status: myApplication.status,
            },
          }
        : {}),
      ...(owner.id === viewerId
        ? {
            mealPlanId: invite.mealPlanId,
            applications: invite.applications.map((application) => ({
              id: application.id,
              status: application.status,
              user: {
                ...application.user,
                avatar: application.user.avatar ?? '',
              },
            })),
          }
        : {}),
    };
  }

  private response(invite: Invite, viewerId: string, code = 200) {
    return { code, message: 'success', data: this.present(invite, viewerId) };
  }

  async create(mealPlanId: string, userId: string, dto: CreateDiningInviteDto) {
    const date = mealDate(dto.date);
    const startsAt = new Date(dto.startsAt);
    if (
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(dto.startsAt) ||
      Number.isNaN(startsAt.getTime()) ||
      campusDate(startsAt) !== date ||
      startsAt <= new Date()
    ) {
      throw new BadRequestException('请选择该日期内尚未开始的用餐时间');
    }
    const invite = await this.prisma.$transaction(async (tx) => {
      const plan = await this.plans.lockOwnedPlan(tx, mealPlanId, userId);
      await this.plans.assertStudent(tx, userId);
      if (date < campusDate(plan.startDate) || date > campusDate(plan.endDate))
        throw new BadRequestException('邀请日期必须在规划范围内');
      if (
        await tx.mealPlanCompletion.findUnique({
          where: {
            mealPlanId_date: { mealPlanId, date: storedMealDate(date) },
          },
        })
      ) {
        throw new ConflictException('这一天已标记吃过，请先撤销标记');
      }
      const existing = await tx.diningInvite.findUnique({
        where: { mealPlanId_date: { mealPlanId, date: storedMealDate(date) } },
        include: inviteInclude,
      });
      if (existing) {
        if (
          existing.status === 'open' &&
          existing.startsAt.getTime() === startsAt.getTime() &&
          existing.canteenId === dto.canteenId &&
          existing.capacity === dto.capacity
        )
          return existing;
        throw new ConflictException('这一餐已有邀请，请查看已有邀请');
      }
      if (
        !(await tx.canteen.findUnique({
          where: { id: dto.canteenId },
          select: { id: true },
        }))
      )
        throw new BadRequestException('食堂不存在');
      return tx.diningInvite.create({
        data: {
          mealPlanId,
          date: storedMealDate(date),
          startsAt,
          canteenId: dto.canteenId,
          capacity: dto.capacity,
        },
        include: inviteInclude,
      });
    });
    return this.response(invite, userId, 201);
  }

  async list(userId: string, query: MealPlanQueryDto = {}, mine = false) {
    if (query.startDate && query.endDate)
      validateMealRange(query.startDate, query.endDate);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.DiningInviteWhereInput = {
      ...(mine
        ? {
            OR: [
              { mealPlan: { userId } },
              { applications: { some: { userId } } },
            ],
          }
        : {
            status: 'open',
            startsAt: { gt: new Date() },
            mealPlan: {
              user: {
                studentVerification: {
                  is: { status: 'VERIFIED', expiresAt: { gt: new Date() } },
                },
              },
            },
          }),
      ...(query.startDate || query.endDate
        ? {
            date: {
              ...(query.startDate
                ? { gte: storedMealDate(query.startDate) }
                : {}),
              ...(query.endDate ? { lte: storedMealDate(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.mealTime
        ? { AND: [{ mealPlan: { mealTime: query.mealTime } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.diningInvite.findMany({
        where,
        include: inviteInclude,
        orderBy: [{ startsAt: mine ? 'desc' : 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.diningInvite.count({ where }),
    ]);
    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((invite) => this.present(invite, userId)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async get(id: string, userId: string) {
    const invite = await this.prisma.diningInvite.findUnique({
      where: { id },
      include: inviteInclude,
    });
    if (!invite) throw new NotFoundException('约饭邀请不存在');
    const participant =
      invite.mealPlan.userId === userId ||
      invite.applications.some((application) => application.userId === userId);
    if (
      !participant &&
      (invite.status !== 'open' ||
        invite.startsAt <= new Date() ||
        !this.hostVerified(invite))
    )
      throw new NotFoundException('约饭邀请不存在');
    return this.response(invite, userId);
  }

  async apply(id: string, userId: string) {
    const invite = await this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, id);
      if (current.mealPlan.userId === userId)
        throw new BadRequestException('不能申请自己的邀请');
      await this.plans.assertStudent(tx, userId);
      this.available(current);
      const existing = current.applications.find(
        (application) => application.userId === userId,
      );
      if (existing?.status === 'pending' || existing?.status === 'accepted')
        return current;
      if (existing?.status === 'rejected')
        throw new ConflictException('本次申请已被拒绝');
      this.hasRoom(current);
      const application = await tx.diningApplication.upsert({
        where: { inviteId_userId: { inviteId: id, userId } },
        create: { inviteId: id, userId },
        update: { status: 'pending' },
      });
      await this.notifications.create(tx, {
        userId: current.mealPlan.userId,
        actorId: userId,
        type: 'dining_application',
        targetType: 'dining_invite',
        targetId: id,
        rootId: id,
        dedupeKey:
          'dining-application:' +
          application.id +
          ':' +
          application.updatedAt.toISOString(),
      });
      return tx.diningInvite.findUniqueOrThrow({
        where: { id },
        include: inviteInclude,
      });
    });
    return this.response(invite, userId);
  }

  async decide(
    id: string,
    applicationId: string,
    userId: string,
    action: 'accept' | 'reject',
  ) {
    const invite = await this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, id);
      if (current.mealPlan.userId !== userId)
        throw new ForbiddenException('只有发起人可以处理申请');
      await this.plans.assertStudent(tx, userId);
      const application = current.applications.find(
        (item) => item.id === applicationId,
      );
      if (!application) throw new NotFoundException('申请不存在');
      const status = action === 'accept' ? 'accepted' : 'rejected';
      if (application.status === status) return current;
      this.available(current);
      if (application.status !== 'pending')
        throw new ConflictException('申请状态已变化，请刷新');
      if (action === 'accept') {
        await this.plans.assertStudent(tx, application.userId);
        this.hasRoom(current);
      }
      await tx.diningApplication.update({
        where: { id: applicationId },
        data: { status },
      });
      await this.notifications.create(tx, {
        userId: application.userId,
        actorId: userId,
        type: action === 'accept' ? 'dining_accepted' : 'dining_rejected',
        targetType: 'dining_invite',
        targetId: id,
        rootId: id,
        dedupeKey:
          'dining-decision:' +
          applicationId +
          ':' +
          application.updatedAt.toISOString() +
          ':' +
          status,
      });
      return tx.diningInvite.findUniqueOrThrow({
        where: { id },
        include: inviteInclude,
      });
    });
    return this.response(invite, userId);
  }

  async withdraw(id: string, userId: string) {
    const invite = await this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, id);
      const application = current.applications.find(
        (item) => item.userId === userId,
      );
      if (!application) throw new NotFoundException('申请不存在');
      if (application.status === 'withdrawn') return current;
      if (application.status !== 'pending' && application.status !== 'accepted')
        throw new ConflictException('已处理的申请不能撤回');
      if (current.status !== 'open' || current.startsAt <= new Date())
        throw new ConflictException('邀请已结束');
      await tx.diningApplication.update({
        where: { id: application.id },
        data: { status: 'withdrawn' },
      });
      await this.notifications.withdraw(tx, {
        userId: current.mealPlan.userId,
        actorId: userId,
        targetType: 'dining_invite',
        targetId: id,
        type: 'dining_application',
      });
      return tx.diningInvite.findUniqueOrThrow({
        where: { id },
        include: inviteInclude,
      });
    });
    return this.response(invite, userId);
  }

  async cancel(id: string, userId: string) {
    const invite = await this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, id);
      if (current.mealPlan.userId !== userId)
        throw new ForbiddenException('只有发起人可以取消邀请');
      if (current.status === 'cancelled') return current;
      await tx.diningInvite.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      for (const application of current.applications.filter(
        (item) => item.status === 'pending' || item.status === 'accepted',
      )) {
        await this.notifications.create(tx, {
          userId: application.userId,
          actorId: userId,
          type: 'dining_cancelled',
          targetType: 'dining_invite',
          targetId: id,
          rootId: id,
          dedupeKey: 'dining-cancelled:' + id + ':' + application.userId,
        });
      }
      return tx.diningInvite.findUniqueOrThrow({
        where: { id },
        include: inviteInclude,
      });
    });
    return this.response(invite, userId);
  }
}
