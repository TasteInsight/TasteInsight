// Base interface for AI providers

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null; // Can be null when tool_calls are present (OpenAI API behavior)
  name?: string; // For tool responses
  tool_call_id?: string; // For tool responses
  tool_calls?: ToolCall[]; // For assistant messages with tool calls
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export interface BaseAIProvider {
  /**
   * Stream chat completion with tool calling support
   * @param messages Conversation history
   * @param tools Available tools for the AI to call
   * @returns Async generator yielding stream chunks
   */
  streamChat(
    messages: AIMessage[],
    tools: Tool[],
  ): AsyncGenerator<StreamChunk, void, unknown>;
}
