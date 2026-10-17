import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SocialService } from './social.service';

describe('SocialService', () => {
  let tx: any;
  let notifications: any;
  let config: any;
  let service: SocialService;
  const now = new Date('2026-10-09T00:00:00Z');
  const post = {
    id: 'p1',
    userId: 'u1',
    user: { id: 'u1', nickname: '昵称', avatar: null },
    content: '午餐记录',
    images: [],
    status: 'approved',
    rejectReason: null,
    createdAt: now,
    updatedAt: now,
    _count: { likes: 2, comments: 0 },
    likes: [],
  };
  beforeEach(() => {
    const table = () => ({
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    });
    tx = {
      $queryRaw: jest.fn(),
      user: table(),
      post: table(),
      postComment: table(),
      studentVerification: table(),
      report: table(),
    };
    tx.$transaction = jest.fn((callback) => callback(tx));
    notifications = {
      createReply: jest.fn(),
      withdrawThread: jest.fn(),
      withdraw: jest.fn(),
    };
    config = { getBooleanConfigValue: jest.fn().mockResolvedValue(true) };
    service = new SocialService(tx, config, notifications);
  });
  it('projects only public profile fields and a current-student boolean', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '昵称',
      avatar: null,
      bio: '简介',
      openId: 'private',
      phone: 'private',
      preferences: { secret: true },
      studentVerification: {
        status: 'VERIFIED',
        email: 'private',
        expiresAt: new Date(Date.now() + 60000),
      },
      _count: { posts: 2 },
    });
    const result = await service.publicProfile('u1');
    expect(result.data).toEqual({
      id: 'u1',
      nickname: '昵称',
      avatar: null,
      bio: '简介',
      isVerifiedStudent: true,
      postCount: 2,
    });
    expect(tx.user.findUnique.mock.calls[0][0].select).not.toHaveProperty(
      'openId',
    );
    expect(
      tx.user.findUnique.mock.calls[0][0].select.studentVerification.select,
    ).toEqual({ status: true, expiresAt: true });
  });
  it('never puts an undefined author alternative into anonymous post reads', async () => {
    tx.post.findFirst.mockResolvedValue(null);
    await expect(service.getPost('hidden')).rejects.toThrow(NotFoundException);
    expect(tx.post.findFirst.mock.calls[0][0].where).toEqual({
      id: 'hidden',
      deletedAt: null,
      OR: [{ status: 'approved' }],
    });
  });

  it.each([
    null,
    { status: 'PENDING', expiresAt: new Date(Date.now() + 60000) },
    { status: 'VERIFIED', expiresAt: new Date(0) },
  ])(
    'keeps an unverified or expired biography private',
    async (studentVerification) => {
      tx.user.findUnique.mockResolvedValue({
        id: 'u1',
        nickname: '昵称',
        avatar: null,
        bio: '私人草稿',
        studentVerification,
        _count: { posts: 0 },
      });
      const result = await service.publicProfile('u1');
      expect(result.data).toMatchObject({ bio: '', isVerifiedStudent: false });
    },
  );
  it('allows an author to read their own pending post without publishing it in lists', async () => {
    tx.post.findFirst.mockResolvedValue({
      ...post,
      status: 'pending',
      rejectReason: 'reason',
    });
    const result = await service.getPost('p1', 'u1');
    expect(result.data).toMatchObject({
      status: 'pending',
      rejectReason: 'reason',
    });
    tx.post.findMany.mockResolvedValue([]);
    tx.post.count.mockResolvedValue(0);
    await service.listPosts({ page: 1, pageSize: 20 }, 'u1');
    expect(tx.post.findMany.mock.calls[0][0].where).toEqual({
      status: 'approved',
      deletedAt: null,
    });
  });
  it('rejects a cross-post reply before inserting or notifying', async () => {
    tx.post.findFirst.mockResolvedValue(post);
    tx.postComment.findFirst.mockResolvedValue(null);
    await expect(
      service.createComment('reader', 'p1', {
        content: '回复',
        parentCommentId: 'elsewhere',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.postComment.findFirst.mock.calls[0][0].where.postId).toBe('p1');
    expect(tx.postComment.create).not.toHaveBeenCalled();
    expect(notifications.createReply).not.toHaveBeenCalled();
  });
  it('creates reply notifications only after automatic approval', async () => {
    tx.post.findFirst.mockResolvedValue(post);
    tx.postComment.create.mockResolvedValue({
      ...post,
      id: 'reply',
      postId: 'p1',
      userId: 'reader',
      parentComment: null,
    });
    await service.createComment('reader', 'p1', { content: '回复' });
    expect(notifications.createReply).toHaveBeenCalledWith(
      tx,
      'reader',
      'postComment',
      'reply',
      'p1',
      ['u1'],
    );
    notifications.createReply.mockClear();
    config.getBooleanConfigValue.mockResolvedValue(false);
    await service.createComment('reader', 'p1', { content: '待审回复' });
    expect(notifications.createReply).not.toHaveBeenCalled();
  });
  it('atomically withdraws a post thread when an edit returns to review', async () => {
    tx.post.findUnique.mockResolvedValue(post);
    tx.post.updateMany.mockResolvedValue({ count: 1 });
    tx.post.findUniqueOrThrow.mockResolvedValue({ ...post, status: 'pending' });
    config.getBooleanConfigValue.mockResolvedValue(false);
    await service.updatePost('u1', 'p1', {
      content: '修改',
      expectedUpdatedAt: now.toISOString(),
    });
    expect(notifications.withdrawThread).toHaveBeenCalledWith(tx, 'post', 'p1');
    expect(tx.post.updateMany.mock.calls[0][0].where.updatedAt).toEqual(now);
  });
  it('rejects stale edits without withdrawing the newer post', async () => {
    tx.post.findUnique.mockResolvedValue(post);
    tx.post.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updatePost('u1', 'p1', {
        content: '修改',
        expectedUpdatedAt: now.toISOString(),
      }),
    ).rejects.toThrow(ConflictException);
    expect(notifications.withdrawThread).not.toHaveBeenCalled();
  });

  it('preserves existing photos when a text edit omits the optional images field', async () => {
    tx.post.findUnique.mockResolvedValue(post);
    tx.post.updateMany.mockResolvedValue({ count: 1 });
    tx.post.findUniqueOrThrow.mockResolvedValue(post);
    await service.updatePost('u1', 'p1', {
      content: '修改文字',
      expectedUpdatedAt: now.toISOString(),
    });
    expect(tx.post.updateMany.mock.calls[0][0].data.images).toBeUndefined();
  });
  it('keeps community moderation outside a canteen administrator scope', async () => {
    await expect(
      service.adminList(
        'post',
        { page: 1, pageSize: 20 },
        { scope: 'CANTEENS', canteenIds: ['c1'] },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.post.findMany).not.toHaveBeenCalled();
  });
  it('does not approve content after the author student verification expires', async () => {
    tx.post.findUnique.mockResolvedValue(post);
    tx.studentVerification.findFirst.mockResolvedValue(null);
    await expect(
      service.moderate(
        'post',
        'p1',
        { expectedUpdatedAt: now.toISOString() },
        true,
        { scope: 'GLOBAL', canteenIds: [] },
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.post.updateMany).not.toHaveBeenCalled();
  });
  it('withdraws the same transaction when an author deletes a post', async () => {
    tx.post.findUnique.mockResolvedValue(post);
    await service.deletePost('u1', 'p1');
    expect(notifications.withdrawThread).toHaveBeenCalledWith(tx, 'post', 'p1');
  });
});
