import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { effectScope } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { createAISession, streamAIChat } from '@/api/modules/ai';
import { getUserProfile, updateUserProfile } from '@/api/modules/user';
import { useChat } from '@/pages/ai-chat/composables/use-chat';

jest.mock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
jest.mock('@/api/modules/meal-plan', () => ({ createMealPlan: jest.fn() }));
jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
  deleteAISession: jest.fn(),
  getAISuggestions: jest.fn(),
}));
jest.mock('@/api/modules/user', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  wechatLogin: jest.fn(),
}));

const storage = new Map<string, any>();
const profile = (id = 'A') => ({
  id,
  openId: id,
  nickname: id,
  preferences: {
    tagPreferences: ['清淡'],
    avoidIngredients: ['香菜'],
    priceRange: { min: 10, max: 40 },
    tastePreferences: { spicyLevel: 1, sweetness: 2, saltiness: 2, oiliness: 1 },
  },
  allergens: ['花生'],
});
const draft = () => {
  const before = {
    preferences: { tagPreferences: ['清淡'], avoidIngredients: ['香菜'] },
    allergens: ['花生'],
  };
  const after = {
    preferences: { tagPreferences: ['清淡', '高蛋白'], avoidIngredients: [] },
    allergens: ['花生', '虾'],
  };
  return {
    summary: '增加高蛋白偏好，清除香菜忌口，并记录虾过敏。',
    previewData: { before, after },
    confirmAction: { api: '/user/profile', method: 'PUT', body: JSON.parse(JSON.stringify(after)) },
  };
};
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
let callbacks: any;
const readCard = (messages: any[]) =>
  messages
    .flatMap(message => message.content)
    .filter(segment => segment.type === 'card_preferences')
    .flatMap(segment => segment.data)[0];
const storedCard = (owner = 'A') => readCard(storage.get(`ai-chat-history:${owner}`)[0].messages);

beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
  storage.set('token', 'A-token');
  storage.set('userInfo', JSON.stringify(profile()));
  (global as any).uni = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: any) =>
      storage.set(key, JSON.parse(JSON.stringify(value))),
    removeStorageSync: (key: string) => storage.delete(key),
    showToast: jest.fn(),
  };
  setActivePinia(createPinia());
  (createAISession as jest.Mock).mockResolvedValue({
    code: 200,
    data: { sessionId: 'conversation-A' },
  });
  (streamAIChat as jest.Mock).mockImplementation((_session, _request, hooks) => {
    callbacks = hooks;
    return { close: jest.fn() };
  });
  (getUserProfile as jest.Mock).mockResolvedValue({ code: 200, data: profile() });
  (updateUserProfile as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      ...profile(),
      ...draft().previewData.after,
      preferences: { ...profile().preferences, ...draft().previewData.after.preferences },
    },
  });
});

async function streamDraft(proposal: any = draft()) {
  const store = useChatStore();
  await store.sendChatMessage('请调整长期偏好');
  callbacks.onEvent('new_block');
  callbacks.onJSON({ type: 'card_preferences', data: [proposal] });
  callbacks.onComplete();
  return readCard(store.messages);
}

test('SSE and account-scoped history carry a proposal without saving or trusting model UI status', async () => {
  const store = useChatStore();
  const card = await streamDraft({ ...draft(), status: 'saved', error: 'model status' });
  expect(card).toMatchObject(draft());
  expect(card.status).toBeUndefined();
  expect(card.error).toBeUndefined();
  expect(updateUserProfile).not.toHaveBeenCalled();
  expect(getUserProfile).not.toHaveBeenCalled();
  expect(store.loadSessionFromHistory('conversation-A')).toBe(true);
  expect(readCard(store.messages)).toMatchObject(draft());
  expect(updateUserProfile).not.toHaveBeenCalled();
});

test('explicit save refreshes the touched values, saves the typed final payload and persists success', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  expect(await store.applyPreferences(card)).toBe(true);
  expect(getUserProfile).toHaveBeenCalledTimes(1);
  expect(updateUserProfile).toHaveBeenCalledWith(draft().confirmAction.body);
  expect(card.status).toBe('saved');
  expect(useUserStore().userInfo?.allergens).toEqual(['花生', '虾']);
  expect(storedCard().status).toBe('saved');
  store.loadSessionFromHistory('conversation-A');
  const restored = readCard(store.messages);
  expect(restored.status).toBe('saved');
  expect(await store.applyPreferences(restored)).toBe(false);
  expect(updateUserProfile).toHaveBeenCalledTimes(1);
});

test('dismissal is local and stays closed after account-scoped cache restoration', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  expect(store.dismissPreferences(card)).toBe(true);
  expect(card.status).toBe('dismissed');
  expect(storedCard().status).toBe('dismissed');
  store.loadSessionFromHistory('conversation-A');
  expect(readCard(store.messages).status).toBe('dismissed');
  expect(await store.applyPreferences(readCard(store.messages))).toBe(false);
  expect(updateUserProfile).not.toHaveBeenCalled();
  expect(getUserProfile).not.toHaveBeenCalled();
});

test('double clicks, dismissal during saving and a copied pending card cannot duplicate a save', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  const pendingRead = deferred();
  (getUserProfile as jest.Mock).mockReturnValueOnce(pendingRead.promise);
  const save = store.applyPreferences(card);
  expect(card.status).toBe('saving');
  expect(await store.applyPreferences(card)).toBe(false);
  expect(store.dismissPreferences(card)).toBe(false);
  store.loadSessionFromHistory('conversation-A');
  expect(await store.applyPreferences(readCard(store.messages))).toBe(false);
  pendingRead.resolve({ code: 200, data: profile() });
  expect(await save).toBe(false);
  expect(updateUserProfile).not.toHaveBeenCalled();
});

test('a backend error is not success; the original final-value draft remains retryable', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  (updateUserProfile as jest.Mock).mockResolvedValueOnce({ code: 400, message: '过敏原格式无效' });
  expect(await store.applyPreferences(card)).toBe(false);
  expect(card.status).toBe('failed');
  expect(card.error).toContain('过敏原格式无效');
  expect(card.confirmAction.body).toEqual(draft().confirmAction.body);
  expect(storedCard().status).toBe('failed');
  expect(await store.applyPreferences(card)).toBe(true);
  expect(updateUserProfile).toHaveBeenCalledTimes(2);
});

test('retry after a lost response recognizes already-applied values without a second PUT', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  (updateUserProfile as jest.Mock).mockRejectedValueOnce(new Error('响应丢失'));
  expect(await store.applyPreferences(card)).toBe(false);
  const applied = {
    ...profile(),
    ...draft().previewData.after,
    preferences: { ...profile().preferences, ...draft().previewData.after.preferences },
  };
  (getUserProfile as jest.Mock).mockResolvedValueOnce({ code: 200, data: applied });
  expect(await store.applyPreferences(card)).toBe(true);
  expect(card.status).toBe('saved');
  expect(updateUserProfile).toHaveBeenCalledTimes(1);
});

test('partial taste changes compare only changed dimensions and preserve the exact partial payload', async () => {
  const store = useChatStore();
  const proposal = {
    summary: '降低辣度',
    previewData: {
      before: { preferences: { tastePreferences: profile().preferences.tastePreferences } },
      after: { preferences: { tastePreferences: { spicyLevel: 0 } } },
    },
    confirmAction: {
      api: '/user/profile',
      method: 'PUT',
      body: { preferences: { tastePreferences: { spicyLevel: 0 } } },
    },
  };
  const card = await streamDraft(proposal);
  const latest = profile();
  latest.preferences.tastePreferences.sweetness = 5;
  (getUserProfile as jest.Mock).mockResolvedValueOnce({ code: 200, data: latest });
  expect(await store.applyPreferences(card)).toBe(true);
  expect(updateUserProfile).toHaveBeenCalledWith(proposal.confirmAction.body);
});

test.each(['saved', 'dismissed', 'saving'])(
  'a cached %s status is restored safely after a fresh store instance',
  async status => {
    const store = useChatStore();
    const card = await streamDraft();
    if (status === 'saved') await store.applyPreferences(card);
    else if (status === 'dismissed') store.dismissPreferences(card);
    else {
      const entries = storage.get('ai-chat-history:A');
      readCard(entries[0].messages).status = 'saving';
    }
    setActivePinia(createPinia());
    const restored = useChatStore();
    restored.loadSessionFromHistory('conversation-A');
    const restoredCard = readCard(restored.messages);
    expect(restoredCard.status).toBe(status === 'saving' ? 'failed' : status);
    if (status === 'saving') expect(restoredCard.error).toContain('未确认');
    else expect(await restored.applyPreferences(restoredCard)).toBe(false);
  }
);

test('an unsuccessful fresh profile read never falls back to cached values for a write', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  (getUserProfile as jest.Mock).mockResolvedValueOnce({ code: 500, message: '最新资料读取失败' });
  expect(await store.applyPreferences(card)).toBe(false);
  expect(card.status).toBe('failed');
  expect(card.error).toContain('最新资料读取失败');
  expect(updateUserProfile).not.toHaveBeenCalled();
});

test('divergent touched values reject an old proposal without overwriting newer settings', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  const latest = profile();
  latest.preferences.tagPreferences = ['低糖'];
  (getUserProfile as jest.Mock).mockResolvedValueOnce({ code: 200, data: latest });
  expect(await store.applyPreferences(card)).toBe(false);
  expect(card.status).toBe('stale');
  expect(card.error).toContain('重新生成');
  expect(useUserStore().userInfo?.preferences?.tagPreferences).toEqual(['低糖']);
  expect(updateUserProfile).not.toHaveBeenCalled();
});

test('unrelated settings changes and reordered lists do not invalidate a proposal', async () => {
  const store = useChatStore();
  const proposal = draft();
  proposal.previewData.before.allergens = ['花生', '牛奶'];
  const card = await streamDraft(proposal);
  const latest = { ...profile(), nickname: '新昵称', allergens: ['牛奶', '花生'] };
  latest.preferences.priceRange = { min: 8, max: 35 };
  (getUserProfile as jest.Mock).mockResolvedValueOnce({ code: 200, data: latest });
  expect(await store.applyPreferences(card)).toBe(true);
});

test.each([
  (proposal: any) => {
    proposal.confirmAction.api = 'https://other.test/user/profile';
  },
  (proposal: any) => {
    proposal.confirmAction.method = 'DELETE';
  },
  (proposal: any) => {
    proposal.confirmAction.body.nickname = 'hidden change';
  },
  (proposal: any) => {
    proposal.confirmAction.body.preferences.portionSize = 'large';
  },
  (proposal: any) => {
    proposal.confirmAction.body.allergens = ['hidden allergen'];
  },
  (proposal: any) => {
    delete proposal.previewData.before.allergens;
  },
  (proposal: any) => {
    proposal.previewData.after.preferences.avoidIngredients = 'bad array';
  },
])('an invalid or undisclosed action never executes a request', async mutate => {
  const store = useChatStore();
  const proposal = draft();
  mutate(proposal);
  const card = await streamDraft(proposal);
  expect(await store.applyPreferences(card)).toBe(false);
  expect(card.status).toBe('invalid');
  expect(card.error).toContain('重新生成');
  expect(updateUserProfile).not.toHaveBeenCalled();
  expect(getUserProfile).not.toHaveBeenCalled();
});

test.each(['account', 'conversation', 'disposal'])(
  'a %s ownership change during refresh cancels the PUT',
  async change => {
    const store = useChatStore();
    const card = await streamDraft();
    const pendingRead = deferred();
    (getUserProfile as jest.Mock).mockReturnValueOnce(pendingRead.promise);
    let isCurrent = true;
    const save = store.applyPreferences(card, () => isCurrent);
    if (change === 'account') {
      const userStore = useUserStore();
      userStore.logoutAction();
      userStore.updateTokens(userStore.sessionVersion, 'B-token');
      userStore.userInfo = profile('B') as any;
    } else if (change === 'conversation') await store.startNewSession();
    else isCurrent = false;
    pendingRead.resolve({ code: 200, data: profile() });
    expect(await save).toBe(false);
    expect(updateUserProfile).not.toHaveBeenCalled();
    if (change === 'account') expect(useUserStore().userInfo?.id).toBe('B');
  }
);

test('disposing the real chat composable during profile refresh cancels its confirmation', async () => {
  const card = await streamDraft();
  const scope = effectScope();
  const chat = scope.run(() => useChat())!;
  const pendingRead = deferred();
  (getUserProfile as jest.Mock).mockReturnValueOnce(pendingRead.promise);
  const pending = chat.applyPreferences(card);
  scope.stop();
  pendingRead.resolve({ code: 200, data: profile() });
  expect(await pending).toBe(false);
  expect(card.status).toBe('failed');
  expect(updateUserProfile).not.toHaveBeenCalled();
});

test('a successful issued write is recorded in its source conversation after navigation', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  const pendingWrite = deferred();
  (updateUserProfile as jest.Mock).mockReturnValueOnce(pendingWrite.promise);
  const save = store.applyPreferences(card);
  await flushPromises();
  (createAISession as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { sessionId: 'conversation-next' },
  });
  await store.startNewSession();
  pendingWrite.resolve({ code: 200, data: profile() });
  expect(await save).toBe(true);
  expect(store.sessionId).toBe('conversation-next');
  expect(store.messages).toHaveLength(0);
  store.loadSessionFromHistory('conversation-A');
  expect(readCard(store.messages).status).toBe('saved');
});

test('an old account write cannot mark a new account card saved or replace its profile', async () => {
  const store = useChatStore();
  const card = await streamDraft();
  const pendingWrite = deferred();
  (updateUserProfile as jest.Mock).mockReturnValueOnce(pendingWrite.promise);
  const save = store.applyPreferences(card);
  await flushPromises();
  const userStore = useUserStore();
  userStore.logoutAction();
  userStore.updateTokens(userStore.sessionVersion, 'B-token');
  userStore.userInfo = profile('B') as any;
  pendingWrite.resolve({ code: 200, data: profile() });
  expect(await save).toBe(false);
  expect(userStore.userInfo?.id).toBe('B');
  expect(storage.get('ai-chat-history:B')).toBeUndefined();
  expect(card.status).not.toBe('saved');
});
