import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthRealm } from './decorators/auth-realm.decorator';
import { PhoneChallengeDto, VerifyChallengeDto } from './dto/phone-login.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { identityCapabilities } from './identity-configuration';
import { VerificationChallengeService } from './verification-challenge.service';

@Controller('auth')
@AuthRealm('user')
export class PublicAuthController {
  constructor(
    protected readonly authService: AuthService,
    private readonly challenges: VerificationChallengeService,
    private readonly config: ConfigService,
  ) {}

  @Get('capabilities')
  capabilities() {
    return {
      code: 200,
      message: 'success',
      data: identityCapabilities((key) => this.config.get(key)),
    };
  }

  @Post('phone/challenges')
  @HttpCode(HttpStatus.OK)
  async phoneChallenge(@Body() dto: PhoneChallengeDto, @Request() req) {
    return {
      code: 200,
      message: '验证码已发送',
      data: await this.challenges.issue('PHONE_LOGIN', dto.phone, req.ip),
    };
  }

  @Post('phone/login')
  @HttpCode(HttpStatus.OK)
  phoneLogin(@Body() dto: VerifyChallengeDto) {
    return this.authService.phoneLogin(dto.challengeId, dto.code);
  }

  @Post('wechat/login')
  @HttpCode(HttpStatus.OK)
  wechatLogin(@Body() dto: WechatLoginDto) {
    return this.authService.wechatLogin(dto.code, dto.platform);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Request() req) {
    const { sub, type } = req.user;
    return this.authService.refreshToken(sub, type);
  }
}
