import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CommentListResponseDto,
  CommentResponseDto,
  SuccessResponseDto,
} from './dto/comment-response.dto';
import { ReportCommentDto } from './dto/report-comment.dto';

@Controller('comments')
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':reviewId')
  async getComments(
    @Param('reviewId') reviewId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): Promise<CommentListResponseDto> {
    return this.commentsService.getComments(
      reviewId,
      Number(page),
      Number(pageSize),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Request() req: any,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.createComment(req.user.sub, dto);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  async reportComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReportCommentDto,
  ): Promise<SuccessResponseDto> {
    return this.commentsService.reportComment(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<SuccessResponseDto> {
    return this.commentsService.deleteComment(req.user.sub, id);
  }
}
