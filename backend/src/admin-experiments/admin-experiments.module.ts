import { Module } from '@nestjs/common';
import { AdminExperimentsController } from './admin-experiments.controller';
import { AdminExperimentsService } from './admin-experiments.service';
import { PrismaService } from '@/prisma.service';

@Module({
  controllers: [AdminExperimentsController],
  providers: [AdminExperimentsService, PrismaService],
  exports: [AdminExperimentsService],
})
export class AdminExperimentsModule {}
