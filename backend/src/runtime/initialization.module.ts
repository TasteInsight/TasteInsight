import { Module } from '@nestjs/common';
import { AdminConfigModule } from '../admin-config/admin-config.module';
import { PrismaModule } from '../prisma.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseInitializer } from './database-initializer.service';

@Module({
  imports: [ConfigModule, PrismaModule, AdminConfigModule],
  providers: [DatabaseInitializer],
  exports: [DatabaseInitializer],
})
export class InitializationModule {}
