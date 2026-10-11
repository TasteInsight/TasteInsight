import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AuthRealm } from './decorators/auth-realm.decorator';
import { PublicAuthController } from './public-auth.controller';

@Controller('auth')
@AuthRealm('combined')
export class AuthController extends PublicAuthController {
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(
      adminLoginDto.username,
      adminLoginDto.password,
    );
  }
}
