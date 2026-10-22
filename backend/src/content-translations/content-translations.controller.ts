import {
  Body,
  Controller,
  HttpCode,
  Get,
  Put,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import {
  CurrentAdmin,
  type AdminInfo,
} from '@/auth/decorators/current-admin.decorator';
import { TranslationSettingsService } from './translation-settings.service';
import { UpdateTranslationSettingsDto } from './dto/update-translation-settings.dto';
import {
  ContentTranslationsService,
  TranslationDraftDto,
} from './content-translations.service';

@Controller('admin/content-translations')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ContentTranslationsController {
  constructor(
    private readonly translations: ContentTranslationsService,
    private readonly settings: TranslationSettingsService,
  ) {}

  @Get('status')
  @RequirePermissions(
    'dish:create',
    'dish:edit',
    'upload:approve',
    'config:edit',
  )
  async status() {
    return { code: 200, data: await this.settings.getStatus() };
  }

  @Get('settings')
  @RequirePermissions('config:view')
  async getSettings(@CurrentAdmin() admin: AdminInfo) {
    return { code: 200, data: await this.settings.getSettings(admin) };
  }

  @Put('settings')
  @RequirePermissions('config:edit')
  async updateSettings(
    @Body() dto: UpdateTranslationSettingsDto,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return { code: 200, data: await this.settings.updateSettings(dto, admin) };
  }

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
