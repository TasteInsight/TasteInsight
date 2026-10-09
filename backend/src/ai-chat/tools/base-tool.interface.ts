// Base interface for AI tools

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  scenes?: Array<'general_chat' | 'meal_planner' | 'dish_critic'>;
}

export interface ToolContext {
  userId: string;
  sessionId: string;
  localTime?: string;
  scene?: string;
}

export interface BaseTool {
  /**
   * Get the tool definition for AI provider
   */
  getDefinition(): ToolDefinition;

  /**
   * Execute the tool with given parameters
   * @param params Tool parameters (validated against schema)
   * @param context Execution context (user, session, etc.)
   * @returns Tool execution result
   */
  execute(params: any, context: ToolContext): Promise<any>;
}
