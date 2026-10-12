import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { VerificationDeliveryService } from '@/auth/verification-delivery.service';
import { UserIdentityService } from '@/auth/user-identity.service';
import { campusDate } from '@/meal-plans/meal-plan-date';

describe('Campus community lifecycle (PostgreSQL)', () => {
  const prefix = `campus-${randomUUID()}`;
  const userIds: string[] = [];
  const codes = new Map<string, string>();
  let app: INestApplication;
  let prisma: PrismaService;
  let canteenId: string;
  let dishId: string;
  let studentId: string;
  let secondStudentId: string;
  let visitorId: string;
  let student: string;
  let secondStudent: string;
  let visitor: string;
  let reviewId: string;
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VerificationDeliveryService)
      .useValue({
        assertAvailable: () => undefined,
        send: async (
          _purpose: string,
          _target: string,
          code: string,
          id: string,
        ) => {
          codes.set(id, code);
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    const config = app.get(ConfigService);
    config.set(
      'AUTH_CHALLENGE_SECRET',
      'isolated-campus-contract-secret-at-least-32-characters',
    );
    config.set('CAMPUS_EMAIL_DOMAINS', 'mails.tsinghua.edu.cn');
    const jwt = app.get(JwtService);
    const admin = await prisma.admin.create({
      data: {
        username: prefix,
        password: 'unused-test-token-fixture',
        role: 'superadmin',
      },
    });
    adminId = admin.id;
    adminToken = jwt.sign(
      { sub: admin.id, type: 'admin', tokenUse: 'access' },
      { secret: config.get<string>('JWT_SECRET') },
    );
    const createUser = async (verified: boolean) => {
      const user = await prisma.user.create({
        data: {
          nickname: prefix,
          bio: '仅公开认证后的个人简介',
          settings: { create: {} },
          ...(verified
            ? {
                studentVerification: {
                  create: {
                    status: 'VERIFIED',
                    method: 'MANUAL_REVIEW',
                    expiresAt: new Date(Date.now() + 86400000),
                  },
                },
              }
            : {}),
        },
      });
      userIds.push(user.id);
      return {
        id: user.id,
        token: jwt.sign(
          { sub: user.id, type: 'user', tokenUse: 'access' },
          { secret: config.get<string>('JWT_SECRET') },
        ),
      };
    };
    const first = await createUser(true);
    studentId = first.id;
    student = first.token;
    const second = await createUser(true);
    secondStudentId = second.id;
    secondStudent = second.token;
    const third = await createUser(false);
    visitorId = third.id;
    visitor = third.token;
    const canteen = await prisma.canteen.create({
      data: { name: prefix, images: [], openingHours: [] },
    });
    canteenId = canteen.id;
    const dish = await prisma.dish.create({
      data: {
        name: prefix,
        price: 10,
        canteenId,
        canteenName: prefix,
        windowName: '测试窗口',
        status: 'online',
      },
    });
    dishId = dish.id;
    const review = await prisma.review.create({
      data: {
        dishId,
        userId: studentId,
        rating: 5,
        content: '公开评价',
        images: [],
        status: 'approved',
      },
    });
    reviewId = review.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.verificationChallenge.deleteMany({
        where: { id: { in: [...codes.keys()] } },
      });
      await prisma.post.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.mealPlan.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.dish.deleteMany({ where: { canteenId } });
      await prisma.canteen.deleteMany({ where: { id: canteenId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.operationLog.deleteMany({ where: { adminId } });
      await prisma.admin.deleteMany({ where: { id: adminId } });
    }
    await app?.close();
  });

  it('allows public browsing but never returns pending comments or private profile data', async () => {
    const hidden = await prisma.comment.create({
      data: {
        reviewId,
        userId: studentId,
        content: '未公开评论',
        status: 'pending',
      },
    });
    const comments = await request(app.getHttpServer())
      .get(`/comments/${reviewId}`)
      .expect(200);
    expect(
      comments.body.data.items.some(
        (item: { id: string }) => item.id === hidden.id,
      ),
    ).toBe(false);
    const own = await request(app.getHttpServer())
      .get(`/comments/${reviewId}`)
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    expect(
      own.body.data.items.some((item: { id: string }) => item.id === hidden.id),
    ).toBe(true);
    const profile = await request(app.getHttpServer())
      .get(`/users/${visitorId}`)
      .expect(200);
    expect(Object.keys(profile.body.data).sort()).toEqual(
      [
        'avatar',
        'bio',
        'id',
        'isVerifiedStudent',
        'nickname',
        'postCount',
      ].sort(),
    );
    expect(profile.body.data.bio).toBe('');
    await request(app.getHttpServer()).get(`/dishes/${dishId}`).expect(200);
    expect(await prisma.browseHistory.count({ where: { dishId } })).toBe(0);
    await request(app.getHttpServer()).get('/user/profile').expect(401);
    await request(app.getHttpServer())
      .get(`/dishes/${dishId}`)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  it('keeps student checks on writes and prevents profile privilege injection', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .send({ content: '匿名发帖' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${visitor}`)
      .send({ content: '游客发帖' })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/reviews/${reviewId}/like`)
      .set('Authorization', `Bearer ${visitor}`)
      .expect(403);
    await request(app.getHttpServer())
      .put('/user/profile')
      .set('Authorization', `Bearer ${visitor}`)
      .send({ capabilities: { canContribute: true } })
      .expect(400);
  });

  it('consumes OTP once under concurrent requests and creates one account identity', async () => {
    const phone = `+86139${Date.now().toString().slice(-8)}`;
    const sent = await request(app.getHttpServer())
      .post('/auth/phone/challenges')
      .send({ phone })
      .expect(200);
    const challengeId = sent.body.data.challengeId as string;
    expect(sent.body.data).not.toHaveProperty('code');
    const attempts = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/phone/login')
        .send({ challengeId, code: codes.get(challengeId) }),
      request(app.getHttpServer())
        .post('/auth/phone/login')
        .send({ challengeId, code: codes.get(challengeId) }),
    ]);
    expect(attempts.map((result) => result.status).sort()).toEqual([200, 400]);
    const loggedIn = attempts.find((result) => result.status === 200)!;
    userIds.push(loggedIn.body.data.user.id);
    const service = app.get(UserIdentityService);
    const resolved = await Promise.all([
      service.phone(phone),
      service.phone(phone),
    ]);
    expect(resolved[0].id).toBe(resolved[1].id);
    expect(
      await prisma.userIdentity.count({
        where: { provider: 'PHONE', subject: phone },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post('/auth/phone/challenges')
      .send({ phone })
      .expect(429);
  });

  it('email ownership remains an application, not a student privilege grant', async () => {
    const sent = await request(app.getHttpServer())
      .post('/user/student-verification/email/challenges')
      .set('Authorization', `Bearer ${visitor}`)
      .send({ email: `${visitorId}@mails.tsinghua.edu.cn` })
      .expect(200);
    const id = sent.body.data.challengeId as string;
    const result = await request(app.getHttpServer())
      .post('/user/student-verification')
      .set('Authorization', `Bearer ${visitor}`)
      .send({ challengeId: id, code: codes.get(id) })
      .expect(200);
    expect(result.body.data).toMatchObject({
      status: 'PENDING',
      canContribute: false,
    });
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${visitor}`)
      .send({ reviewId, content: '不应被发表' })
      .expect(403);
  });

  it('likes are idempotent, notify only the owner, and withdrawal clears unread state', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer())
        .put(`/reviews/${reviewId}/like`)
        .set('Authorization', `Bearer ${secondStudent}`),
      request(app.getHttpServer())
        .put(`/reviews/${reviewId}/like`)
        .set('Authorization', `Bearer ${secondStudent}`),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await prisma.reviewLike.count({ where: { reviewId } })).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: studentId, targetId: reviewId, withdrawnAt: null },
      }),
    ).toBe(1);
    const inbox = await request(app.getHttpServer())
      .get('/notifications?scope=service')
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    expect(inbox.body.data.items[0]).toMatchObject({
      targetId: reviewId,
      dishId,
    });
    const id = inbox.body.data.items[0].id;
    await request(app.getHttpServer())
      .put(`/notifications/${id}/read`)
      .set('Authorization', `Bearer ${visitor}`)
      .expect(200);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id } })).readAt,
    ).toBeNull();
    await request(app.getHttpServer())
      .delete(`/reviews/${reviewId}/like`)
      .set('Authorization', `Bearer ${secondStudent}`)
      .expect(200);
    const unread = await request(app.getHttpServer())
      .get('/notifications/unread-count?scope=service')
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    expect(unread.body.data.unreadCount).toBe(0);
  });

  it('publishes posts with reactions and withdraws their notifications when deleted', async () => {
    const created = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${student}`)
      .send({ content: '校园社区端到端测试', images: [] })
      .expect(201);
    const id = created.body.data.id;
    await request(app.getHttpServer()).get(`/posts/${id}`).expect(200);
    await request(app.getHttpServer())
      .put(`/posts/${id}/like`)
      .set('Authorization', `Bearer ${secondStudent}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/posts/${id}/comments`)
      .set('Authorization', `Bearer ${secondStudent}`)
      .send({ content: '好吃！' })
      .expect(201);
    const inbox = await request(app.getHttpServer())
      .get('/notifications?scope=service')
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    expect(
      inbox.body.data.items.some((item: { targetType: string }) =>
        ['post', 'postComment'].includes(item.targetType),
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .delete(`/posts/${id}`)
      .set('Authorization', `Bearer ${visitor}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/posts/${id}`)
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    await request(app.getHttpServer()).get(`/posts/${id}`).expect(404);
    expect(
      await prisma.notification.count({
        where: {
          userId: studentId,
          OR: [{ targetId: id }, { rootId: id }],
          withdrawnAt: null,
        },
      }),
    ).toBe(0);
  });

  it('keeps calendar privacy opt-in, filters dates and records completion by occurrence', async () => {
    const today = campusDate();
    const start = campusDate(new Date(Date.now() - 86400000));
    const end = campusDate(new Date(Date.now() + 86400000));
    const outside = campusDate(new Date(Date.now() + 3 * 86400000));
    const created = await request(app.getHttpServer())
      .post('/meal-plans')
      .set('Authorization', `Bearer ${student}`)
      .send({
        startDate: start,
        endDate: end,
        mealTime: 'lunch',
        dishes: [dishId],
      })
      .expect(201);
    const id = created.body.data.id;
    expect(created.body.data.isPublic).toBe(false);
    const filtered = await request(app.getHttpServer())
      .get(`/meal-plans?startDate=${outside}&endDate=${outside}`)
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    expect(
      filtered.body.data.items.some((plan: { id: string }) => plan.id === id),
    ).toBe(false);
    await request(app.getHttpServer())
      .patch(`/meal-plans/${id}`)
      .set('Authorization', `Bearer ${student}`)
      .send({ startDate: outside })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/meal-plans/${id}/completions/${end}`)
      .set('Authorization', `Bearer ${student}`)
      .expect(400);
    const completed = await request(app.getHttpServer())
      .put(`/meal-plans/${id}/completions/${today}`)
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    expect(completed.body.data.completedDates).toEqual([today]);
    const privatePlans = await request(app.getHttpServer())
      .get(`/users/${studentId}/meal-plans`)
      .expect(200);
    expect(privatePlans.body.data.items).toEqual([]);
    await request(app.getHttpServer())
      .patch(`/meal-plans/${id}`)
      .set('Authorization', `Bearer ${student}`)
      .send({ isPublic: true })
      .expect(200);
    const stillPrivate = await request(app.getHttpServer())
      .get(`/users/${studentId}/meal-plans`)
      .expect(200);
    expect(stillPrivate.body.data.items).toEqual([]);
    await request(app.getHttpServer())
      .put('/user/profile')
      .set('Authorization', `Bearer ${student}`)
      .send({ settings: { showMealPlans: true } })
      .expect(200);
    const publicPlans = await request(app.getHttpServer())
      .get(`/users/${studentId}/meal-plans?startDate=${start}&endDate=${end}`)
      .expect(200);
    expect(
      publicPlans.body.data.items.map((plan: { id: string }) => plan.id),
    ).toContain(id);
    expect(publicPlans.body.data.items[0]).not.toHaveProperty('completedDates');
  });

  it('requires a current administrative decision to grant email applicants student access', async () => {
    const list = await request(app.getHttpServer())
      .get('/admin/student-verifications?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const application = list.body.data.items.find(
      (item: { userId: string }) => item.userId === visitorId,
    );
    expect(application).toBeDefined();
    const body = {
      decision: 'APPROVE',
      reason: '测试夹具资格核验',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      expectedUpdatedAt: application.updatedAt,
    };
    await request(app.getHttpServer())
      .post(`/admin/student-verifications/${visitorId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/admin/student-verifications/${visitorId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(409);
    const status = await request(app.getHttpServer())
      .get('/user/student-verification')
      .set('Authorization', `Bearer ${visitor}`)
      .expect(200);
    expect(status.body.data.canContribute).toBe(true);
  });

  it('never overbooks a dining invitation when two applications are accepted together', async () => {
    const startsAt = new Date(Date.now() + 2 * 3600000);
    const date = campusDate(startsAt);
    const plan = await request(app.getHttpServer())
      .post('/meal-plans')
      .set('Authorization', `Bearer ${student}`)
      .send({
        startDate: date,
        endDate: date,
        mealTime: 'dinner',
        dishes: [dishId],
      })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post(`/meal-plans/${plan.body.data.id}/dining-invites`)
      .set('Authorization', `Bearer ${student}`)
      .send({ date, startsAt: startsAt.toISOString(), canteenId, capacity: 2 })
      .expect(201);
    const id = created.body.data.id;
    await request(app.getHttpServer())
      .post(`/dining-invites/${id}/applications`)
      .set('Authorization', `Bearer ${secondStudent}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/dining-invites/${id}/applications`)
      .set('Authorization', `Bearer ${visitor}`)
      .expect(200);
    const applications = await prisma.diningApplication.findMany({
      where: { inviteId: id },
    });
    for (const method of ['put', 'patch'] as const) {
      const path = `/dining-invites/${id}/applications/${applications[0].id}`;
      await request(app.getHttpServer())
        [method](path)
        .send({ action: 'accept' })
        .expect(401);
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${secondStudent}`)
        .send({ action: 'accept' })
        .expect(403);
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${student}`)
        .send({ action: 'invalid' })
        .expect(400);
    }
    expect(
      await prisma.diningApplication.count({
        where: { inviteId: id, status: 'accepted' },
      }),
    ).toBe(0);
    const decisions = await Promise.all(
      applications.map((application, index) =>
        request(app.getHttpServer())
          [
            index === 0 ? 'put' : 'patch'
          ](`/dining-invites/${id}/applications/${application.id}`)
          .set('Authorization', `Bearer ${student}`)
          .send({ action: 'accept' }),
      ),
    );
    expect(decisions.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.diningApplication.count({
        where: { inviteId: id, status: 'accepted' },
      }),
    ).toBe(1);
    const guestView = await request(app.getHttpServer())
      .get(`/dining-invites/${id}`)
      .set('Authorization', `Bearer ${visitor}`)
      .expect(200);
    expect(guestView.body.data).not.toHaveProperty('applications');
    expect(guestView.body.data).not.toHaveProperty('dishes');
    await request(app.getHttpServer())
      .patch(`/meal-plans/${plan.body.data.id}`)
      .set('Authorization', `Bearer ${student}`)
      .send({ mealTime: 'lunch' })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/dining-invites/${id}`)
      .set('Authorization', `Bearer ${student}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/dining-invites/${id}/applications`)
      .set('Authorization', `Bearer ${visitor}`)
      .expect(409);
  });

  it('revocation takes effect with an already issued access token', async () => {
    await prisma.studentVerification.update({
      where: { userId: secondStudentId },
      data: { status: 'REVOKED' },
    });
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${secondStudent}`)
      .send({ content: '撤销后不得发布' })
      .expect(403);
    for (const method of ['put', 'patch'] as const) {
      await request(app.getHttpServer())
        [method]('/dining-invites/invite/applications/application')
        .set('Authorization', `Bearer ${secondStudent}`)
        .send({ action: 'accept' })
        .expect(403);
    }
  });
});
