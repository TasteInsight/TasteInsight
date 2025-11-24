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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminReviewsService } from './admin-reviews.service';
import { RejectReviewDto } from './dto/reject-review.dto';
import {
  PendingReviewListResponse,
  SuccessResponse,
  ErrorResponse,
} from './dto/review-response.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('管理-审核')
@Controller('admin/reviews')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get('pending')
  @ApiOperation({
    summary: '获取待审核评价列表',
    description: '管理员获取待审核的评价列表（需审核权限）',
    operationId: 'adminGetPendingReviews',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: PendingReviewListResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponse })
  @RequirePermissions('review:approve')
  @HttpCode(HttpStatus.OK)
  async getPendingReviews(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.adminReviewsService.getPendingReviews(Number(page), Number(pageSize));
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: '通过评价审核',
    description: '管理员通过评价审核（需审核权限）',
    operationId: 'adminApproveReview',
  })
  @ApiResponse({
    status: 200,
    description: '审核通过',
    type: SuccessResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Review not found', type: ErrorResponse })
  @RequirePermissions('review:approve')
  @HttpCode(HttpStatus.OK)
  async approveReview(@Param('id') id: string) {
    return this.adminReviewsService.approveReview(id);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: '拒绝评价审核',
    description: '管理员拒绝评价审核（需审核权限）',
    operationId: 'adminRejectReview',
  })
  @ApiResponse({
    status: 200,
    description: '已拒绝',
    type: SuccessResponse,
  })
  @ApiResponse({ status: 400, description: 'Validation Error', type: ErrorResponse })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Review not found', type: ErrorResponse })
  @RequirePermissions('review:approve')
  @HttpCode(HttpStatus.OK)
  async rejectReview(@Param('id') id: string, @Body() dto: RejectReviewDto) {
    return this.adminReviewsService.rejectReview(id, dto);
  }
}
