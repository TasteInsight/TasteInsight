import {
  Body,
  Controller,
  Get,
  HttpCode,
  Header,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { CompleteCampusOAuthDto } from '@/campus-identity/dto/student-verification.dto';
import { AuthGuard } from './guards/auth.guard';
import { UserIdentityService } from './user-identity.service';
import { VerificationChallengeService } from './verification-challenge.service';
import { PhoneChallengeDto, VerifyChallengeDto } from './dto/phone-login.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';

@Controller('user/identities')
@UseGuards(AuthGuard)
export class IdentityController {
  constructor(
    private readonly identities: UserIdentityService,
    private readonly challenges: VerificationChallengeService,
    private readonly campusOAuth: CampusOAuthService,
  ) {}

  @Get()
  async list(@Request() req) {
    return {
      code: 200,
      message: 'success',
      data: await this.identities.list(req.user.sub),
    };
  }

  @Post('campus/oauth')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async startCampusBinding(@Request() req) {
    return {
      code: 200,
      message: 'success',
      data: await this.campusOAuth.startBinding(
        req.user.sub,
        req.headers.origin,
      ),
    };
  }

  @Post('campus/oauth/complete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async completeCampusBinding(
    @Request() req,
    @Body() dto: CompleteCampusOAuthDto,
  ) {
    return {
      code: 200,
      message: '校园登录方式已绑定',
      data: await this.campusOAuth.completeBinding(req.user.sub, dto),
    };
  }

  @Post('phone/challenges')
  @HttpCode(200)
  async challenge(@Body() dto: PhoneChallengeDto, @Request() req) {
    return {
      code: 200,
      message: '验证码已发送',
      data: await this.challenges.issue(
        'PHONE_BIND',
        dto.phone,
        req.ip,
        req.user.sub,
      ),
    };
  }

  @Post('phone')
  @HttpCode(200)
  async phone(@Body() dto: VerifyChallengeDto, @Request() req) {
    const phone = await this.challenges.consume(
      'PHONE_BIND',
      dto.challengeId,
      dto.code,
      req.user.sub,
    );
    await this.identities.phone(phone, req.user.sub);
    return { code: 200, message: '手机号已绑定', data: null };
  }

  @Post('wechat')
  @HttpCode(200)
  async wechat(@Body() dto: WechatLoginDto, @Request() req) {
    await this.identities.wechat(dto.code, dto.platform, req.user.sub);
    return { code: 200, message: '微信已绑定', data: null };
  }
}
