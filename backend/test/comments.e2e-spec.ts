import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ReportType } from '@/common/enums';

import { ConfigService } from '@nestjs/config';

describe('CommentsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let userToken: string;
  let userId: string;
  let user2Token: string;
  let user2Id: string;
  let reviewId: string;
  let review2Id: string;
  let commentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    const secret = configService.get<string>('JWT_SECRET');

    // Create a test user 1
    const user = await prisma.user.create({
      data: {
        openId: 'test_comments_user',
        nickname: 'Test Comments User',
      },
    });
    userId = user.id;
    userToken = jwtService.sign({ sub: user.id, type: 'user' }, { secret });

    // Create a test user 2
    const user2 = await prisma.user.create({
      data: {
        openId: 'test_comments_user_2',
        nickname: 'Test Comments User 2',
      },
    });
    user2Id = user2.id;
    user2Token = jwtService.sign({ sub: user2.id, type: 'user' }, { secret });

    // Create a test canteen
    const canteen = await prisma.canteen.create({
      data: {
        name: 'Test Canteen For Comments',
        position: 'Test Location',
        openingHours: {},
      },
    });

    // Create a test dish
    const dish = await prisma.dish.create({
      data: {
        name: 'Test Dish For Comments',
        price: 10,
        canteenId: canteen.id,
        canteenName: canteen.name,
        windowName: 'Test Window',
      },
    });

    // Create a test review
    const review = await prisma.review.create({
      data: {
        userId: user.id,
        dishId: dish.id,
        rating: 5,
        content: 'Great dish!',
        status: 'approved',
      },
    });
    reviewId = review.id;

    // Create another review
    const review2 = await prisma.review.create({
      data: {
        userId: user.id,
        dishId: dish.id,
        rating: 4,
        content: 'Good dish!',
        status: 'approved',
      },
    });
    review2Id = review2.id;
  });

  afterAll(async () => {
    // Cleanup
    // Use deleteMany to avoid errors if records don't exist
    await prisma.report.deleteMany({ where: { reporterId: userId } });
    await prisma.report.deleteMany({ where: { reporterId: user2Id } });
    // Comments might be soft deleted, so we need to find them first or just delete by userId
    await prisma.comment.deleteMany({ where: { userId: userId } });
    await prisma.comment.deleteMany({ where: { userId: user2Id } });
    await prisma.review.deleteMany({ where: { userId: userId } });
    await prisma.dish.deleteMany({ where: { name: 'Test Dish For Comments' } });
    await prisma.canteen.deleteMany({
      where: { name: 'Test Canteen For Comments' },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.deleteMany({ where: { id: user2Id } });
    await app.close();
  });

  describe('/comments (POST)', () => {
    it('should create a comment', async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: reviewId,
          content: 'This is a test comment',
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.data.content).toBe('This is a test comment');
      expect(response.body.data.floor).toBe(1);
      commentId = response.body.data.id;
    });

    it('should fail if reviewId is missing', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'This is a test comment',
        })
        .expect(400);
    });

    it('should fail if review does not exist', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: 'non-existent-review-id',
          content: 'This is a test comment',
        })
        .expect(404);
    });

    it('should create a reply to a comment', async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          reviewId: reviewId,
          content: 'This is a reply',
          parentCommentId: commentId,
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.data.parentComment).toBeDefined();
      expect(response.body.data.parentComment.id).toBe(commentId);
      expect(response.body.data.floor).toBe(2);
    });

    it('should fail if parent comment does not exist', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: reviewId,
          content: 'This is a reply',
          parentCommentId: 'non-existent-comment-id',
        })
        .expect(404);
    });

    it('should fail if parent comment belongs to a different review', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: review2Id, // Different review
          content: 'This is a reply',
          parentCommentId: commentId, // Comment belongs to reviewId
        })
        .expect(404);
    });

    it('should fail if replying to a deleted comment', async () => {
      // Create a comment and delete it
      const deletedComment = await prisma.comment.create({
        data: {
          reviewId: reviewId,
          userId: userId,
          content: 'To be deleted',
          status: 'approved',
          deletedAt: new Date(),
        },
      });

      return request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: reviewId,
          content: 'This is a reply',
          parentCommentId: deletedComment.id,
        })
        .expect(400);
    });

    it('should assign correct floor number even if previous comments are deleted', async () => {
      // Create a new review for this test to ensure clean state
      const cleanReview = await prisma.review.create({
        data: {
          userId: userId,
          dishId:
            (
              await prisma.dish.findFirst({
                where: { name: 'Test Dish For Comments' },
              })
            )?.id ??
            (() => {
              throw new Error('Dish not found');
            })(),
          rating: 5,
          content: 'Clean review for floor test',
          status: 'approved',
        },
      });

      // Create comment 1 (floor 1)
      const comment1 = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: cleanReview.id,
          content: 'Comment 1',
        })
        .expect(201);

      expect(comment1.body.data.floor).toBe(1);

      // Create comment 2 (floor 2)
      const comment2 = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: cleanReview.id,
          content: 'Comment 2',
        })
        .expect(201);

      expect(comment2.body.data.floor).toBe(2);

      // Delete comment 2
      await prisma.comment.update({
        where: { id: comment2.body.data.id },
        data: { deletedAt: new Date() },
      });

      // Create comment 3 (should be floor 3)
      const comment3 = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reviewId: cleanReview.id,
          content: 'Comment 3',
        })
        .expect(201);

      // Should be floor 3, not 2
      expect(comment3.body.data.floor).toBe(3);
    });
  });

  describe('/comments/:reviewId (GET)', () => {
    it('should get comments for a review with pagination', async () => {
      // Approve the comment first so it appears in the list
      await prisma.comment.updateMany({
        where: { reviewId: reviewId },
        data: { status: 'approved' },
      });

      const response = await request(app.getHttpServer())
        .get(`/comments/${reviewId}?page=1&pageSize=10`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2); // Original comment + reply
      expect(response.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should not list deleted comments', async () => {
      // Create a comment and then delete it
      const comment = await prisma.comment.create({
        data: {
          reviewId: reviewId,
          userId: userId,
          content: 'To be deleted',
          status: 'approved',
          deletedAt: new Date(),
        },
        include: { user: true },
      });

      const response = await request(app.getHttpServer())
        .get(`/comments/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const deletedItem = response.body.data.items.find(
        (item) => item.id === comment.id,
      );
      expect(deletedItem).toBeUndefined();
    });

    it('should indicate if parent comment is deleted', async () => {
      // Create parent
      const parent = await prisma.comment.create({
        data: {
          reviewId: reviewId,
          userId: userId,
          content: 'Parent to be deleted',
          status: 'approved',
        },
      });

      // Create child
      const child = await prisma.comment.create({
        data: {
          reviewId: reviewId,
          userId: userId,
          content: 'Child comment',
          parentCommentId: parent.id,
          status: 'approved',
        },
      });

      // Delete parent
      await prisma.comment.update({
        where: { id: parent.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .get(`/comments/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const childItem = response.body.data.items.find(
        (item) => item.id === child.id,
      );
      expect(childItem).toBeDefined();
      expect(childItem.parentComment).toBeDefined();
      expect(childItem.parentComment.deleted).toBe(true);
    });
  });

  describe('/comments/:id/report (POST)', () => {
    it('should report a comment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/comments/${commentId}/report`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: ReportType.SPAM,
          reason: 'This is spam',
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toBe('举报提交成功');
    });

    it('should fail if comment does not exist', () => {
      return request(app.getHttpServer())
        .post('/comments/non-existent-id/report')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: ReportType.SPAM,
          reason: 'This is spam',
        })
        .expect(404);
    });
  });

  describe('/comments/:id (DELETE)', () => {
    it('should fail if user is not the owner', async () => {
      await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${user2Token}`) // user2 tries to delete user1's comment
        .expect(403);
    });

    it('should delete a comment', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('删除成功');

      // Verify it is soft deleted
      const deletedComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(deletedComment).not.toBeNull();
      expect(deletedComment!.deletedAt).not.toBeNull();
    });

    it('should fail if comment does not exist', () => {
      return request(app.getHttpServer())
        .delete('/comments/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });
});
