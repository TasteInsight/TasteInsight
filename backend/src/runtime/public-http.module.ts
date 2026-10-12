import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { PublicAuthController } from '@/auth/public-auth.controller';
import { IdentityController } from '@/auth/identity.controller';
import { CampusIdentityController } from '@/campus-identity/campus-identity.controller';
import { DishesModule } from '@/dishes/dishes.module';
import { CanteensModule } from '@/canteens/canteens.module';
import { ReviewsModule } from '@/reviews/reviews.module';
import { CommentsModule } from '@/comments/comments.module';
import { NewsModule } from '@/news/news.module';
import { MealPlansModule } from '@/meal-plans/meal-plans.module';
import { UserProfileModule } from '@/user-profile/user-profile.module';
import { UserProfileController } from '@/user-profile/user-profile.controller';
import { SocialModule } from '@/social/social.module';
import { SocialController } from '@/social/social.controller';
import { NotificationsModule } from '@/notifications/notifications.module';
import { NotificationsController } from '@/notifications/notifications.controller';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { RecommendationController } from '@/recommendation/recommendation.controller';
import { AIChatModule } from '@/ai-chat/ai-chat.module';
import { UploadModule } from '@/upload/upload.module';
import { PublicUploadController } from '@/upload/upload.controller';

@Module({
  imports: [
    AuthModule,
    DishesModule,
    CanteensModule,
    ReviewsModule,
    CommentsModule,
    NewsModule,
    MealPlansModule,
    UserProfileModule,
    SocialModule,
    NotificationsModule,
    RecommendationModule,
    AIChatModule,
  ],
  controllers: [
    IdentityController,
    CampusIdentityController,
    UserProfileController,
    SocialController,
    NotificationsController,
    RecommendationController,
  ],
})
export class PublicFeaturesHttpModule {}

@Module({
  imports: [PublicFeaturesHttpModule, AuthModule, UploadModule],
  controllers: [PublicAuthController, PublicUploadController],
})
export class PublicHttpModule {}
