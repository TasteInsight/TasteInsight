import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { OptionalAuthGuard } from '@/auth/guards/optional-auth.guard';
import { StudentGuard } from '@/auth/guards/student.guard';
import { ContentLikesService } from '@/social/content-likes.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import {
  CommentListResponseDto,
  CommentResponseDto,
  SuccessResponseDto,
} from './dto/comment-response.dto';
import { ReportCommentDto } from './dto/report-comment.dto';

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly likes: ContentLikesService,
  ) {}

  @Get(':reviewId')
  @UseGuards(OptionalAuthGuard)
  async getComments(
    @Param('reviewId') reviewId: string,
    @Query() query: CommentQueryDto,
    @Request() req,
  ): Promise<CommentListResponseDto> {
    return this.commentsService.getComments(
      reviewId,
      query.page,
      query.pageSize,
      req.user?.sub,
    );
  }

  @Post()
  @UseGuards(AuthGuard, StudentGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Request() req: any,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.createComment(req.user.sub, dto);
  }

  @Post(':id/report')
  @UseGuards(AuthGuard, StudentGuard)
  @HttpCode(HttpStatus.CREATED)
  async reportComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReportCommentDto,
  ): Promise<SuccessResponseDto> {
    return this.commentsService.reportComment(req.user.sub, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<SuccessResponseDto> {
    return this.commentsService.deleteComment(req.user.sub, id);
  }

  @Put(':id/like')
  @UseGuards(AuthGuard, StudentGuard)
  like(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'comment', id, true);
  }

  @Delete(':id/like')
  @UseGuards(AuthGuard, StudentGuard)
  unlike(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'comment', id, false);
  }
}
