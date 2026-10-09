import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { Tool } from '../services/ai-provider/base-ai-provider.interface';
import Ajv, { ValidateFunction } from 'ajv';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly validator = new Ajv({
    allErrors: true,
    strict: false,
    strictNumbers: true,
  });
  private readonly tools = new Map<
    string,
    { tool: BaseTool; definition: ToolDefinition; validate: ValidateFunction }
  >();

  /**
   * Register a tool
   */
  registerTool(tool: BaseTool): void {
    const original = tool.getDefinition();
    const definition = {
      ...original,
      parameters: { additionalProperties: false, ...original.parameters },
    };
    this.tools.set(definition.name, {
      tool,
      definition,
      validate: this.validator.compile(definition.parameters),
    });
    this.logger.log(`Registered tool: ${definition.name}`);
  }

  /**
   * Get all registered tools as Tool definitions for AI provider
   */
  getAllTools(scene?: string): Tool[] {
    const tools: Tool[] = [];
    for (const { definition: def } of this.tools.values()) {
      if (
        scene &&
        def.scenes &&
        !def.scenes.some((allowed) => allowed === scene)
      ) {
        continue;
      }
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
    const registered = this.tools.get(name);
    if (!registered) {
      throw new Error(`工具未找到: ${name}`);
    }
    const { tool, definition, validate } = registered;
    if (
      definition.scenes &&
      !definition.scenes.some((scene) => scene === context.scene)
    ) {
      throw new Error(`当前对话场景不可使用工具: ${name}`);
    }
    if (!validate(params)) {
      throw new Error(
        `工具参数无效: ${this.validator.errorsText(validate.errors, { dataVar: '参数' })}`,
      );
    }

    try {
      this.logger.log(`Executing tool: ${name}`);
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
