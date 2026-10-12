import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { SocialService } from './social.service';
import {
  ModeratePostDto,
  AdminSocialQueryDto,
  RejectPostDto,
  SocialQueryDto,
} from './dto/social.dto';

@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminSocialController {
  constructor(private readonly social: SocialService) {}
  @Get('posts')
  @RequirePermissions('post:view')
  allPosts(@Request() req, @Query() query: AdminSocialQueryDto) {
    return this.social.adminList('post', query, req.admin);
  }
  @Get('post-comments')
  @RequirePermissions('post:view')
  allComments(@Request() req, @Query() query: AdminSocialQueryDto) {
    return this.social.adminList('postComment', query, req.admin);
  }
  @Get('posts/pending')
  @RequirePermissions('post:view')
  posts(@Request() req, @Query() query: SocialQueryDto) {
    return this.social.adminList(
      'post',
      { ...query, status: 'pending' },
      req.admin,
    );
  }
  @Get('post-comments/pending')
  @RequirePermissions('post:view')
  comments(@Request() req, @Query() query: SocialQueryDto) {
    return this.social.adminList(
      'postComment',
      { ...query, status: 'pending' },
      req.admin,
    );
  }
  @Post('posts/:id/approve')
  @RequirePermissions('post:approve')
  @HttpCode(200)
  approve(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.social.moderate('post', id, dto, true, req.admin);
  }
  @Post('posts/:id/reject')
  @RequirePermissions('post:approve')
  @HttpCode(200)
  reject(@Request() req, @Param('id') id: string, @Body() dto: RejectPostDto) {
    return this.social.moderate('post', id, dto, false, req.admin, dto.reason);
  }
  @Post('post-comments/:id/approve')
  @RequirePermissions('post:approve')
  @HttpCode(200)
  approveComment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.social.moderate('postComment', id, dto, true, req.admin);
  }
  @Post('post-comments/:id/reject')
  @RequirePermissions('post:approve')
  @HttpCode(200)
  rejectComment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RejectPostDto,
  ) {
    return this.social.moderate(
      'postComment',
      id,
      dto,
      false,
      req.admin,
      dto.reason,
    );
  }
  @Delete('posts/:id')
  @RequirePermissions('post:delete')
  delete(@Request() req, @Param('id') id: string) {
    return this.social.adminDelete('post', id, req.admin);
  }
  @Delete('post-comments/:id')
  @RequirePermissions('post:delete')
  deleteComment(@Request() req, @Param('id') id: string) {
    return this.social.adminDelete('postComment', id, req.admin);
  }
}
