import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    // 修正：使用 registerAsync 进行 JWT 模块的动态配置
    JwtModule.registerAsync({
      imports: [ConfigModule], // 导入 ConfigModule 以便使用 ConfigService
      inject: [ConfigService], // 注入 ConfigService
      useFactory: async (configService: ConfigService) => ({
        // 注意：这里不再需要 secret 和 expiresIn，因为 AuthGuard 会用到
        // 我们会在 AuthGuard 和 AuthService 中指定不同的 secret
        // 但我们可以设置一个全局 secret 如果需要的话
        // global: true, // 如果想让 JwtService 在任何地方都可用，可以取消注释
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
})
export class AuthModule {}
