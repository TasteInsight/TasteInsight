import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TranslationSettingsService } from './translation-settings.service';
import { ContentTranslationsService } from './content-translations.service';

@Module({
  imports: [ConfigModule],
  providers: [TranslationSettingsService, ContentTranslationsService],
  exports: [ContentTranslationsService, TranslationSettingsService],
})
export class ContentTranslationsModule {}
