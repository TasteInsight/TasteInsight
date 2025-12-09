import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';
import {
  UpdateGlobalConfigDto,
  UpdateCanteenConfigDto,
} from './dto/update-config.dto';
import {
  GlobalConfigResponseDto,
  CanteenConfigResponseDto,
  ConfigTemplateListResponseDto,
  ConfigItemResponseDto,
  EffectiveConfigListResponseDto,
  ConfigSuccessResponseDto,
} from './dto/admin-config-response.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

@Controller('admin/config')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  /**
   * 获取所有配置模板
   */
  @Get('templates')
  @RequirePermissions('config:view')
  @HttpCode(HttpStatus.OK)
  async getTemplates(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 50,
  ): Promise<ConfigTemplateListResponseDto> {
    return this.adminConfigService.getTemplates(Number(page), Number(pageSize));
  }

  /**
   * 获取全局配置
   */
  @Get('global')
  @RequirePermissions('config:view')
  @HttpCode(HttpStatus.OK)
  async getGlobalConfig(): Promise<GlobalConfigResponseDto> {
    return this.adminConfigService.getGlobalConfig();
  }

  /**
   * 更新全局配置项
   */
  @Put('global')
  @RequirePermissions('config:edit')
  @HttpCode(HttpStatus.OK)
  async updateGlobalConfig(
    @Req() req: any,
    @Body() dto: UpdateGlobalConfigDto,
  ): Promise<ConfigItemResponseDto> {
    const admin = req.admin;
    return this.adminConfigService.updateGlobalConfig(
      admin.id,
      admin.canteenId,
      dto,
    );
  }

  /**
   * 获取指定食堂的配置
   */
  @Get('canteen/:canteenId')
  @RequirePermissions('config:view')
  @HttpCode(HttpStatus.OK)
  async getCanteenConfig(
    @Param('canteenId') canteenId: string,
  ): Promise<CanteenConfigResponseDto> {
    return this.adminConfigService.getCanteenConfig(canteenId);
  }

  /**
   * 获取食堂的有效配置（合并全局和食堂配置）
   */
  @Get('canteen/:canteenId/effective')
  @RequirePermissions('config:view')
  @HttpCode(HttpStatus.OK)
  async getEffectiveConfig(
    @Param('canteenId') canteenId: string,
  ): Promise<EffectiveConfigListResponseDto> {
    return this.adminConfigService.getEffectiveConfig(canteenId);
  }

  /**
   * 更新食堂配置项
   */
  @Put('canteen/:canteenId')
  @RequirePermissions('config:edit')
  @HttpCode(HttpStatus.OK)
  async updateCanteenConfig(
    @Req() req: any,
    @Param('canteenId') canteenId: string,
    @Body() dto: UpdateCanteenConfigDto,
  ): Promise<ConfigItemResponseDto> {
    const admin = req.admin;
    return this.adminConfigService.updateCanteenConfig(
      admin.id,
      admin.canteenId,
      canteenId,
      dto,
    );
  }

  /**
   * 删除食堂配置项（恢复为使用全局配置）
   */
  @Delete('canteen/:canteenId/:key')
  @RequirePermissions('config:edit')
  @HttpCode(HttpStatus.OK)
  async deleteCanteenConfigItem(
    @Req() req: any,
    @Param('canteenId') canteenId: string,
    @Param('key') key: string,
  ): Promise<ConfigSuccessResponseDto> {
    const admin = req.admin;
    return this.adminConfigService.deleteCanteenConfigItem(
      admin.id,
      admin.canteenId,
      canteenId,
      key,
    );
  }
}
