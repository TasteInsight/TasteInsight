import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { AIConfigService } from './services/ai-config.service';
import { PromptSecurityService } from './services/prompt-security.service';
import { OpenAIProviderService } from './services/ai-provider/openai-provider.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { PromptBuilder } from './utils/prompt-builder.util';
import { ContentBuilder } from './utils/content-builder.util';
import { CreateSessionDto, SessionData } from './dto/session.dto';
import {
  ChatRequestDto,
  ChatMessageItemDto,
  ContentSegment,
} from './dto/chat.dto';
import {
  AIMessage,
  StreamChunk,
} from './services/ai-provider/base-ai-provider.interface';

@Injectable()
export class AIChatService {
  private readonly logger = new Logger(AIChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AIConfigService,
    private readonly promptSecurity: PromptSecurityService,
    private readonly openaiProvider: OpenAIProviderService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    dto: CreateSessionDto,
  ): Promise<SessionData> {
    const scene = dto.scene || 'general_chat';

    const session = await this.prisma.aISession.create({
      data: {
        userId,
        scene,
      },
    });

    return {
      sessionId: session.id,
      welcomeMessage: PromptBuilder.getWelcomeMessage(scene),
    };
  }

  /**
   * Stream chat response with SSE
   */
  streamChat(
    userId: string,
    sessionId: string,
    dto: ChatRequestDto,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      this.handleStreamChat(userId, sessionId, dto, subscriber).catch(
        (error) => {
          this.logger.error('Stream chat error:', error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : 'Unknown error';
          subscriber.next({
            type: 'error',
            data: { error: errorMessage },
          });
          subscriber.complete();
        },
      );
    });
  }

  private async handleStreamChat(
    userId: string,
    sessionId: string,
    dto: ChatRequestDto,
    subscriber: any,
  ): Promise<void> {
    // Verify session exists and belongs to user
    const session = await this.prisma.aISession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Validate user input for security
    const inputValidation = this.promptSecurity.validateUserInput(dto.message);
    if (!inputValidation.isValid) {
      this.logger.warn(`User input rejected: ${inputValidation.reason}`, {
        userId,
        sessionId,
      });
      throw new BadRequestException(
        inputValidation.reason || '输入内容不符合安全要求',
      );
    }

    // Use sanitized message
    const sanitizedMessage = inputValidation.sanitized;

    // Save user message
    await this.prisma.aIMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: [ContentBuilder.text(sanitizedMessage)] as any,
      },
    });

    // Get time for chat: format using client's wall-clock time when provided
    const chatTime = this.getChatTime(dto.clientContext);

    // Build initial conversation history with enhanced security prompt
    const basePrompt = PromptBuilder.getSystemPrompt(session.scene, chatTime);
    const securePrompt = this.promptSecurity.enhanceSystemPrompt(basePrompt);

    const conversationMessages: AIMessage[] = [
      {
        role: 'system',
        content: securePrompt,
      },
    ];

    // Add previous messages
    for (const msg of session.messages) {
      const content = msg.content;
      const textContent = this.extractTextFromContent(content);
      conversationMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: textContent,
      });
    }

    // Add current user message (sanitized)
    conversationMessages.push({
      role: 'user',
      content: sanitizedMessage,
    });

    // Get AI provider config and tools
    const config = await this.aiConfig.getProviderConfig();
    this.openaiProvider.setConfig(config);
    const tools = this.toolRegistry.getAllTools();

    // Content to save
    const assistantContent: ContentSegment[] = [];
    let finalTextContent = '';

    try {
      // Multi-turn conversation loop for tool calling
      const maxTurns = 10; // Prevent infinite loops
      let turn = 0;

      while (turn < maxTurns) {
        turn++;
        this.logger.debug(`AI conversation turn ${turn}`);

        let currentText = '';
        const pendingToolCalls: Map<string, any> = new Map();
        let hasToolCalls = false;

        // Stream AI response
        for await (const chunk of this.openaiProvider.streamChat(
          conversationMessages,
          tools,
        )) {
          if (chunk.type === 'text' && chunk.content) {
            currentText += chunk.content;
            finalTextContent += chunk.content;
            // Filter AI response for sensitive information
            const filteredContent = this.promptSecurity.filterAIResponse(
              chunk.content,
            );
            // Send text chunk to client
            subscriber.next({
              type: 'text_chunk',
              data: filteredContent,
            });
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            hasToolCalls = true;
            const toolCall = chunk.toolCall;
            if (!pendingToolCalls.has(toolCall.id)) {
              pendingToolCalls.set(toolCall.id, {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: '',
              });
            }
            const pending = pendingToolCalls.get(toolCall.id);
            pending.arguments += toolCall.function.arguments;
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error || 'AI provider error');
          }
        }

        // If no tool calls, conversation is complete
        if (!hasToolCalls || pendingToolCalls.size === 0) {
          this.logger.debug('No tool calls, ending conversation');
          break;
        }

        // Execute tool calls and prepare results for next turn
        const toolCallsForHistory: any[] = [];
        const toolResultsForHistory: AIMessage[] = [];
        let allToolsSucceeded = true;

        for (const [id, toolCall] of pendingToolCalls.entries()) {
          toolCallsForHistory.push({
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
          });

          try {
            // Validate and parse arguments
            let params: any;

            // Handle null, undefined, empty or whitespace-only arguments
            // Safely convert to string and trim
            const argsStr =
              toolCall.arguments != null &&
              typeof toolCall.arguments === 'string'
                ? toolCall.arguments.trim()
                : '';

            if (argsStr === '' || argsStr === '{}') {
              // Empty arguments are valid (means no parameters)
              params = {};
            } else {
              try {
                params = JSON.parse(argsStr);
              } catch (parseError) {
                const errorMsg = `Error: Invalid JSON arguments for tool ${toolCall.name}: ${toolCall.arguments}`;
                this.logger.warn(errorMsg, parseError);
                toolResultsForHistory.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: errorMsg,
                } as any);
                allToolsSucceeded = false;
                continue;
              }
            }

            // Validate tool parameters for security
            const paramValidation = this.promptSecurity.validateToolParams(
              toolCall.name,
              params,
            );
            if (!paramValidation.isValid) {
              const errorMsg = `Error: Invalid tool parameters for ${toolCall.name}: ${paramValidation.reason}`;
              this.logger.warn(errorMsg, { params });
              toolResultsForHistory.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: errorMsg,
              } as any);
              allToolsSucceeded = false;
              continue;
            }

            // Execute tool
            const result = await this.toolRegistry.executeTool(
              toolCall.name,
              params,
              { userId, sessionId, localTime: dto.clientContext?.localTime },
            );

            // Convert result to content segment and send to client
            const segment = this.toolResultToSegment(
              toolCall.name,
              result,
              params,
            );
            if (segment) {
              assistantContent.push(segment);
              subscriber.next({
                type: 'new_block',
                data: segment,
              });
            }

            // Add success result to conversation
            toolResultsForHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            } as any);
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'Unknown error';
            const errorMsg = `Error executing tool ${toolCall.name}: ${errorMessage}`;
            this.logger.error(errorMsg, error);

            // Add error result to conversation for AI to handle
            toolResultsForHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorMsg,
            } as any);
            allToolsSucceeded = false;
          }
        }

        // Add assistant message with tool calls to conversation history
        conversationMessages.push({
          role: 'assistant',
          content: currentText || null,
          tool_calls: toolCallsForHistory,
        });

        // Add all tool results to conversation history
        conversationMessages.push(...toolResultsForHistory);

        // Continue to next turn so AI can use tool results to generate response
        // The loop will naturally end when AI stops calling tools
        this.logger.debug(
          `Tool execution completed. ${allToolsSucceeded ? 'All succeeded' : 'Some failed'}. Continuing to turn ${turn + 1}`,
        );
      }

      // Add final text content if any (before components)
      if (finalTextContent) {
        assistantContent.unshift(ContentBuilder.text(finalTextContent));
      }

      // Add warning message at the end if max turns reached
      if (turn >= maxTurns) {
        this.logger.warn(
          `Reached maximum turns (${maxTurns}), ending conversation`,
        );
        const warningMsg =
          '抱歉，处理您的请求时遇到了一些困难。请尝试重新表述您的需求。';
        subscriber.next({
          type: 'text_chunk',
          data: warningMsg,
        });
        // Add warning message at the end of content array
        assistantContent.push(ContentBuilder.text(warningMsg));
      }

      // Save assistant message
      await this.prisma.aIMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: assistantContent as any,
        },
      });

      // Stream complete - no explicit stop event needed
      // Frontend handles completion via onComplete callback
      subscriber.complete();
    } catch (error) {
      this.logger.error('Stream processing error:', error);
      throw error;
    }
  }

  /**
   * Get chat history
   */
  async getHistory(
    userId: string,
    sessionId: string,
    cursor?: string,
  ): Promise<{ messages: ChatMessageItemDto[]; cursor?: string }> {
    // Verify session belongs to user
    const session = await this.prisma.aISession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const pageSize = 50;
    const messages = await this.prisma.aIMessage.findMany({
      where: {
        sessionId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
    });

    const hasMore = messages.length > pageSize;
    const items = messages.slice(0, pageSize);

    return {
      messages: items.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.createdAt.toISOString(),
        content: msg.content as ContentSegment[],
      })),
      cursor: hasMore
        ? items[items.length - 1].createdAt.toISOString()
        : undefined,
    };
  }

  /**
   * Get conversation suggestions based on time and user profile
   */
  async getSuggestions(userId: string): Promise<string[]> {
    const hour = new Date().getHours();
    let mealTime = 'lunch';

    if (hour >= 6 && hour < 10) {
      mealTime = 'breakfast';
    } else if (hour >= 10 && hour < 14) {
      mealTime = 'lunch';
    } else if (hour >= 17 && hour < 20) {
      mealTime = 'dinner';
    } else if (hour >= 20 || hour < 6) {
      mealTime = 'nightsnack';
    }

    const suggestions = [
      `推荐一些${this.getMealTimeName(mealTime)}`,
      '看看全校最火的菜',
      '帮我生成下周食谱',
    ];

    // Add canteen-specific suggestion
    const canteens = await this.prisma.canteen.findMany({ take: 3 });
    if (canteens.length > 0) {
      const randomCanteen =
        canteens[Math.floor(Math.random() * canteens.length)];
      suggestions.push(`${randomCanteen.name}有什么好吃的？`);
    }

    return suggestions;
  }

  private getMealTimeName(mealTime: string): string {
    const names = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐',
      nightsnack: '夜宵',
    };
    return names[mealTime] || '美食';
  }

  /**
   * Get time for chat context, preferring client's localTime if valid, otherwise use server time
   * @param clientContext Client context (localTime may include timezone offset)
   * @returns Date object
   */
  private getChatTime(clientContext?: ChatRequestDto['clientContext']): Date {
    const serverTime = new Date();

    const clientLocalTime = clientContext?.localTime;

    // If no client time provided, use server time
    if (!clientLocalTime) {
      return serverTime;
    }

    // Prefer using the client's wall-clock parts to avoid server timezone skew when formatting.
    // Accept both ISO8601 with offset/Z and without timezone.
    const m = clientLocalTime.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
    );
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const hours = Number(m[4]);
      const minutes = Number(m[5]);
      const seconds = m[6] != null ? Number(m[6]) : 0;
      const millis = m[7] != null ? Number(m[7].padEnd(3, '0').slice(0, 3)) : 0;

      // Basic range validation to avoid odd Date overflows
      if (
        year >= 1970 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31 &&
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59 &&
        seconds >= 0 &&
        seconds <= 59 &&
        millis >= 0 &&
        millis <= 999
      ) {
        return new Date(year, month - 1, day, hours, minutes, seconds, millis);
      }
    }

    // Try to parse as ISOString
    const clientTime = new Date(clientLocalTime);

    // Validate the parsed date is valid
    if (isNaN(clientTime.getTime())) {
      // Invalid format, use server time
      this.logger.warn(
        `Invalid localTime format (expected ISOString): ${clientLocalTime}, using server time`,
      );
      return serverTime;
    }

    return clientTime;
  }

  private extractTextFromContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    return content
      .filter((seg) => seg.type === 'text')
      .map((seg) => seg.data)
      .join('\n');
  }

  private toolResultToSegment(
    toolName: string,
    result: any,
    params?: any,
  ): ContentSegment | null {
    if (toolName === 'display_content' && params?.type) {
      const type = params.type;
      if (type === 'dish') {
        return ContentBuilder.dishCards(result);
      } else if (type === 'canteen') {
        return ContentBuilder.canteenCards(result);
      } else if (type === 'meal_plan') {
        return ContentBuilder.mealPlanCards(result);
      }
    }
    // All other tools return raw data only,
    // which should not be directly displayed as cards.
    // The AI must explicitly call 'display_content' to show them.
    return null;
  }
}
