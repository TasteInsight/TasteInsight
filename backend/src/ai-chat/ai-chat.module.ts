import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { AIChatController } from './ai-chat.controller';
import { AIChatService } from './ai-chat.service';
import { AIConfigService } from './services/ai-config.service';
import { OpenAIProviderService } from './services/ai-provider/openai-provider.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { DishRecommendationTool } from './tools/dish-recommendation.tool';
import { DishSearchTool } from './tools/dish-search.tool';
import { CanteenInfoTool } from './tools/canteen-info.tool';
import { PopularDishesTool } from './tools/popular-dishes.tool';
import { MyFavoritesTool } from './tools/my-favorites.tool';
import { MyHistoryTool } from './tools/my-history.tool';
import { ContentDisplayTool } from './tools/content-display.tool';
import { DishReviewsTool } from './tools/dish-reviews.tool';
import { UpdatePreferencesTool } from './tools/update-preferences.tool';

// Import required services from other modules
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { DishesModule } from '@/dishes/dishes.module';
import { CanteensModule } from '@/canteens/canteens.module';
import { UserProfileModule } from '@/user-profile/user-profile.module';
import { ReviewsModule } from '@/reviews/reviews.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RecommendationModule,
    DishesModule,
    CanteensModule,
    UserProfileModule,
    ReviewsModule,
  ],
  controllers: [AIChatController],
  providers: [
    PrismaService,
    AIChatService,
    AIConfigService,
    OpenAIProviderService,
    ToolRegistryService,
    DishRecommendationTool,
    DishSearchTool,
    CanteenInfoTool,
    PopularDishesTool,
    MyFavoritesTool,
    MyHistoryTool,
    ContentDisplayTool,
    DishReviewsTool,
    UpdatePreferencesTool,
  ],
  exports: [AIChatService],
})
export class AIChatModule {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly dishRecommendationTool: DishRecommendationTool,
    private readonly dishSearchTool: DishSearchTool,
    private readonly canteenInfoTool: CanteenInfoTool,
    private readonly popularDishesTool: PopularDishesTool,
    private readonly myFavoritesTool: MyFavoritesTool,
    private readonly myHistoryTool: MyHistoryTool,
    private readonly contentDisplayTool: ContentDisplayTool,
    private readonly dishReviewsTool: DishReviewsTool,
    private readonly updatePreferencesTool: UpdatePreferencesTool,
  ) {
    // Register all tools on module initialization
    this.toolRegistry.registerTool(this.dishRecommendationTool);
    this.toolRegistry.registerTool(this.dishSearchTool);
    this.toolRegistry.registerTool(this.canteenInfoTool);
    this.toolRegistry.registerTool(this.popularDishesTool);
    this.toolRegistry.registerTool(this.myFavoritesTool);
    this.toolRegistry.registerTool(this.myHistoryTool);
    this.toolRegistry.registerTool(this.contentDisplayTool);
    this.toolRegistry.registerTool(this.dishReviewsTool);
    this.toolRegistry.registerTool(this.updatePreferencesTool);
  }
}
