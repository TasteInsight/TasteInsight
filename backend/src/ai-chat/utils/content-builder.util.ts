// Utility functions for building content segments from tool results

import {
  ContentSegment,
  ComponentDishCard,
  ComponentCanteenCard,
  ComponentMealPlanDraft,
} from '../dto/chat.dto';

export class ContentBuilder {
  /**
   * Create a text segment
   */
  static text(content: string): ContentSegment {
    return {
      type: 'text',
      data: content,
    };
  }

  /**
   * Create dish card segment
   */
  static dishCards(cards: ComponentDishCard[]): ContentSegment {
    return {
      type: 'card_dish',
      data: cards,
    };
  }

  /**
   * Create canteen card segment
   */
  static canteenCards(cards: ComponentCanteenCard[]): ContentSegment {
    return {
      type: 'card_canteen',
      data: cards,
    };
  }

  /**
   * Create meal plan card segment
   */
  static mealPlanCards(cards: ComponentMealPlanDraft[]): ContentSegment {
    return {
      type: 'card_plan',
      data: cards,
    };
  }

  /**
   * Combine multiple segments
   */
  static combine(...segments: ContentSegment[]): ContentSegment[] {
    return segments;
  }
}
