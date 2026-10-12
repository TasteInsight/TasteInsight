import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { VerifyChallengeDto } from '@/auth/dto/phone-login.dto';
import { CampusIdentityService } from './campus-identity.service';
import { CampusOAuthService } from './campus-oauth.service';
import { campusOAuthPage } from './campus-oauth-page';
import {
  CampusEmailChallengeDto,
  CampusOAuthCallbackDto,
  CompleteCampusOAuthDto,
} from './dto/student-verification.dto';

@Controller('user/student-verification')
export class CampusIdentityController {
  constructor(
    private readonly campus: CampusIdentityService,
    private readonly oauth: CampusOAuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  async status(@Request() req) {
    return {
      code: 200,
      message: 'success',
      data: await this.campus.status(req.user.sub),
    };
  }

  @Post('email/challenges')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async email(@Body() dto: CampusEmailChallengeDto, @Request() req) {
    return {
      code: 200,
      message: '验证码已发送',
      data: await this.campus.emailChallenge(req.user.sub, dto.email, req.ip),
    };
  }

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async submit(@Body() dto: VerifyChallengeDto, @Request() req) {
    return {
      code: 200,
      message: '学生认证申请已提交',
      data: await this.campus.submitEmail(
        req.user.sub,
        dto.challengeId,
        dto.code,
      ),
    };
  }

  @Post('oauth')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async start(@Request() req) {
    return {
      code: 200,
      message: 'success',
      data: await this.oauth.start(req.user.sub, req.headers.origin),
    };
  }

  @Post('oauth/complete')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async complete(@Request() req, @Body() dto: CompleteCampusOAuthDto) {
    return {
      code: 200,
      message: '校园身份已绑定',
      data: await this.oauth.complete(req.user.sub, dto),
    };
  }

  @Get('oauth/callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async callback(
    @Query() dto: CampusOAuthCallbackDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const nonce = randomBytes(24).toString('base64');
    response
      .type('html')
      .setHeader(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      );
    try {
      const data = await this.oauth.callback(dto);
      return campusOAuthPage(nonce, data);
    } catch (error) {
      response.status(error instanceof HttpException ? error.getStatus() : 500);
      return campusOAuthPage(nonce);
    }
  }
}
