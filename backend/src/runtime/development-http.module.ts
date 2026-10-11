import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuthController } from '@/auth/auth.controller';
import { UploadModule } from '@/upload/upload.module';
import { UploadController } from '@/upload/upload.controller';
import { PublicFeaturesHttpModule } from './public-http.module';
import { AdminFeaturesHttpModule } from './admin-http.module';

@Module({
  imports: [
    PublicFeaturesHttpModule,
    AdminFeaturesHttpModule,
    AuthModule,
    UploadModule,
  ],
  controllers: [AuthController, UploadController],
})
export class DevelopmentHttpModule {}
