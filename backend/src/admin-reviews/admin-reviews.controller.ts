import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { AdminReviewsService } from './admin-reviews.service';
import { RejectReviewDto } from './dto/reject-review.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

@Controller('admin/reviews')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get('pending')
  @RequirePermissions('review:approve')
  @HttpCode(HttpStatus.OK)
  async getPendingReviews(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.adminReviewsService.getPendingReviews(
      Number(page),
      Number(pageSize),
    );
  }

  @Post(':id/approve')
  @RequirePermissions('review:approve')
  @HttpCode(HttpStatus.OK)
  async approveReview(@Param('id') id: string) {
    return this.adminReviewsService.approveReview(id);
  }

  @Post(':id/reject')
  @RequirePermissions('review:approve')
  @HttpCode(HttpStatus.OK)
  async rejectReview(@Param('id') id: string, @Body() dto: RejectReviewDto) {
    return this.adminReviewsService.rejectReview(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('review:delete')
  @HttpCode(HttpStatus.OK)
  async deleteReview(@Param('id') id: string) {
    return this.adminReviewsService.deleteReview(id);
  }
}
