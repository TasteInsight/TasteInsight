import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { StudentGuard } from '@/auth/guards/student.guard';
import { OptionalAuthGuard } from '@/auth/guards/optional-auth.guard';
import { SocialController } from './social.controller';
import { ReviewsController } from '@/reviews/reviews.controller';
import { CommentsController } from '@/comments/comments.controller';
import {
  CreatePostDto,
  CreatePostCommentDto,
  SocialQueryDto,
  UpdatePostDto,
} from './dto/social.dto';

describe('social HTTP contracts', () => {
  it.each([
    'create',
    'update',
    'like',
    'unlike',
    'report',
    'comment',
    'likeComment',
    'unlikeComment',
    'reportComment',
  ])('requires login then student authorization for %s', (method) => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SocialController.prototype[method]),
    ).toEqual([AuthGuard, StudentGuard]);
  });
  it.each(['list', 'get', 'comments', 'profile'])(
    'allows optional authentication for %s',
    (method) => {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          SocialController.prototype[method],
        ),
      ).toEqual([OptionalAuthGuard]);
    },
  );
  it('requires student authorization for existing review/comment public writes', () => {
    for (const method of ['create', 'report', 'like', 'unlike'])
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          ReviewsController.prototype[method],
        ),
      ).toEqual([AuthGuard, StudentGuard]);
    for (const method of ['createComment', 'reportComment', 'like', 'unlike'])
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          CommentsController.prototype[method],
        ),
      ).toEqual([AuthGuard, StudentGuard]);
  });
  it('keeps deletion available to owners without requiring renewed student verification', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SocialController.prototype.remove),
    ).toEqual([AuthGuard]);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        SocialController.prototype.deleteComment,
      ),
    ).toEqual([AuthGuard]);
  });
  it('rejects blank content, excessive image arrays, and invalid pagination', async () => {
    expect(
      await validate(plainToInstance(CreatePostDto, { content: '   ' })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreatePostDto, {
          content: '照片',
          images: Array(10).fill('https://images.example.test/photo.jpg'),
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SocialQueryDto, { page: 0, pageSize: 500 }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreatePostCommentDto, { content: 'x'.repeat(501) }),
      ),
    ).not.toHaveLength(0);
  });
  it('requires the edited post baseline and normalizes text', async () => {
    const dto = plainToInstance(UpdatePostDto, { content: ' 午餐 ' });
    expect(dto.content).toBe('午餐');
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
