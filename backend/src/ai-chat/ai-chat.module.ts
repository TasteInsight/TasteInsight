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
import { MealPlanningTool } from './tools/meal-planning.tool';

// Import required services from other modules
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { DishesModule } from '@/dishes/dishes.module';
import { CanteensModule } from '@/canteens/canteens.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RecommendationModule,
    DishesModule,
    CanteensModule,
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
    MealPlanningTool,
  ],
  exports: [AIChatService],
})
export class AIChatModule {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly dishRecommendationTool: DishRecommendationTool,
    private readonly dishSearchTool: DishSearchTool,
    private readonly canteenInfoTool: CanteenInfoTool,
    private readonly mealPlanningTool: MealPlanningTool,
  ) {
    // Register all tools on module initialization
    this.toolRegistry.registerTool(this.dishRecommendationTool);
    this.toolRegistry.registerTool(this.dishSearchTool);
    this.toolRegistry.registerTool(this.canteenInfoTool);
    this.toolRegistry.registerTool(this.mealPlanningTool);
  }
}
