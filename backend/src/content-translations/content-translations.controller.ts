import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import {
  ContentTranslationsService,
  TranslationDraftDto,
} from './content-translations.service';

@Controller('admin/content-translations')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ContentTranslationsController {
  constructor(private readonly translations: ContentTranslationsService) {}
  @Post()
  @HttpCode(200)
  @RequirePermissions(
    'dish:create',
    'dish:edit',
    'upload:approve',
    'config:edit',
  )
  async draft(
    @Body() dto: TranslationDraftDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    response.once('close', abort);
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.translations.draft(dto, controller.signal),
      };
    } finally {
      response.off('close', abort);
    }
  }
}
