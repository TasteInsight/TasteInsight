import { Module } from '@nestjs/common';
import { AdminExperimentsController } from './admin-experiments.controller';
import { AdminExperimentsService } from './admin-experiments.service';
import { PrismaService } from '@/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminExperimentsController],
  providers: [AdminExperimentsService, PrismaService],
  exports: [AdminExperimentsService],
})
export class AdminExperimentsModule {}
