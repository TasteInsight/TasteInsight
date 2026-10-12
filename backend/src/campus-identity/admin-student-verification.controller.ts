import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { CampusIdentityService } from './campus-identity.service';
import { StudentDecisionDto } from './dto/student-verification.dto';

@Controller('admin/student-verifications')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('student:review')
export class AdminStudentVerificationController {
  constructor(private readonly campus: CampusIdentityService) {}

  private requireGlobalAdmin(req) {
    if (req.admin.canteenId)
      throw new ForbiddenException('学生认证仅限全局管理员处理');
  }

  @Get()
  async list(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('status') status = 'PENDING',
  ) {
    this.requireGlobalAdmin(req);
    if (page < 1 || pageSize < 1 || pageSize > 100)
      throw new BadRequestException('分页参数无效');
    if (!['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED'].includes(status))
      throw new BadRequestException('认证状态无效');
    return {
      code: 200,
      message: 'success',
      data: await this.campus.list(page, pageSize, status),
    };
  }

  @Post(':userId/decision')
  @HttpCode(200)
  async decide(
    @Request() req,
    @Param('userId') userId: string,
    @Body() dto: StudentDecisionDto,
  ) {
    this.requireGlobalAdmin(req);
    return {
      code: 200,
      message: '审核已保存',
      data: await this.campus.decide(userId, req.admin.id, dto),
    };
  }
}
