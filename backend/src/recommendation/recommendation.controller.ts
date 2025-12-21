import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RecommendationService } from './recommendation.service';
import { EventLoggerService } from './services/event-logger.service';
import {
  RecommendationRequestDto,
  GetSimilarDishesDto,
  GetPersonalizedDishesDto,
  ClickEventDto,
  FavoriteEventDto,
  ReviewEventDto,
  DislikeEventDto,
} from './dto/recommendation-request.dto';
import { RecommendationScene } from './constants/recommendation.constants';

/**
 * 推荐系统控制器
 *
 * 提供完整的推荐 API，包括：
 * - 个性化推荐
 * - 相似菜品推荐
 * - 事件追踪（点击、收藏、评价等）
 * - 推荐结果查询（用于分析）
 */
@Controller('recommend')
@UseGuards(AuthGuard)
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  // ==================== 推荐获取接口 ====================

  /**
   * 获取个性化推荐
   * 支持多场景、A/B 测试、搜索过滤等
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async getRecommendations(
    @Body() dto: RecommendationRequestDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.recommendationService.getRecommendations(userId, dto);
  }

  /**
   * 获取相似菜品推荐
   */
  @Post('similar/:dishId')
  @HttpCode(HttpStatus.OK)
  async getSimilarDishes(
    @Param('dishId') dishId: string,
    @Body() dto: GetSimilarDishesDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    const result = await this.recommendationService.getSimilarDishes(
      dishId,
      {
        page: dto.pagination.page,
        pageSize: dto.pagination.pageSize,
      },
      userId,
    );

    return {
      code: 200,
      message: 'success',
      data: {
        items: result.items.map((item) => ({
          id: item.dish.id,
          score: item.score,
        })),
        total: result.total,
        pagination: {
          page: dto.pagination.page,
          pageSize: dto.pagination.pageSize,
          totalPages: result.totalPages,
        },
      },
    };
  }

  /**
   * 获取基于嵌入的个性化推荐
   */
  @Post('personal')
  @HttpCode(HttpStatus.OK)
  async getPersonalizedDishes(
    @Body() dto: GetPersonalizedDishesDto,
    @Request() req,
  ) {
    const userId = req.user.sub;

    const result = await this.recommendationService.getPersonalizedDishes(
      userId,
      {
        canteenId: dto.canteenId,
        mealTime: dto.mealTime,
        pagination: {
          page: dto.pagination.page,
          pageSize: dto.pagination.pageSize,
        },
      },
    );

    return {
      code: 200,
      message: 'success',
      data: {
        items: result.items.map((item) => ({
          id: item.dish.id,
          score: item.score,
        })),
        total: result.total,
        pagination: {
          page: dto.pagination.page,
          pageSize: dto.pagination.pageSize,
          totalPages: result.totalPages,
        },
      },
    };
  }

  // ==================== 事件追踪接口 ====================

  /**
   * 记录点击事件
   *
   * 当用户点击推荐的菜品时调用
   */
  @Post('events/click')
  @HttpCode(HttpStatus.OK)
  async logClickEvent(@Body() dto: ClickEventDto, @Request() req) {
    const userId = req.user.sub;
    const eventId = await this.recommendationService.logClickEvent(
      userId,
      dto.dishId,
      {
        scene: dto.scene || RecommendationScene.HOME,
        requestId: dto.requestId,
        position: dto.position,
        experimentId: dto.experimentId,
        groupItemId: dto.groupItemId,
      },
    );

    return {
      code: 200,
      message: 'success',
      data: { eventId },
    };
  }

  /**
   * 记录收藏事件
   *
   * 当用户收藏推荐的菜品时调用
   */
  @Post('events/favorite')
  @HttpCode(HttpStatus.OK)
  async logFavoriteEvent(@Body() dto: FavoriteEventDto, @Request() req) {
    const userId = req.user.sub;
    const eventId = await this.recommendationService.logFavoriteEvent(
      userId,
      dto.dishId,
      {
        scene: dto.scene || RecommendationScene.HOME,
        requestId: dto.requestId,
        position: dto.position,
        experimentId: dto.experimentId,
        groupItemId: dto.groupItemId,
      },
    );

    return {
      code: 200,
      message: 'success',
      data: { eventId },
    };
  }

  /**
   * 记录评价事件
   *
   * 当用户评价推荐的菜品时调用
   */
  @Post('events/review')
  @HttpCode(HttpStatus.OK)
  async logReviewEvent(@Body() dto: ReviewEventDto, @Request() req) {
    const userId = req.user.sub;
    const eventId = await this.recommendationService.logReviewEvent(
      userId,
      dto.dishId,
      dto.rating,
      {
        scene: dto.scene || RecommendationScene.HOME,
        requestId: dto.requestId,
        position: dto.position,
        experimentId: dto.experimentId,
        groupItemId: dto.groupItemId,
      },
    );

    return {
      code: 200,
      message: 'success',
      data: { eventId },
    };
  }

  /**
   * 记录负反馈事件
   *
   * 当用户表示不喜欢推荐的菜品时调用
   */
  @Post('events/dislike')
  @HttpCode(HttpStatus.OK)
  async logDislikeEvent(@Body() dto: DislikeEventDto, @Request() req) {
    const userId = req.user.sub;
    const eventId = await this.recommendationService.logDislikeEvent(
      userId,
      dto.dishId,
      dto.reason || 'unknown',
      {
        scene: dto.scene || RecommendationScene.HOME,
        requestId: dto.requestId,
        position: dto.position,
        experimentId: dto.experimentId,
        groupItemId: dto.groupItemId,
      },
    );

    return {
      code: 200,
      message: 'success',
      data: { eventId },
    };
  }

  // ==================== 追踪查询接口 ====================

  /**
   * 获取推荐请求的事件链
   *
   * 用于分析特定推荐请求的完整用户行为路径
   */
  @Get('events/chain/:requestId')
  @HttpCode(HttpStatus.OK)
  async getEventChain(@Param('requestId') requestId: string) {
    const events = await this.eventLogger.getRequestEventChain(requestId);

    return {
      code: 200,
      message: 'success',
      data: {
        requestId,
        events: events.map((e) => ({
          eventId: e.eventId,
          eventType: e.eventType,
          dishId: e.dishId,
          position: e.position,
          timestamp: e.timestamp,
        })),
        eventCount: events.length,
      },
    };
  }

  /**
   * 获取用户行为漏斗数据
   */
  @Get('analytics/funnel')
  @HttpCode(HttpStatus.OK)
  async getUserFunnel(@Query('days') days: string, @Request() req) {
    const userId = req.user.sub;
    const parsedDays = days ? parseInt(days, 10) : 7;
    const funnel = await this.eventLogger.getUserFunnel(userId, parsedDays);

    return {
      code: 200,
      message: 'success',
      data: funnel,
    };
  }

  // ==================== A/B 测试接口 ====================

  /**
   * 获取用户当前的实验分组
   */
  @Get('experiment/:experimentId/group')
  @HttpCode(HttpStatus.OK)
  async getExperimentGroup(
    @Param('experimentId') experimentId: string,
    @Request() req,
  ) {
    const userId = req.user.sub;
    const group = await this.recommendationService.getExperimentGroup(
      userId,
      experimentId,
    );

    return {
      code: 200,
      message: 'success',
      data: group,
    };
  }

  // ==================== 系统状态接口 ====================

  /**
   * 获取推荐系统健康状态
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealthStatus() {
    const status = await this.recommendationService.getHealthStatus();

    return {
      code: 200,
      message: 'success',
      data: status,
    };
  }
}
