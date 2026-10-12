import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { UserProfileModule } from '@/user-profile/user-profile.module';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { AuthGuard } from './guards/auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { StudentGuard } from './guards/student.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { VerificationChallengeService } from './verification-challenge.service';
import { VerificationDeliveryService } from './verification-delivery.service';
import { UserIdentityService } from './user-identity.service';
import { CampusIdentityService } from '@/campus-identity/campus-identity.service';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    UserProfileModule,
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    RefreshAuthGuard,
    AuthGuard,
    OptionalAuthGuard,
    StudentGuard,
    AdminAuthGuard,
    PermissionsGuard,
    VerificationChallengeService,
    VerificationDeliveryService,
    UserIdentityService,
    CampusIdentityService,
    CampusOAuthService,
  ],
  exports: [
    JwtModule,
    AuthService,
    AuthGuard,
    RefreshAuthGuard,
    OptionalAuthGuard,
    StudentGuard,
    AdminAuthGuard,
    PermissionsGuard,
    VerificationChallengeService,
    UserIdentityService,
    CampusIdentityService,
    CampusOAuthService,
  ],
})
export class AuthModule {}
