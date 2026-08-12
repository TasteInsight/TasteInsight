import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

@Controller('auth') // 所有路由都带 auth 前缀
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat/login')
  @HttpCode(HttpStatus.OK)
  wechatLogin(@Body() wechatLoginDto: WechatLoginDto) {
    return this.authService.wechatLogin(wechatLoginDto.code);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(
      adminLoginDto.username,
      adminLoginDto.password,
    );
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Request() req) {
    const { sub, type } = req.user;
    return this.authService.refreshToken(sub, type);
  }
}
