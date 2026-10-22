import {
  Body,
  Controller,
  Get,
  HttpCode,
  Header,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest } from 'express';
import { CampusLoginDto } from '@/campus-identity/dto/student-verification.dto';
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

  @Post('campus/oauth')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async startCampusLogin(@Request() req) {
    return {
      code: 200,
      message: 'success',
      data: await this.authService.startCampusLogin(req.ip, req.headers.origin),
    };
  }

  @Post('campus/login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  campusLogin(@Body() dto: CampusLoginDto, @Request() req: ExpressRequest) {
    return this.authService.campusLogin(dto, this.nicknameLanguage(req));
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
  phoneLogin(@Body() dto: VerifyChallengeDto, @Request() req: ExpressRequest) {
    return this.authService.phoneLogin(
      dto.challengeId,
      dto.code,
      this.nicknameLanguage(req),
    );
  }

  @Post('wechat/login')
  @HttpCode(HttpStatus.OK)
  wechatLogin(@Body() dto: WechatLoginDto, @Request() req: ExpressRequest) {
    return this.authService.wechatLogin(
      dto.code,
      dto.platform,
      this.nicknameLanguage(req),
    );
  }

  private nicknameLanguage(req: ExpressRequest): string {
    return req.acceptsLanguages(['zh', 'en']) || 'en';
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Request() req) {
    const { sub, type, sessionVersion } = req.user;
    return this.authService.refreshToken(sub, type, sessionVersion);
  }
}
