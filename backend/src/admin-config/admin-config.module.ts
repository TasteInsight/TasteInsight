import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminConfigService } from './admin-config.service';

@Module({
  imports: [ConfigModule],
  providers: [AdminConfigService],
  exports: [AdminConfigService],
})
export class AdminConfigModule {}
