import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { UserProfileModule } from '@/user-profile/user-profile.module';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { AuthGuard } from './guards/auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

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
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    JwtModule,
    AuthService,
    AuthGuard,
    RefreshAuthGuard,
    AdminAuthGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
