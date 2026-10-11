import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRealm } from './decorators/auth-realm.decorator';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

@Controller('auth')
@AuthRealm('user')
export class PublicAuthController {
  constructor(protected readonly authService: AuthService) {}

  @Post('wechat/login')
  @HttpCode(HttpStatus.OK)
  wechatLogin(@Body() dto: WechatLoginDto) {
    return this.authService.wechatLogin(dto.code);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Request() req) {
    const { sub, type } = req.user;
    return this.authService.refreshToken(sub, type);
  }
}
