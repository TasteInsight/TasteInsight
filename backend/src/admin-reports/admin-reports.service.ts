import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { HandleReportDto } from './dto/handle-report.dto';
import {
  ReportListResponseDto,
  SuccessResponseDto,
  ReportItemData,
} from './dto/report-response.dto';

@Injectable()
export class AdminReportsService {
  constructor(private prisma: PrismaService) {}

  async getReports(
    page: number = 1,
    pageSize: number = 20,
    status?: 'pending' | 'approved' | 'rejected',
  ): Promise<ReportListResponseDto> {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [total, reports] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          review: {
            select: {
              content: true,
              userId: true,
              deletedAt: true,
              user: {
                select: {
                  nickname: true,
                },
              },
            },
          },
          comment: {
            select: {
              content: true,
              userId: true,
              deletedAt: true,
              user: {
                select: {
                  nickname: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items: ReportItemData[] = reports.map((report) => {
      // 根据 targetType 获取被举报内容的信息
      let targetContent: ReportItemData['targetContent'] | undefined;

      if (report.targetType === 'review' && report.review) {
        targetContent = {
          content: report.review.content,
          userId: report.review.userId,
          userNickname: report.review.user.nickname,
          isDeleted: report.review.deletedAt !== null,
        };
      } else if (report.targetType === 'comment' && report.comment) {
        targetContent = {
          content: report.comment.content,
          userId: report.comment.userId,
          userNickname: report.comment.user.nickname,
          isDeleted: report.comment.deletedAt !== null,
        };
      }

      return {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        type: report.type,
        reason: report.reason,
        status: report.status,
        handleResult: report.handleResult,
        handledBy: report.handledBy,
        handledAt: report.handledAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        reporter: {
          id: report.reporter.id,
          nickname: report.reporter.nickname,
          avatar: report.reporter.avatar,
        },
        targetContent,
      };
    });

    return {
      code: 200,
      message: 'success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async handleReport(
    id: string,
    dto: HandleReportDto,
    adminId: string,
  ): Promise<SuccessResponseDto> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        review: true,
        comment: true,
      },
    });

    if (!report) {
      throw new NotFoundException('举报不存在');
    }

    if (report.status !== 'pending') {
      throw new BadRequestException('该举报已被处理');
    }

    // 根据不同的 action 进行处理
    switch (dto.action) {
      case 'delete_content':
        // 先更新举报状态为已通过，然后软删除被举报的内容
        await this.prisma.report.update({
          where: { id },
          data: {
            status: 'approved',
            handleResult: dto.result || '内容已删除',
            handledBy: adminId,
            handledAt: new Date(),
          },
        });

        // 软删除被举报的内容（如果尚未被删除）
        if (report.targetType === 'review' && report.reviewId) {
          const review = await this.prisma.review.findUnique({
            where: { id: report.reviewId },
          });
          if (review && !review.deletedAt) {
            await this.prisma.review.update({
              where: { id: report.reviewId },
              data: { deletedAt: new Date() },
            });
          }
        } else if (report.targetType === 'comment' && report.commentId) {
          const comment = await this.prisma.comment.findUnique({
            where: { id: report.commentId },
          });
          if (comment && !comment.deletedAt) {
            await this.prisma.comment.update({
              where: { id: report.commentId },
              data: { deletedAt: new Date() },
            });
          }
        }
        break;

      case 'warn_user':
        // 警告用户（目前只记录处理结果，后续可扩展用户警告系统）
        await this.prisma.report.update({
          where: { id },
          data: {
            status: 'approved',
            handleResult: dto.result || '已警告用户',
            handledBy: adminId,
            handledAt: new Date(),
          },
        });
        break;

      case 'reject_report':
        // 拒绝举报
        await this.prisma.report.update({
          where: { id },
          data: {
            status: 'rejected',
            handleResult: dto.result || '举报被拒绝',
            handledBy: adminId,
            handledAt: new Date(),
          },
        });
        break;
    }

    return {
      code: 200,
      message: '处理成功',
      data: null,
    };
  }
}
