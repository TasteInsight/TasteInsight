import { AdminCanteenScope, isGlobalScope } from '@/auth/admin-scope';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { NotificationService } from '@/notifications/notification.service';
import { isCurrentStudent } from '@/auth/student-status';
import {
  CreatePostCommentDto,
  AdminSocialQueryDto,
  CreatePostDto,
  ModeratePostDto,
  ReportPostDto,
  SocialQueryDto,
  UpdatePostDto,
} from './dto/social.dto';

const publicContent = { status: 'approved', deletedAt: null };
const publicUser = { id: true, nickname: true, avatar: true } as const;
const visibleTo = (viewerId?: string) => ({
  deletedAt: null,
  OR: [{ status: 'approved' }, ...(viewerId ? [{ userId: viewerId }] : [])],
});
const success = (data: unknown = null, code = 200) => ({
  code,
  message: 'success',
  data,
});

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AdminConfigService,
    private readonly notifications: NotificationService,
  ) {}

  private postInclude(viewerId?: string) {
    return {
      user: { select: publicUser },
      _count: { select: { likes: true, comments: { where: publicContent } } },
      likes: viewerId
        ? { where: { userId: viewerId }, select: { userId: true } }
        : false,
    } satisfies Prisma.PostInclude;
  }

  private commentInclude(viewerId?: string) {
    return {
      user: { select: publicUser },
      _count: { select: { likes: true } },
      likes: viewerId
        ? { where: { userId: viewerId }, select: { userId: true } }
        : false,
      parentComment: {
        select: {
          id: true,
          userId: true,
          status: true,
          deletedAt: true,
          user: { select: publicUser },
        },
      },
    } satisfies Prisma.PostCommentInclude;
  }

  private mapPost(post: any, viewerId?: string) {
    return {
      id: post.id,
      userId: post.userId,
      userNickname: post.user.nickname,
      userAvatar: post.user.avatar,
      content: post.content,
      images: post.images,
      status: post.status,
      ...(post.userId === viewerId ? { rejectReason: post.rejectReason } : {}),
      likeCount: post._count?.likes ?? 0,
      likedByMe: !!post.likes?.length,
      commentCount: post._count?.comments ?? 0,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  private mapComment(comment: any, viewerId?: string) {
    const parent = comment.parentComment;
    return {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      userNickname: comment.user.nickname,
      userAvatar: comment.user.avatar,
      content: comment.content,
      status: comment.status,
      ...(comment.userId === viewerId
        ? { rejectReason: comment.rejectReason }
        : {}),
      parentComment:
        parent && (parent.status === 'approved' || parent.userId === viewerId)
          ? {
              id: parent.id,
              userId: parent.userId,
              userNickname: parent.user.nickname,
              deleted: !!parent.deletedAt,
            }
          : null,
      likeCount: comment._count?.likes ?? 0,
      likedByMe: !!comment.likes?.length,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  async publicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...publicUser,
        bio: true,
        studentVerification: { select: { status: true, expiresAt: true } },
        _count: { select: { posts: { where: publicContent } } },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    const isVerifiedStudent = isCurrentStudent(user.studentVerification);
    return success({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: isVerifiedStudent ? (user.bio ?? '') : '',
      isVerifiedStudent,
      postCount: user._count.posts,
    });
  }

  async listPosts(query: SocialQueryDto, viewerId?: string, own = false) {
    const where = own
      ? { deletedAt: null, userId: viewerId! }
      : {
          ...publicContent,
          ...(query.authorId ? { userId: query.authorId } : {}),
        };
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: this.postInclude(viewerId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);
    return success({
      items: items.map((post) => this.mapPost(post, viewerId)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }

  async getPost(id: string, viewerId?: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, ...visibleTo(viewerId) },
      include: this.postInclude(viewerId),
    });
    if (!post) throw new NotFoundException('动态不存在或暂不可查看');
    return success(this.mapPost(post, viewerId));
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.$transaction(async (tx) => {
      const approved = await this.config.getBooleanConfigValue(
        'post.autoApprove',
        undefined,
        tx,
      );
      return tx.post.create({
        data: {
          userId,
          content: dto.content,
          images: dto.images ?? [],
          status: approved ? 'approved' : 'pending',
        },
        include: this.postInclude(userId),
      });
    });
    return success(this.mapPost(post, userId), 201);
  }

  async updatePost(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM posts WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.post.findUnique({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('动态不存在');
      if (existing.userId !== userId)
        throw new ForbiddenException('无权修改这条动态');
      const approved = await this.config.getBooleanConfigValue(
        'post.autoApprove',
        undefined,
        tx,
      );
      const result = await tx.post.updateMany({
        where: {
          id,
          userId,
          deletedAt: null,
          updatedAt: new Date(dto.expectedUpdatedAt),
        },
        data: {
          content: dto.content,
          images: dto.images,
          status: approved ? 'approved' : 'pending',
          rejectReason: null,
        },
      });
      if (!result.count)
        throw new ConflictException('动态已变更，请刷新后重新编辑');
      if (!approved) await this.notifications.withdrawThread(tx, 'post', id);
      return tx.post.findUniqueOrThrow({
        where: { id },
        include: this.postInclude(userId),
      });
    });
    return success(this.mapPost(post, userId));
  }

  async deletePost(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM posts WHERE id = ${id} FOR UPDATE`;
      const post = await tx.post.findUnique({ where: { id, deletedAt: null } });
      if (!post) throw new NotFoundException('动态不存在');
      if (post.userId !== userId)
        throw new ForbiddenException('无权删除这条动态');
      await tx.post.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.notifications.withdrawThread(tx, 'post', id);
    });
    return success();
  }

  async listComments(postId: string, query: SocialQueryDto, viewerId?: string) {
    const root = await this.prisma.post.findFirst({
      where: { id: postId, ...visibleTo(viewerId) },
      select: { status: true },
    });
    if (!root) throw new NotFoundException('动态不存在或暂不可查看');
    const where = { postId, ...visibleTo(viewerId), post: visibleTo(viewerId) };
    const [items, total] = await Promise.all([
      this.prisma.postComment.findMany({
        where,
        include: this.commentInclude(viewerId),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.postComment.count({ where }),
    ]);
    return success({
      items: items.map((comment) => this.mapComment(comment, viewerId)),
      canReply: root.status === 'approved',
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }

  async createComment(
    userId: string,
    postId: string,
    dto: CreatePostCommentDto,
  ) {
    const comment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`;
      const post = await tx.post.findFirst({
        where: { id: postId, ...publicContent },
      });
      if (!post) throw new NotFoundException('动态不存在或暂不可回复');
      let parentUserId: string | undefined;
      if (dto.parentCommentId) {
        const parent = await tx.postComment.findFirst({
          where: { id: dto.parentCommentId, postId, ...publicContent },
          select: { userId: true },
        });
        if (!parent) throw new NotFoundException('回复对象不存在或暂不可回复');
        parentUserId = parent.userId;
      }
      const approved = await this.config.getBooleanConfigValue(
        'postComment.autoApprove',
        undefined,
        tx,
      );
      const saved = await tx.postComment.create({
        data: {
          userId,
          postId,
          content: dto.content,
          parentCommentId: dto.parentCommentId,
          status: approved ? 'approved' : 'pending',
        },
        include: this.commentInclude(userId),
      });
      if (approved)
        await this.notifications.createReply(
          tx,
          userId,
          'postComment',
          saved.id,
          postId,
          [post.userId, ...(parentUserId ? [parentUserId] : [])],
        );
      return saved;
    });
    return success(this.mapComment(comment, userId), 201);
  }

  async deleteComment(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postComment.findUnique({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('回复不存在');
      if (existing.userId !== userId)
        throw new ForbiddenException('无权删除这条回复');
      await tx.$queryRaw`SELECT id FROM posts WHERE id = ${existing.postId} FOR UPDATE`;
      await tx.postComment.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await this.notifications.withdraw(tx, {
        targetType: 'postComment',
        targetId: id,
      });
    });
    return success();
  }

  async report(
    userId: string,
    type: 'post' | 'postComment',
    id: string,
    dto: ReportPostDto,
  ) {
    const target =
      type === 'post'
        ? await this.prisma.post.findFirst({
            where: { id, ...publicContent },
            select: { id: true },
          })
        : await this.prisma.postComment.findFirst({
            where: { id, ...publicContent, post: publicContent },
            select: { id: true },
          });
    if (!target) throw new NotFoundException('内容不存在或暂不可举报');
    await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: type,
        targetId: id,
        ...(type === 'post' ? { postId: id } : { postCommentId: id }),
        type: dto.type,
        reason: dto.reason,
      },
    });
    return success(null, 201);
  }

  private assertCommunityAdmin(admin: AdminCanteenScope) {
    if (!isGlobalScope(admin))
      throw new ForbiddenException('社区管理需要全站权限');
  }

  async adminList(
    type: 'post' | 'postComment',
    query: AdminSocialQueryDto,
    admin: AdminCanteenScope,
  ) {
    this.assertCommunityAdmin(admin);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.authorId ? { userId: query.authorId } : {}),
      deletedAt: null,
      ...(type === 'postComment' ? { post: { deletedAt: null } } : {}),
    };
    const args = {
      where,
      include: { user: { select: publicUser } },
      orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    };
    const [items, total] =
      type === 'post'
        ? await Promise.all([
            this.prisma.post.findMany(args),
            this.prisma.post.count({ where }),
          ])
        : await Promise.all([
            this.prisma.postComment.findMany(args),
            this.prisma.postComment.count({ where }),
          ]);
    return success({
      items: items.map((item) => ({
        ...item,
        userNickname: item.user.nickname,
        userAvatar: item.user.avatar,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }

  async moderate(
    type: 'post' | 'postComment',
    id: string,
    dto: ModeratePostDto,
    approved: boolean,
    admin: AdminCanteenScope,
    reason?: string,
  ) {
    this.assertCommunityAdmin(admin);
    await this.prisma.$transaction(async (tx) => {
      const initial =
        type === 'post'
          ? await tx.post.findUnique({ where: { id, deletedAt: null } })
          : await tx.postComment.findUnique({ where: { id, deletedAt: null } });
      if (!initial) throw new NotFoundException('内容不存在');
      const rootId =
        type === 'post' ? id : (initial as { postId: string }).postId;
      await tx.$queryRaw`SELECT id FROM posts WHERE id = ${rootId} FOR UPDATE`;
      if (approved) {
        const verified = await tx.studentVerification.findFirst({
          where: {
            userId: initial.userId,
            status: 'VERIFIED',
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!verified) throw new ConflictException('作者的学生认证已失效');
      }
      const where = {
        id,
        deletedAt: null,
        status: 'pending',
        updatedAt: new Date(dto.expectedUpdatedAt),
      };
      const data = {
        status: approved ? 'approved' : 'rejected',
        rejectReason: approved ? null : reason,
      };
      if (type === 'post') {
        const result = await tx.post.updateMany({ where, data });
        if (!result.count)
          throw new ConflictException('内容或审核状态已变更，请刷新');
        if (!approved) await this.notifications.withdrawThread(tx, 'post', id);
      } else {
        const root = await tx.post.findFirst({
          where: { id: rootId, ...publicContent },
          select: { userId: true },
        });
        if (approved && !root)
          throw new ConflictException('动态尚不可公开回复');
        const result = await tx.postComment.updateMany({ where, data });
        if (!result.count)
          throw new ConflictException('内容或审核状态已变更，请刷新');
        if (approved && root) {
          const comment = await tx.postComment.findUniqueOrThrow({
            where: { id },
            include: { parentComment: { select: { userId: true } } },
          });
          await this.notifications.createReply(
            tx,
            comment.userId,
            'postComment',
            id,
            rootId,
            [
              root.userId,
              ...(comment.parentComment ? [comment.parentComment.userId] : []),
            ],
          );
        } else
          await this.notifications.withdraw(tx, {
            targetType: 'postComment',
            targetId: id,
          });
      }
    });
    return success();
  }

  async adminDelete(
    type: 'post' | 'postComment',
    id: string,
    admin: AdminCanteenScope,
  ) {
    this.assertCommunityAdmin(admin);
    await this.prisma.$transaction(async (tx) => {
      const item =
        type === 'post'
          ? await tx.post.findUnique({ where: { id, deletedAt: null } })
          : await tx.postComment.findUnique({ where: { id, deletedAt: null } });
      if (!item) throw new NotFoundException('内容不存在');
      const rootId = type === 'post' ? id : (item as { postId: string }).postId;
      await tx.$queryRaw`SELECT id FROM posts WHERE id = ${rootId} FOR UPDATE`;
      if (type === 'post') {
        await tx.post.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await this.notifications.withdrawThread(tx, 'post', id);
      } else {
        await tx.postComment.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await this.notifications.withdraw(tx, {
          targetType: 'postComment',
          targetId: id,
        });
      }
    });
    return success();
  }
}
