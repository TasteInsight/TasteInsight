import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { UserProfileModule } from '@/user-profile/user-profile.module';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    UserProfileModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({}),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshAuthGuard],
})
export class AuthModule {}
