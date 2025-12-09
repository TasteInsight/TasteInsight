import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminCommentsService } from './admin-comments.service';
import { RejectCommentDto } from './dto/reject-comment.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

@Controller('admin/comments')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminCommentsController {
  constructor(private readonly adminCommentsService: AdminCommentsService) {}

  @Get('pending')
  @RequirePermissions('comment:approve')
  @HttpCode(HttpStatus.OK)
  async getPendingComments(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.adminCommentsService.getPendingComments(
      Number(page),
      Number(pageSize),
    );
  }

  @Post(':id/approve')
  @RequirePermissions('comment:approve')
  @HttpCode(HttpStatus.OK)
  async approveComment(@Param('id') id: string) {
    return this.adminCommentsService.approveComment(id);
  }

  @Post(':id/reject')
  @RequirePermissions('comment:approve')
  @HttpCode(HttpStatus.OK)
  async rejectComment(@Param('id') id: string, @Body() dto: RejectCommentDto) {
    return this.adminCommentsService.rejectComment(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('comment:delete')
  @HttpCode(HttpStatus.OK)
  async deleteComment(@Param('id') id: string) {
    return this.adminCommentsService.deleteComment(id);
  }
}
