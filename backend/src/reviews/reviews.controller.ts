import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ReviewListResponseDto, ReviewResponseDto } from './dto/review.dto';
import { ReportReviewResponseDto } from './dto/report-review.dto';

@Controller()
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('dishes/:dishId/reviews')
  async getReviews(
    @Param('dishId') dishId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ): Promise<ReviewListResponseDto> {
    return this.reviewsService.getReviews(dishId, page, pageSize);
  }

  @Post('reviews')
  async create(
    @Request() req,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const userId = req.user.sub;
    return this.reviewsService.createReview(userId, createReviewDto);
  }

  @Post('reviews/:id/report')
  async report(
    @Request() req,
    @Param('id') id: string,
    @Body() reportReviewDto: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    const userId = req.user.sub;
    return this.reviewsService.reportReview(userId, id, reportReviewDto);
  }
}
