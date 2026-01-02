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
      throw new Error('AI provider not configured');
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

      let isDone = false;
      const toolCallIds = new Map<number, string>(); // Track tool call IDs by index across chunks

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
            // In streaming, index is consistent for the same tool call across chunks
            const index = toolCall.index;

            // If this chunk has an ID, it's the start of a tool call (or creating the mapping)
            // We store it to use for subsequent chunks of the same tool call
            if (toolCall.id) {
              toolCallIds.set(index, toolCall.id);
            }

            const id = toolCallIds.get(index);

            // Only yield if we have identified the tool call ID
            // And if there is something meaningful to yield (name or arguments)
            if (
              id &&
              (toolCall.function?.name || toolCall.function?.arguments)
            ) {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: id,
                  type: 'function',
                  function: {
                    name: toolCall.function.name || '',
                    arguments: toolCall.function.arguments || '',
                  },
                },
              };
            }
          }
        }

        // Check if done (only yield once)
        if (!isDone && chunk.choices[0]?.finish_reason) {
          yield { type: 'done' };
          isDone = true;
        }
      }

      // Fallback: yield 'done' if stream completed without finish_reason
      if (!isDone) {
        yield { type: 'done' };
      }
    } catch (error) {
      // Log detailed error for debugging
      this.logger.error('OpenAI API error:', {
        message: error instanceof Error ? error.message : String(error),
        model: this.config?.model,
        baseUrl: this.config?.baseUrl,
      });

      // Provide user-friendly error messages without exposing technical details
      // Messages should sound natural and not imply system errors
      let userMessage = '抱歉，我现在无法处理您的请求，请稍后再试。';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        // Map technical errors to natural user messages
        if (
          errorMsg.includes('model not exist') ||
          errorMsg.includes('model_not_found')
        ) {
          userMessage = '抱歉，我现在无法处理您的请求，请稍后再试。';
        } else if (
          errorMsg.includes('401') ||
          errorMsg.includes('unauthorized')
        ) {
          userMessage = '抱歉，我现在无法处理您的请求，请稍后再试。';
        } else if (
          errorMsg.includes('429') ||
          errorMsg.includes('rate_limit')
        ) {
          userMessage = '抱歉，当前请求过于频繁，请稍后再试。';
        } else if (
          errorMsg.includes('timeout') ||
          errorMsg.includes('network')
        ) {
          userMessage = '抱歉，响应时间过长，请稍后再试。';
        }
      }

      yield {
        type: 'error',
        error: userMessage,
      };
    }
  }
}
