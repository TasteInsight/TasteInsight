import { BaseResponseDto } from '@/common/dto/response.dto';
import { SessionData } from './session.dto';
import { ChatMessageItemDto } from './chat.dto';

// Session creation response
export class SessionCreateResponseDto extends BaseResponseDto<SessionData> {}

// Suggestions response
export class SuggestionData {
  suggestions: string[];
}

export class SuggestionResponseDto extends BaseResponseDto<SuggestionData> {}

// History response
export class HistoryData {
  messages: ChatMessageItemDto[];
  cursor?: string;
}

export class HistoryResponseDto extends BaseResponseDto<HistoryData> {}
