import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { Tool } from '../services/ai-provider/base-ai-provider.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private tools: Map<string, BaseTool> = new Map();

  /**
   * Register a tool
   */
  registerTool(tool: BaseTool): void {
    const definition = tool.getDefinition();
    this.tools.set(definition.name, tool);
    this.logger.log(`Registered tool: ${definition.name}`);
  }

  /**
   * Get all registered tools as Tool definitions for AI provider
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const tool of this.tools.values()) {
      const def = tool.getDefinition();
      tools.push({
        type: 'function',
        function: {
          name: def.name,
          description: def.description,
          parameters: def.parameters,
        },
      });
    }
    return tools;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    name: string,
    params: any,
    context: ToolContext,
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`工具未找到: ${name}`);
    }

    try {
      this.logger.log(`Executing tool: ${name}`, { params, context });
      const result = await tool.execute(params, context);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${name}`, error);
      throw error;
    }
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}
