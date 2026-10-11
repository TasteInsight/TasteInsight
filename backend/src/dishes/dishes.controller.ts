import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DishesService } from './dishes.service';
import { GetDishesDto, GetDishesByIdsDto } from './dto/get-dishes.dto';
import { UploadDishDto } from './dto/upload-dish.dto';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { OptionalAuthGuard } from '@/auth/guards/optional-auth.guard';
import { StudentGuard } from '@/auth/guards/student.guard';
import { RecommendationRequestDto } from '@/recommendation/dto/recommendation-request.dto';
import { RecommendationService } from '@/recommendation/recommendation.service';

@Controller('dishes')
export class DishesController {
  constructor(
    private readonly dishesService: DishesService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Post('upload')
  @UseGuards(AuthGuard, StudentGuard)
  @HttpCode(HttpStatus.CREATED)
  uploadDish(@Body() uploadDishDto: UploadDishDto, @Request() req) {
    const userId = req.user.sub;
    return this.dishesService.uploadDish(uploadDishDto, userId);
  }

  @Post()
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.OK)
  getDishes(@Body() getDishesDto: GetDishesDto, @Request() req) {
    const userId = req.user?.sub;
    return this.dishesService.getDishes(getDishesDto, userId);
  }

  @Post('by-ids')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.OK)
  getDishesByIds(@Body() body: GetDishesByIdsDto, @Request() req) {
    const userId = req.user?.sub;
    return this.dishesService.getDishesByIds(body.ids, userId);
  }

  @Post('recommendations')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  getRecommendations(
    @Body() getRecommendationsDto: RecommendationRequestDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.recommendationService.getRecommendations(
      userId,
      getRecommendationsDto,
    );
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.OK)
  getDishById(@Param('id') id: string, @Request() req) {
    const userId = req.user?.sub;
    return this.dishesService.getDishById(id, userId);
  }

  @Post(':id/favorite')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  favoriteDish(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.dishesService.favoriteDish(id, userId);
  }

  @Delete(':id/favorite')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  unfavoriteDish(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.dishesService.unfavoriteDish(id, userId);
  }
}
