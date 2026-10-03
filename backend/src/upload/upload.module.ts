import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { UploadAuthGuard } from './upload-auth.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [UploadController],
  providers: [
    UploadService,
    LocalStorageStrategy,
    OssStorageStrategy,
    AuthGuard,
    AdminAuthGuard,
    UploadAuthGuard,
  ],
  exports: [UploadService],
})
export class UploadModule {}
