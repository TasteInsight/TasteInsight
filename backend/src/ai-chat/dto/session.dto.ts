import { IsOptional, IsIn, IsString } from 'class-validator';

// DTOs for AI chat session management

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @IsIn(['general_chat', 'meal_planner', 'dish_critic'], {
    message: 'scene must be one of: general_chat, meal_planner, dish_critic',
  })
  scene?: 'general_chat' | 'meal_planner' | 'dish_critic';
}

export class SessionData {
  sessionId: string;
  welcomeMessage: string;
}
