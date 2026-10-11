import { NotFoundException } from '@nestjs/common';
import { ContentLikesService, LikeTarget } from './content-likes.service';

describe('content likes', () => {
  let tx: any;
  let notifications: any;
  let service: ContentLikesService;
  beforeEach(() => {
    const target = () => ({
      findFirst: jest.fn().mockResolvedValue({ userId: 'author' }),
      findUnique: jest.fn().mockResolvedValue({ reviewId: 'r1', postId: 'p1' }),
    });
    const likes = () => {
      let exists = false;
      return {
        createMany: jest.fn().mockImplementation(() => {
          const count = exists ? 0 : 1;
          exists = true;
          return Promise.resolve({ count });
        }),
        deleteMany: jest.fn().mockImplementation(() => {
          const count = exists ? 1 : 0;
          exists = false;
          return Promise.resolve({ count });
        }),
        count: jest
          .fn()
          .mockImplementation(() => Promise.resolve(exists ? 1 : 0)),
      };
    };
    tx = {
      $queryRaw: jest.fn(),
      review: target(),
      comment: target(),
      post: target(),
      postComment: target(),
      reviewLike: likes(),
      commentLike: likes(),
      postLike: likes(),
      postCommentLike: likes(),
    };
    tx.$transaction = jest.fn((callback) => callback(tx));
    notifications = { create: jest.fn(), withdraw: jest.fn() };
    service = new ContentLikesService(tx, notifications);
  });
  it.each<LikeTarget>(['review', 'comment', 'post', 'postComment'])(
    'makes %s likes idempotent and counts stored edges',
    async (type) => {
      const first = await service.setLike('reader', type, 'target', true);
      const replay = await service.setLike('reader', type, 'target', true);
      expect(first.data).toEqual({ liked: true, likeCount: 1 });
      expect(replay.data).toEqual(first.data);
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          userId: 'author',
          actorId: 'reader',
          targetType: type,
          targetId: 'target',
        }),
      );
      expect(
        (await service.setLike('reader', type, 'target', false)).data,
      ).toEqual({ liked: false, likeCount: 0 });
      expect(
        (await service.setLike('reader', type, 'target', false)).data,
      ).toEqual({ liked: false, likeCount: 0 });
      expect(notifications.withdraw).toHaveBeenCalledWith(tx, {
        type: 'like',
        actorId: 'reader',
        targetType: type,
        targetId: 'target',
      });
    },
  );
  it.each<LikeTarget>(['review', 'comment', 'post', 'postComment'])(
    'does not like a hidden %s target',
    async (type) => {
      tx[type].findFirst.mockResolvedValue(null);
      await expect(
        service.setLike('reader', type, 'target', true),
      ).rejects.toThrow(NotFoundException);
      expect(tx[`${type}Like`].createMany).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    },
  );
  it('checks both the comment and review public lifecycle inside the root lock', async () => {
    await service.setLike('reader', 'comment', 'target', true);
    expect(tx.comment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'target',
        status: 'approved',
        deletedAt: null,
        review: { status: 'approved', deletedAt: null },
      },
      select: { userId: true },
    });
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('r1');
  });
});
