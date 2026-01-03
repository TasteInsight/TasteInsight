import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Sse,
  MessageEvent,
  Delete,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AIChatService } from './ai-chat.service';
import { CreateSessionDto } from './dto/session.dto';
import { ChatRequestDto } from './dto/chat.dto';
import {
  SessionCreateResponseDto,
  SuggestionResponseDto,
  HistoryResponseDto,
} from './dto/response.dto';

@Controller('ai')
@UseGuards(AuthGuard)
export class AIChatController {
  constructor(private readonly aiChatService: AIChatService) {}

  /**
   * Create a new chat session
   * POST /ai/sessions
   */
  @Post('sessions')
  async createSession(
    @Req() req: any,
    @Body() dto: CreateSessionDto,
  ): Promise<SessionCreateResponseDto> {
    const userId = req.user.sub;
    const data = await this.aiChatService.createSession(userId, dto);

    return {
      code: 200,
      message: 'success',
      data,
    };
  }

  /**
   * Stream chat with SSE
   * POST /ai/sessions/:sessionId/chat/stream
   */
  @Post('sessions/:sessionId/chat/stream')
  @Sse()
  streamChat(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: ChatRequestDto,
  ): Observable<MessageEvent> {
    const userId = req.user.sub;
    return this.aiChatService.streamChat(userId, sessionId, dto);
  }

  /**
   * Get conversation suggestions
   * GET /ai/suggestions
   */
  @Get('suggestions')
  async getSuggestions(
    @Req() req: any,
    @Query('localTime') localTime?: string,
    @Query('timeZone') timeZone?: string,
    @Query('tzOffsetMinutes') tzOffsetMinutes?: string,
  ): Promise<SuggestionResponseDto> {
    const userId = req.user.sub;
    const suggestions = await this.aiChatService.getSuggestions(userId, {
      localTime,
      timeZone,
      tzOffsetMinutes:
        tzOffsetMinutes && !isNaN(parseInt(tzOffsetMinutes))
          ? parseInt(tzOffsetMinutes)
          : undefined,
    });

    return {
      code: 200,
      message: 'success',
      data: { suggestions },
    };
  }

  /**
   * Delete a chat session
   * DELETE /ai/sessions/:sessionId
   */
  @Delete('sessions/:sessionId')
  async deleteSession(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
  ): Promise<any> {
    const userId = req.user.sub;
    await this.aiChatService.deleteSession(userId, sessionId);

    return {
      code: 200,
      message: 'success',
    };
  }

  /**
   * Get chat history
   * GET /ai/sessions/:sessionId/history
   */
  @Get('sessions/:sessionId/history')
  async getHistory(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Query('cursor') cursor?: string,
  ): Promise<HistoryResponseDto> {
    const userId = req.user.sub;
    const data = await this.aiChatService.getHistory(userId, sessionId, cursor);

    return {
      code: 200,
      message: 'success',
      data,
    };
  }
}
