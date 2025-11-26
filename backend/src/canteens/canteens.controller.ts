import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CanteensService } from './canteens.service';
import {
  CanteenListResponseDto,
  CanteenResponseDto,
  WindowListResponseDto,
  WindowResponseDto,
} from './dto/canteen-response.dto';
import { DishListResponseDto } from '@/dishes/dto/dish-response.dto';

@Controller()
@UseGuards(AuthGuard)
export class CanteensController {
  constructor(private readonly canteensService: CanteensService) {}

  @Get('canteens')
  async getCanteens(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 6,
  ): Promise<CanteenListResponseDto> {
    return this.canteensService.getCanteens(page, pageSize);
  }

  @Get('canteens/:id')
  async getCanteen(@Param('id') id: string): Promise<CanteenResponseDto> {
    return this.canteensService.getCanteenById(id);
  }

  @Get('canteens/:id/windows')
  async getCanteenWindows(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): Promise<WindowListResponseDto> {
    return this.canteensService.getCanteenWindows(id, page, pageSize);
  }

  @Get('windows/:id')
  async getWindow(@Param('id') id: string): Promise<WindowResponseDto> {
    return this.canteensService.getWindowById(id);
  }

  @Get('windows/:id/dishes')
  async getWindowDishes(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): Promise<DishListResponseDto> {
    return this.canteensService.getWindowDishes(id, page, pageSize);
  }
}
