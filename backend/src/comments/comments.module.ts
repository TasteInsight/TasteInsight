import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AdminConfigModule } from '@/admin-config/admin-config.module';

@Module({
  imports: [AdminConfigModule],
  controllers: [CommentsController],
  providers: [CommentsService, PrismaService, JwtService],
})
export class CommentsModule {}
