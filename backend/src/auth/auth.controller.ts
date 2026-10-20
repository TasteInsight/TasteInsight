import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AuthRealm } from './decorators/auth-realm.decorator';
import { PublicAuthController } from './public-auth.controller';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Controller('auth')
@AuthRealm('combined')
export class AuthController extends PublicAuthController {
  @Get('admin/session')
  @UseGuards(AdminAuthGuard)
  session(@Request() req) {
    return this.authService.getAdminSession(req.admin.id);
  }
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(
      adminLoginDto.username,
      adminLoginDto.password,
    );
  }
}
