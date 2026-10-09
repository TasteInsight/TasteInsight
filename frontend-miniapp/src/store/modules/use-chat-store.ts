import { defineStore } from 'pinia';
import { ref, reactive, watch } from 'vue';
import { useUserStore } from './use-user-store';
import {
  createAISession,
  streamAIChat,
  submitRecommendFeedback,
  deleteAISession,
} from '@/api/modules/ai';
import { createMealPlan } from '@/api/modules/meal-plan';
import { USE_MOCK } from '../../mock/mock-adapter';
import type {
  ChatRequest,
  RecommendFeedbackRequest,
  ComponentDishCard,
  ComponentMealPlanDraft,
  ComponentPreferenceDraft,
  ComponentCanteenCard,
  ComponentWindowCard,
  UserProfileUpdateRequest,
} from '@/types/api';
import type { AIScene } from '@/types/api';

export type MealPlanCard = ComponentMealPlanDraft & { appliedStatus?: 'success' | 'failed' };
export type PreferenceDraftCard = ComponentPreferenceDraft & {
  status?: 'saving' | 'saved' | 'dismissed' | 'failed' | 'stale' | 'invalid';
  error?: string;
};
export type ChatDeliveryStatus = 'sending' | 'received' | 'failed' | 'unconfirmed';

const isRecord = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const sameValue = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        key => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key])
      )
    );
  }
  return left === right;
};

function isPreferenceUpdate(value: unknown): value is UserProfileUpdateRequest {
  if (
    !isRecord(value) ||
    !Object.keys(value).length ||
    Object.keys(value).some(key => key !== 'preferences' && key !== 'allergens')
  )
    return false;
  const isList = (list: unknown) =>
    Array.isArray(list) && list.every(item => typeof item === 'string' && item.trim().length > 0);
  if ('allergens' in value && !isList(value.allergens)) return false;
  if (!('preferences' in value)) return true;
  const preferences = value.preferences;
  if (!isRecord(preferences) || !Object.keys(preferences).length) return false;
  return Object.entries(preferences).every(([key, setting]) => {
    if (key === 'tagPreferences' || key === 'avoidIngredients') return isList(setting);
    if (key === 'priceRange') {
      return (
        isRecord(setting) &&
        Object.keys(setting).length === 2 &&
        typeof setting.min === 'number' &&
        Number.isFinite(setting.min) &&
        setting.min >= 0 &&
        typeof setting.max === 'number' &&
        Number.isFinite(setting.max) &&
        setting.max >= setting.min
      );
    }
    if (key === 'tastePreferences') {
      return (
        isRecord(setting) &&
        Object.keys(setting).length > 0 &&
        Object.entries(setting).every(
          ([taste, level]) =>
            ['spicyLevel', 'sweetness', 'saltiness', 'oiliness'].includes(taste) &&
            typeof level === 'number' &&
            Number.isInteger(level) &&
            level >= 0 &&
            level <= 5
        )
      );
    }
    return false;
  });
}

function preferenceValues(source: UserProfileUpdateRequest, touched: UserProfileUpdateRequest) {
  const values: Record<string, any> = {};
  if ('allergens' in touched) values.allergens = source.allergens;
  if (touched.preferences) {
    values.preferences = {};
    for (const [key, setting] of Object.entries(touched.preferences)) {
      const current = source.preferences?.[key as keyof typeof source.preferences];
      const fields = isRecord(current) ? (current as Record<string, unknown>) : {};
      values.preferences[key] = isRecord(setting)
        ? Object.fromEntries(Object.keys(setting).map(field => [field, fields[field]]))
        : current;
    }
  }
  return values;
}

function validPreferenceDraft(draft: PreferenceDraftCard): boolean {
  const before = draft.previewData?.before;
  const after = draft.previewData?.after;
  const action = draft.confirmAction;
  if (
    action?.api !== '/user/profile' ||
    action.method !== 'PUT' ||
    !isPreferenceUpdate(action.body) ||
    !isPreferenceUpdate(before) ||
    !isPreferenceUpdate(after)
  )
    return false;
  const keys = (update: UserProfileUpdateRequest) => ({
    root: Object.keys(update).sort(),
    preferences: Object.keys(update.preferences || {}).sort(),
  });
  return (
    sameValue(action.body, after) &&
    sameValue(keys(before), keys(after)) &&
    Object.entries(after.preferences || {}).every(([key, setting]) => {
      if (!isRecord(setting)) return true;
      const previous = before.preferences?.[key as keyof typeof before.preferences];
      return (
        isRecord(previous) &&
        Object.keys(setting).every(field => Object.prototype.hasOwnProperty.call(previous, field))
      );
    })
  );
}

// 消息段类型
export type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'card_dish'; data: ComponentDishCard[] }
  | { type: 'card_plan'; data: MealPlanCard[] }
  | { type: 'card_preferences'; data: PreferenceDraftCard[] }
  | { type: 'card_canteen'; data: ComponentCanteenCard[] }
  | { type: 'card_window'; data: ComponentWindowCard[] };

// 内部消息类型定义
export interface ChatMessage {
  id: number;
  type: 'user' | 'ai'; // 消息发送方
  content: MessageSegment[]; // 支持混排
  timestamp: number;
  deliveryStatus?: ChatDeliveryStatus;
  isStreaming?: boolean; // 是否正在流式接收中
  suggestions?: string[];
}

// 历史会话记录
export interface ChatHistoryEntry {
  sessionId: string;
  scene: AIScene;
  updatedAt: number;
  title?: string; // 可选标题（来自首条用户消息）
  messages: ChatMessage[];
}

type ChatStream = {
  sessionId: string;
  scene: AIScene;
  messages: ChatMessage[];
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
  close?: () => void;
};

// 转换为 Pinia Setup Store
export const useChatStore = defineStore('ai-chat', () => {
  const userStore = useUserStore();
  // === Constants ===
  // 最大历史记录条数：限制存储大小，避免本地存储过大影响性能
  const MAX_HISTORY_ENTRIES = 20;

  // === State (使用 ref 声明响应式状态) ===
  const messages = ref<ChatMessage[]>([]);
  const aiLoading = ref(false); // AI 正在回复
  const sessionId = ref<string>('');
  const historyEntries = ref<ChatHistoryEntry[]>([]);
  let activeStream: ChatStream | null = null;
  let historyOwner: string | null = null;
  let conversationVersion = 0;
  let sessionCreation: Promise<boolean> | null = null;
  let pendingSend: object | null = null;
  const pendingPlanApplications = new Set<string>();
  const pendingPreferenceApplications = new Set<string>();

  // === Actions (声明为普通函数) ===

  // 当前会话场景，默认为 general_chat
  const currentScene = ref<AIScene>('general_chat');
  const ALLOWED_SCENES = ['general_chat', 'meal_planner', 'dish_critic'] as const;

  function setScene(scene?: string | AIScene) {
    const s = (scene || 'general_chat') as string;
    if ((ALLOWED_SCENES as readonly string[]).includes(s)) {
      currentScene.value = s as AIScene;
    } else {
      currentScene.value = 'general_chat';
    }
  }

  function abortChat(showToast = true) {
    const stream = activeStream;
    activeStream = null;
    if (stream) {
      if (stream.userMessage.deliveryStatus === 'sending') {
        stream.userMessage.deliveryStatus = 'unconfirmed';
      }
      const wasStreaming = stream.aiMessage.isStreaming;
      stream.aiMessage.isStreaming = false;
      const lastSegment = stream.aiMessage.content[stream.aiMessage.content.length - 1];
      if (!showToast && wasStreaming && lastSegment?.type === 'text' && lastSegment.text.trim()) {
        lastSegment.text += '\n\n_[回复被中断]_';
      }
      upsertHistoryEntry(stream.sessionId, stream.scene, stream.messages);
      stream.close?.();
      if (showToast) {
        uni.showToast({
          title: '已停止生成',
          icon: 'none',
          duration: 1500,
        });
      }
    }

    aiLoading.value = false;
  }

  // === History helpers ===
  function persistHistory() {
    if (!historyOwner) return;
    try {
      uni.setStorageSync(`ai-chat-history:${historyOwner}`, historyEntries.value);
    } catch (e) {
      console.error('persistHistory failed', e);
    }
  }

  function loadHistoryFromStorage() {
    if (!historyOwner) return;
    try {
      const cached = uni.getStorageSync(`ai-chat-history:${historyOwner}`);
      if (cached && Array.isArray(cached)) {
        historyEntries.value = (cached as ChatHistoryEntry[]).map(entry => ({
          ...entry,
          messages: restoreMessages(entry.messages),
        }));
      }
    } catch (e) {
      console.error('loadHistoryFromStorage failed', e);
    }
  }

  function cloneMessages(msgs: ChatMessage[]) {
    return JSON.parse(JSON.stringify(msgs)) as ChatMessage[];
  }

  function restoreMessages(msgs: ChatMessage[]) {
    const restored = cloneMessages(msgs);
    for (const message of restored) {
      if (message.type === 'user' && message.deliveryStatus === 'sending') {
        message.deliveryStatus = 'unconfirmed';
      }
      for (const segment of message.content) {
        if (segment.type !== 'card_preferences') continue;
        for (const draft of segment.data) {
          if (draft.status === 'saving') {
            draft.status = 'failed';
            draft.error = '上次保存结果未确认，请重试检查最新偏好。';
          }
        }
      }
    }
    return restored;
  }

  function upsertHistoryEntry(session: string, scene: AIScene, msgs: ChatMessage[]) {
    if (!session) return;
    const copy = cloneMessages(msgs);
    const textSeg = copy.find(m => m.type === 'user')?.content?.find(seg => seg.type === 'text');
    const title = textSeg && textSeg.type === 'text' ? textSeg.text : '对话';
    const idx = historyEntries.value.findIndex(h => h.sessionId === session);
    const entry: ChatHistoryEntry = {
      sessionId: session,
      scene,
      updatedAt: Date.now(),
      title,
      messages: copy,
    };
    if (idx >= 0) {
      historyEntries.value[idx] = entry;
    } else {
      historyEntries.value.unshift(entry);
    }
    // 最多保留 MAX_HISTORY_ENTRIES 条
    historyEntries.value = historyEntries.value.slice(0, MAX_HISTORY_ENTRIES);
    persistHistory();
  }

  function loadSessionFromHistory(session: string) {
    const selected = historyEntries.value.find(h => h.sessionId === session);
    if (!selected) return false;
    abortChat(false);
    conversationVersion += 1;
    sessionCreation = null;
    pendingSend = null;
    const target = historyEntries.value.find(h => h.sessionId === session) || selected;
    messages.value = restoreMessages(target.messages);
    sessionId.value = target.sessionId;
    setScene(target.scene);
    return true;
  }

  async function applyMealPlan(plan: MealPlanCard): Promise<boolean> {
    const conversation = sessionId.value;
    const session = userStore.sessionVersion;
    const owner = historyOwner;
    const ownsAccount = () => session === userStore.sessionVersion && owner === historyOwner;
    // 消息和内容段只追加，卡片位置在历史记录的深拷贝中保持稳定。
    let position: { message: number; segment: number; card: number } | undefined;
    messages.value.some((message, messageIndex) =>
      message.content.some((segment, segmentIndex) => {
        if (segment.type !== 'card_plan') return false;
        const card = segment.data.indexOf(plan);
        if (card < 0) return false;
        position = { message: messageIndex, segment: segmentIndex, card };
        return true;
      })
    );
    if (!position || plan.appliedStatus === 'success') return false;

    const { message, segment, card } = position;
    const application = JSON.stringify([conversation, message, segment, card]);
    if (pendingPlanApplications.has(application)) return false;
    pendingPlanApplications.add(application);

    const recordStatus = (status: 'success' | 'failed') => {
      plan.appliedStatus = status;
      const updateCard = (target: ChatMessage[]) => {
        const block = target[message]?.content[segment];
        if (block?.type === 'card_plan' && block.data[card]) {
          block.data[card].appliedStatus = status;
        }
      };
      if (sessionId.value === conversation) {
        updateCard(messages.value);
        upsertHistoryEntry(conversation, currentScene.value, messages.value);
      } else {
        const entry = historyEntries.value.find(item => item.sessionId === conversation);
        if (entry) {
          updateCard(entry.messages);
          persistHistory();
        }
      }
    };

    try {
      const body = plan.confirmAction?.body;
      const { startDate, endDate, mealTime, dishes } = body || {};
      if (!startDate || !endDate || !mealTime || !Array.isArray(dishes) || dishes.length === 0) {
        throw new Error('后端未返回可直接应用的规划参数（confirmAction.body）');
      }
      await createMealPlan({ startDate, endDate, mealTime, dishes });
      if (!ownsAccount()) return false;
      recordStatus('success');
      try {
        uni.$emit('meal-plan:changed');
      } catch (error) {
        console.debug('uni.$emit not available:', error);
      }
      return true;
    } catch (error) {
      if (!ownsAccount()) return false;
      recordStatus('failed');
      throw error;
    } finally {
      if (ownsAccount()) pendingPlanApplications.delete(application);
    }
  }

  function locatePreferenceDraft(draft: PreferenceDraftCard) {
    if (
      !historyOwner ||
      !sessionId.value ||
      !userStore.isLoggedIn ||
      historyOwner !== userStore.userInfo?.id
    )
      return;
    for (let message = 0; message < messages.value.length; message++) {
      const content = messages.value[message].content;
      for (let segment = 0; segment < content.length; segment++) {
        const block = content[segment];
        if (block.type !== 'card_preferences') continue;
        const card = block.data.indexOf(draft);
        if (card < 0) continue;
        const conversation = sessionId.value;
        const owner = historyOwner;
        const accountSession = userStore.sessionVersion;
        const version = conversationVersion;
        const scene = currentScene.value;
        const ownsAccount = () =>
          owner === historyOwner && accountSession === userStore.sessionVersion;
        const recordStatus = (status: PreferenceDraftCard['status'], error?: string) => {
          if (!ownsAccount()) return;
          const updateCard = (target: ChatMessage[]) => {
            const stored = target[message]?.content[segment];
            if (stored?.type === 'card_preferences' && stored.data[card]) {
              stored.data[card].status = status;
              stored.data[card].error = error;
            }
          };
          draft.status = status;
          draft.error = error;
          if (sessionId.value === conversation) {
            updateCard(messages.value);
            upsertHistoryEntry(conversation, scene, messages.value);
          } else {
            const entry = historyEntries.value.find(item => item.sessionId === conversation);
            if (entry) {
              updateCard(entry.messages);
              persistHistory();
            }
          }
        };
        return {
          key: JSON.stringify([conversation, message, segment, card]),
          ownsAccount,
          ownsConversation: () =>
            ownsAccount() && sessionId.value === conversation && version === conversationVersion,
          recordStatus,
        };
      }
    }
  }

  async function applyPreferences(
    draft: PreferenceDraftCard,
    isOperationCurrent: () => boolean = () => true
  ): Promise<boolean> {
    const context = locatePreferenceDraft(draft);
    if (
      !context ||
      !isOperationCurrent() ||
      pendingPreferenceApplications.has(context.key) ||
      ['saving', 'saved', 'dismissed', 'stale', 'invalid'].includes(draft.status || '')
    )
      return false;
    if (!validPreferenceDraft(draft)) {
      context.recordStatus('invalid', '建议内容不完整或操作无效，请重新生成偏好建议。');
      return false;
    }
    if (pendingPreferenceApplications.size) {
      context.recordStatus('failed', '另一条偏好正在保存，请稍后重试。');
      return false;
    }
    pendingPreferenceApplications.add(context.key);
    context.recordStatus('saving');
    const body = JSON.parse(JSON.stringify(draft.confirmAction.body)) as UserProfileUpdateRequest;
    const ownsConfirmation = () => context.ownsConversation() && isOperationCurrent();
    try {
      await userStore.fetchProfileAction(ownsConfirmation);
      if (!ownsConfirmation()) {
        context.recordStatus('failed', '保存已取消，偏好未修改。');
        return false;
      }
      const current = preferenceValues(userStore.userInfo || {}, body);
      if (sameValue(current, preferenceValues(draft.previewData.after, body))) {
        context.recordStatus('saved');
        return true;
      }
      if (!sameValue(current, preferenceValues(draft.previewData.before, body))) {
        context.recordStatus('stale', '偏好已发生变化，请重新生成建议后再保存。');
        return false;
      }
      await userStore.updateProfileAction(body);
      if (!context.ownsAccount()) return false;
      context.recordStatus('saved');
      return true;
    } catch (error) {
      if (!context.ownsAccount()) return false;
      context.recordStatus(
        'failed',
        `保存失败，请重试。${error instanceof Error ? error.message : '请检查网络连接。'}`
      );
      return false;
    } finally {
      if (context.ownsAccount()) pendingPreferenceApplications.delete(context.key);
    }
  }

  function dismissPreferences(draft: PreferenceDraftCard): boolean {
    const context = locatePreferenceDraft(draft);
    if (
      !context ||
      pendingPreferenceApplications.has(context.key) ||
      ['saving', 'saved', 'dismissed'].includes(draft.status || '')
    )
      return false;
    context.recordStatus('dismissed');
    return true;
  }

  function clearConversation() {
    abortChat(false);
    conversationVersion += 1;
    sessionCreation = null;
    pendingSend = null;
    sessionId.value = '';
    messages.value = [];
  }

  /**
   * 初始化会话
   * @param scene 可选场景
   * @param force 是否强制重新初始化，即使 sessionId 已存在
   */
  async function initSession(scene?: string | AIScene, force = false) {
    if (force) clearConversation();
    if (sessionId.value) return true;
    if (sessionCreation) return sessionCreation;
    // validate scene param, prefer passed param if valid
    let sceneToUse = currentScene.value;
    if (scene && (ALLOWED_SCENES as readonly string[]).includes(String(scene))) {
      sceneToUse = scene as AIScene;
    }
    currentScene.value = sceneToUse;
    const version = conversationVersion;
    const ownerSession = userStore.sessionVersion;
    const pending = (async () => {
      try {
        const res = await createAISession({ scene: sceneToUse });
        if (version !== conversationVersion || ownerSession !== userStore.sessionVersion)
          return false;
        if (res.code === 200 && res.data) {
          sessionId.value = res.data.sessionId;
          if (res.data.welcomeMessage) {
            messages.value.push({
              id: Date.now() + Math.random(),
              type: 'ai',
              content: [{ type: 'text', text: res.data.welcomeMessage }],
              timestamp: Date.now(),
            });
            upsertHistoryEntry(sessionId.value, sceneToUse, messages.value);
          }
          return true;
        }
      } catch (e) {
        console.error('Failed to create AI session with scene:', sceneToUse, e);
      }
      return false;
    })().finally(() => {
      if (sessionCreation === pending) sessionCreation = null;
    });
    sessionCreation = pending;
    return pending;
  }

  /**
   * 添加用户消息到聊天记录
   * @param text 用户输入文本
   */
  function addUserMessage(text: string) {
    const newMessage = reactive<ChatMessage>({
      id: Date.now(),
      type: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    });
    messages.value.push(newMessage); // 访问 ref 值需要 .value
    return newMessage;
  }

  /**
   * 发送聊天消息并处理流式响应
   */
  async function sendChatMessage(text: string): Promise<boolean> {
    if (!text.trim() || aiLoading.value || pendingSend) return false;
    const version = conversationVersion;
    const ownerSession = userStore.sessionVersion;
    const submission = {};
    pendingSend = submission;
    try {
      if (!sessionId.value && !(await initSession())) return false;
      if (version !== conversationVersion || ownerSession !== userStore.sessionVersion)
        return false;
    } finally {
      if (pendingSend === submission) pendingSend = null;
    }
    abortChat(false);

    // 先在 UI 上显示用户消息。
    const userMessage = addUserMessage(text);
    userMessage.deliveryStatus = 'sending';

    aiLoading.value = true;

    // 3. 创建一个空的 AI 消息占位符
    const aiMessageId = Date.now() + 1;
    const aiMessage = reactive<ChatMessage>({
      id: aiMessageId,
      type: 'ai',
      content: [{ type: 'text', text: '' }], // 默认先给一个空文本块，防止渲染报错
      timestamp: Date.now(),
      isStreaming: true,
    });
    messages.value.push(aiMessage);
    const stream: ChatStream = {
      sessionId: sessionId.value,
      scene: currentScene.value,
      messages: messages.value,
      userMessage,
      aiMessage,
    };
    activeStream = stream;

    const pad2 = (n: number) => n.toString().padStart(2, '0');
    const pad3 = (n: number) => n.toString().padStart(3, '0');
    const formatLocalISOStringWithOffset = (d: Date) => {
      const year = d.getFullYear();
      const month = pad2(d.getMonth() + 1);
      const day = pad2(d.getDate());
      const hours = pad2(d.getHours());
      const minutes = pad2(d.getMinutes());
      const seconds = pad2(d.getSeconds());
      const millis = pad3(d.getMilliseconds());

      // getTimezoneOffset(): minutes behind UTC (e.g. China is -480)
      const tzOffsetMinutes = -d.getTimezoneOffset();
      const sign = tzOffsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(tzOffsetMinutes);
      const offH = pad2(Math.floor(abs / 60));
      const offM = pad2(abs % 60);

      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}${sign}${offH}:${offM}`;
    };

    const now = new Date();
    const payload: ChatRequest = {
      message: text,
      clientContext: {
        // 标准 ISO8601：本地时间 + 偏移（例如 2025-12-25T12:00:00.000+08:00）
        localTime: formatLocalISOStringWithOffset(now),
        tzOffsetMinutes: -now.getTimezoneOffset(),
        timeZone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined,
      },
    };

    let currentEvent = '';
    const appendText = (chunk: string) => {
      const lastSegment = aiMessage.content[aiMessage.content.length - 1];
      if (lastSegment?.type === 'text') lastSegment.text += chunk;
      else aiMessage.content.push({ type: 'text', text: chunk });
    };
    const finishStream = (unconfirmedStatus: 'failed' | 'unconfirmed' = 'unconfirmed') => {
      if (activeStream !== stream) return;
      if (userMessage.deliveryStatus === 'sending') {
        userMessage.deliveryStatus = unconfirmedStatus;
      }
      activeStream = null;
      aiLoading.value = false;
      aiMessage.isStreaming = false;
      upsertHistoryEntry(stream.sessionId, stream.scene, stream.messages);
    };
    const failStream = (err: any) => {
      if (activeStream !== stream) return;
      console.error('Stream error', err);
      if (aiMessage.isStreaming) appendText(`\n[网络请求出错: ${err?.message || '请检查网络'}]`);
      finishStream('failed');
    };

    let streamControl: { close: () => void };
    try {
      streamControl = USE_MOCK
        ? (() => {
            // 模拟流式回复。
            const mockResponse = `收到你的消息："${payload.message}"。这是一个模拟的流式回复。我可以帮你推荐菜品，或者制定饮食计划。`;
            const chunks = mockResponse.split('');
            let currentIndex = 0;
            const interval = setInterval(() => {
              if (activeStream !== stream) {
                clearInterval(interval);
                return;
              }
              if (currentIndex >= chunks.length) {
                clearInterval(interval);
                finishStream();
                return;
              }

              const chunkSize = Math.floor(Math.random() * 3) + 1;
              const chunkContent = chunks.slice(currentIndex, currentIndex + chunkSize).join('');
              currentIndex += chunkSize;

              appendText(chunkContent);
            }, 100);

            return {
              close: () => {
                clearInterval(interval);
              },
            };
          })()
        : streamAIChat(stream.sessionId, payload, {
            onEvent: (evt: string) => {
              if (activeStream !== stream) return;
              currentEvent = evt;
            },
            onMessage: (chunk: string) => {
              if (activeStream !== stream) return;
              if (currentEvent === 'text_chunk' && chunk) {
                userMessage.deliveryStatus = 'received';
                appendText(chunk);
              }
            },
            onJSON: json => {
              if (activeStream !== stream) return;

              if (
                currentEvent === 'message_received' &&
                typeof json?.messageId === 'string' &&
                json.messageId
              ) {
                userMessage.deliveryStatus = 'received';
              }
              if (
                currentEvent === 'reply_complete' &&
                typeof json?.messageId === 'string' &&
                json.messageId
              ) {
                aiMessage.isStreaming = false;
                aiLoading.value = false;
                upsertHistoryEntry(stream.sessionId, stream.scene, stream.messages);
              }
              if (
                currentEvent === 'suggestions' &&
                !aiMessage.isStreaming &&
                Array.isArray(json?.suggestions) &&
                json.suggestions.every((question: unknown) => typeof question === 'string')
              ) {
                aiMessage.suggestions = json.suggestions;
                upsertHistoryEntry(stream.sessionId, stream.scene, stream.messages);
              }
              if (currentEvent === 'new_block') {
                const segment = json as Exclude<MessageSegment, { type: 'text' }>;
                if (
                  segment &&
                  [
                    'card_dish',
                    'card_plan',
                    'card_preferences',
                    'card_canteen',
                    'card_window',
                  ].includes(segment.type) &&
                  Array.isArray(segment.data)
                ) {
                  userMessage.deliveryStatus = 'received';
                  if (segment.type === 'card_preferences') {
                    aiMessage.content.push({
                      type: 'card_preferences',
                      data: segment.data
                        .filter(isRecord)
                        .map(
                          ({ summary, previewData, confirmAction }) =>
                            ({ summary, previewData, confirmAction }) as PreferenceDraftCard
                        ),
                    });
                  } else aiMessage.content.push(segment);
                }
              }
            },
            onError: failStream,
            onComplete: finishStream,
          });
    } catch (error) {
      failStream(error);
      return false;
    }

    if (activeStream === stream) stream.close = streamControl.close;
    return true;
  }

  /**
   * 提交用户对推荐菜品的反馈
   */
  async function submitFeedback(feedback: RecommendFeedbackRequest) {
    try {
      const res = await submitRecommendFeedback(feedback);
      if (res.code === 200) {
        uni.showToast({ title: '反馈成功', icon: 'success' });
      } else {
        uni.showToast({ title: res.message || '反馈失败', icon: 'error' });
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      uni.showToast({ title: '提交反馈失败', icon: 'error' });
    }
  }

  /**
   * 启动新的会话 (重置)
   */
  async function startNewSession(scene?: string | AIScene) {
    clearConversation();
    // 如果传入了场景则先设置
    if (scene) setScene(scene);
    await initSession(scene);
  }

  /**
   * 删除会话（从历史记录和本地存储中移除）
   */
  async function removeSession(session: string) {
    try {
      const sceneToKeep = currentScene.value;
      const ownerSession = userStore.sessionVersion;

      // 调用后端接口删除会话
      await deleteAISession(session);
      if (ownerSession !== userStore.sessionVersion) return false;
      const isDeletingCurrentSession = sessionId.value === session;
      if (isDeletingCurrentSession) clearConversation();
      // 从本地历史记录中删除
      const idx = historyEntries.value.findIndex(h => h.sessionId === session);
      if (idx >= 0) {
        historyEntries.value.splice(idx, 1);
        persistHistory();
      }

      // 如果删除的是当前会话：自动创建一个新会话并切换过去
      if (isDeletingCurrentSession) {
        await initSession(sceneToKeep);
      }

      return true;
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }

  watch(
    [() => userStore.sessionVersion, () => (userStore.isLoggedIn ? userStore.userInfo?.id : null)],
    ([, owner]) => {
      pendingPlanApplications.clear();
      pendingPreferenceApplications.clear();
      clearConversation();
      historyOwner = owner || null;
      historyEntries.value = [];
      setScene('general_chat');
      loadHistoryFromStorage();
    },
    { immediate: true, flush: 'sync' }
  );

  return {
    messages,
    aiLoading,
    sessionId,
    currentScene,
    historyEntries,
    initSession,
    setScene,
    addUserMessage,
    sendChatMessage,
    submitFeedback,
    startNewSession,
    loadSessionFromHistory,
    applyMealPlan,
    applyPreferences,
    dismissPreferences,
    removeSession,
    abortChat,
  };
});
