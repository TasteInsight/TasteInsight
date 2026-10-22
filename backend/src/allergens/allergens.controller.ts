import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AllergensService } from './allergens.service';
import { SaveAllergenDto } from './allergens.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { CurrentAdmin } from '@/auth/decorators/current-admin.decorator';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { AuditInTransaction } from '@/admin-logs/admin-audit';

@Controller('allergens')
export class AllergensController {
  constructor(private readonly allergens: AllergensService) {}
  @Get()
  async list() {
    return {
      code: 200,
      message: 'success',
      data: await this.allergens.catalog(),
    };
  }
}

@Controller('admin/allergens')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminAllergensController {
  constructor(private readonly allergens: AllergensService) {}
  @Get()
  @RequirePermissions('config:view')
  async list() {
    return {
      code: 200,
      message: 'success',
      data: await this.allergens.catalog(),
    };
  }
  @Post()
  @HttpCode(201)
  @RequirePermissions('config:edit')
  @AuditInTransaction('allergen:create')
  async create(@Body() dto: SaveAllergenDto, @CurrentAdmin() admin: AdminInfo) {
    return {
      code: 201,
      message: 'success',
      data: await this.allergens.save(dto, admin),
    };
  }
  @Put(':value')
  @RequirePermissions('config:edit')
  @AuditInTransaction('allergen:update')
  async update(
    @Param('value') value: string,
    @Body() dto: SaveAllergenDto,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return {
      code: 200,
      message: 'success',
      data: await this.allergens.save(dto, admin, value),
    };
  }
}
