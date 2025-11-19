import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { DishesService } from './dishes.service';
import { GetDishesDto } from './dto/get-dishes.dto';
import { UploadDishDto } from './dto/upload-dish.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('dishes')
@UseGuards(AuthGuard) // 所有接口都需要认证
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  // 注意：具体路由要放在参数路由之前，避免被 :id 匹配
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  uploadDish(@Body() uploadDishDto: UploadDishDto, @Request() req) {
    const userId = req.user.sub;
    return this.dishesService.uploadDish(uploadDishDto, userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  getDishes(@Body() getDishesDto: GetDishesDto) {
    return this.dishesService.getDishes(getDishesDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getDishById(@Param('id') id: string) {
    return this.dishesService.getDishById(id);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  favoriteDish(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.dishesService.favoriteDish(id, userId);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  unfavoriteDish(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.dishesService.unfavoriteDish(id, userId);
  }
}
