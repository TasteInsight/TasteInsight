import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  BaseAIProvider,
  AIProviderConfig,
  AIMessage,
  Tool,
  StreamChunk,
} from './base-ai-provider.interface';

@Injectable()
export class OpenAIProviderService implements BaseAIProvider {
  private readonly logger = new Logger(OpenAIProviderService.name);
  private client: OpenAI | null = null;
  private config: AIProviderConfig | null = null;

  setConfig(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async *streamChat(
    messages: AIMessage[],
    tools: Tool[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.client || !this.config) {
      yield {
        type: 'error',
        error: 'AI provider not configured',
      };
      return;
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools:
          tools.length > 0
            ? (tools as OpenAI.Chat.ChatCompletionTool[])
            : undefined,
        stream: true,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (!delta) continue;

        // Handle text content
        if (delta.content) {
          yield {
            type: 'text',
            content: delta.content,
          };
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.function?.name) {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: toolCall.id || '',
                  type: 'function',
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments || '',
                  },
                },
              };
            }
          }
        }

        // Check if done
        if (chunk.choices[0]?.finish_reason) {
          yield { type: 'done' };
        }
      }

      yield { type: 'done' };
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      yield {
        type: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Failed to communicate with AI provider',
      };
    }
  }
}
