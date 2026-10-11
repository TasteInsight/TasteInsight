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
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

@Controller('auth')
@AuthRealm('admin')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.username, dto.password);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Request() req) {
    const { sub, type } = req.user;
    return this.authService.refreshToken(sub, type);
  }
}
