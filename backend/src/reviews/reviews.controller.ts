import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
  Put,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { OptionalAuthGuard } from '@/auth/guards/optional-auth.guard';
import { StudentGuard } from '@/auth/guards/student.guard';
import { ContentLikesService } from '@/social/content-likes.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import {
  ReviewListResponseDto,
  ReviewResponseDto,
  DeleteReviewResponseDto,
  OwnReviewResponseDto,
} from './dto/review-response.dto';
import { ReportReviewResponseDto } from './dto/report-review.dto';

@Controller()
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly likes: ContentLikesService,
  ) {}

  @Get('dishes/:dishId/reviews/mine')
  @UseGuards(AuthGuard)
  async getOwnReview(
    @Request() req,
    @Param('dishId') dishId: string,
  ): Promise<OwnReviewResponseDto> {
    return this.reviewsService.getOwnReview(req.user.sub, dishId);
  }

  @Get('dishes/:dishId/reviews')
  @UseGuards(OptionalAuthGuard)
  async getReviews(
    @Param('dishId') dishId: string,
    @Query() query: ReviewQueryDto,
    @Request() req,
  ): Promise<ReviewListResponseDto> {
    return this.reviewsService.getReviews(
      dishId,
      query.page,
      query.pageSize,
      req.user?.sub,
    );
  }

  @Post('reviews')
  @UseGuards(AuthGuard, StudentGuard)
  async create(
    @Request() req,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const userId = req.user.sub;
    return this.reviewsService.createReview(userId, createReviewDto);
  }

  @Post('reviews/:id/report')
  @UseGuards(AuthGuard, StudentGuard)
  async report(
    @Request() req,
    @Param('id') id: string,
    @Body() reportReviewDto: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    const userId = req.user.sub;
    return this.reviewsService.reportReview(userId, id, reportReviewDto);
  }

  @Delete('reviews/:id')
  @UseGuards(AuthGuard)
  async remove(
    @Request() req,
    @Param('id') id: string,
  ): Promise<DeleteReviewResponseDto> {
    const userId = req.user.sub;
    return this.reviewsService.deleteReview(userId, id);
  }

  @Put('reviews/:id/like')
  @UseGuards(AuthGuard, StudentGuard)
  like(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'review', id, true);
  }

  @Delete('reviews/:id/like')
  @UseGuards(AuthGuard, StudentGuard)
  unlike(@Request() req, @Param('id') id: string) {
    return this.likes.setLike(req.user.sub, 'review', id, false);
  }
}
