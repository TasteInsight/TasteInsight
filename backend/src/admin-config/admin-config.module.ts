import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminConfigService } from './admin-config.service';
import { AdminConfigController } from './admin-config.controller';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminConfigController],
  providers: [AdminConfigService],
  exports: [AdminConfigService],
})
export class AdminConfigModule {}
