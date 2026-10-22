import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIConfigService } from '@/ai-chat/services/ai-config.service';
import { ContentTranslationsService } from './content-translations.service';

@Module({
  imports: [ConfigModule],
  providers: [AIConfigService, ContentTranslationsService],
  exports: [ContentTranslationsService],
})
export class ContentTranslationsModule {}
