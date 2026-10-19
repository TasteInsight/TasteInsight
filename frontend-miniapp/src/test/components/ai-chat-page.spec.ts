jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn() }));
import { mount, shallowMount, flushPromises } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import ChatPage from '@/pages/ai-chat/index.vue';
import InputBar from '@/pages/ai-chat/components/InputBar.vue';
import SuggestionChips from '@/pages/ai-chat/components/SuggestionChips.vue';
import { useChat } from '@/pages/ai-chat/composables/use-chat';

jest.mock('@/pages/ai-chat/composables/use-chat', () => ({ useChat: jest.fn() }));
let chat: any;
let wrapper: any;
const button = (name: string) =>
  wrapper
    .findAll('button')
    .find(
      (node: any) =>
        node.text() === name ||
        node.attributes('aria-label') ===
          (({ 发送: '发送消息', 停止: '停止回复' } as any)[name] || name)
    )!;
const input = async (text: string) =>
  wrapper.findComponent(InputBar).get('textarea').setValue(text);

beforeEach(() => {
  jest.useFakeTimers();
  chat = {
    isLoggedIn: ref(true),
    messages: ref<any[]>([]),
    currentSessionId: ref('s1'),
    aiLoading: ref(false),
    suggestions: ref([]),
    isInitializing: ref(false),
    isInitialLoading: ref(false),
    initialError: ref(''),
    scene: ref('meal_planner'),
    historyEntries: ref([]),
    sendMessage: jest.fn().mockResolvedValue(true),
    captureOperation: () => () => true,
    resetChat: jest.fn(),
    setScene: jest.fn(),
    init: jest.fn(),
    loadHistorySession: jest.fn(),
    applyMealPlan: jest.fn(),
    deleteSession: jest.fn(),
    stopStreaming: jest.fn(),
  };
  (useChat as jest.Mock).mockReturnValue(chat);
  (global as any).uni.getSystemInfoSync = () => ({ safeAreaInsets: { top: 0, bottom: 0 } });
  (global as any).uni.showModal = jest.fn();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  jest.clearAllTimers();
  jest.useRealTimers();
});
const render = () =>
  (wrapper = shallowMount(ChatPage, {
    global: { stubs: { InputBar: false, 'page-container': true, picker: true } },
  }));

test('one native back container closes either chat overlay while preserving the draft', async () => {
  render();
  await input('尚未发送的草稿');
  expect(wrapper.findAll('page-container-stub')).toHaveLength(1);
  const nativeBack = wrapper.get('page-container-stub');
  for (const [action, label] of [
    ['历史', '历史对话'],
    ['新对话', '开始新对话'],
  ]) {
    await button(action).trigger('click');
    expect(nativeBack.attributes('show')).toBe('true');
    expect(wrapper.find(`[role="dialog"][aria-label="${label}"]`).exists()).toBe(true);
    await nativeBack.trigger('leave');
    expect(nativeBack.attributes('show')).toBe('false');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('尚未发送的草稿');
  }
  expect(chat.resetChat).not.toHaveBeenCalled();
  expect(chat.loadHistorySession).not.toHaveBeenCalled();
});

test.each(['历史', '新对话'])(
  'session expiry clears the private draft and %s overlay before another login',
  async action => {
    render();
    await input('账号 A 的未发送草稿');
    await button(action).trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    chat.isLoggedIn.value = false;
    await nextTick();
    expect(wrapper.findComponent(InputBar).exists()).toBe(false);
    chat.isLoggedIn.value = true;
    chat.currentSessionId.value = 'account-b-session';
    await nextTick();
    expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.get('page-container-stub').attributes('show')).toBe('false');
  }
);

test('composer is a sibling after the message scroll during initialization and retry state', async () => {
  chat.isInitialLoading.value = true;
  render();
  expect(wrapper.findComponent(InputBar).exists()).toBe(true);
  expect(wrapper.find('.ai-chat-messages').findComponent(InputBar).exists()).toBe(false);
  chat.isInitialLoading.value = false;
  chat.initialError.value = '连接失败';
  await nextTick();
  expect(wrapper.text()).toContain('连接失败');
  await button('重试连接').trigger('click');
  expect(chat.init).toHaveBeenCalled();
  expect(wrapper.findComponent(InputBar).exists()).toBe(true);
});

test('user timestamp follows its message while AI text has no separate timestamp and no invented delivery mark', () => {
  chat.messages.value = [
    { id: 1, type: 'user', content: [{ type: 'text', text: '清淡一点' }], timestamp: Date.now() },
    {
      id: 2,
      type: 'ai',
      content: [{ type: 'text', text: '可以看看这两道菜' }],
      timestamp: Date.now(),
    },
  ];
  render();
  const messages = wrapper.findAll('.chat-message');
  expect(messages[0].find('.chat-message-meta').exists()).toBe(true);
  expect(messages[1].find('.chat-message-meta').exists()).toBe(false);
  expect(messages[0].element.lastElementChild.classList.contains('chat-message-meta')).toBe(true);
  expect(wrapper.findAll('.chat-timestamp')).toHaveLength(1);
  expect(wrapper.text()).not.toContain('✓');
  expect(messages[0].find('.chat-delivery-status').exists()).toBe(false);
});

test('dish results share one group and planning drafts stay separate from chat text', () => {
  const dishes = [
    { dish: { id: 'a', name: '清蒸鲈鱼', rating: '4.2', tags: [] } },
    { dish: { id: 'b', name: '番茄炒蛋', rating: '0', tags: [] } },
  ];
  chat.messages.value = [
    {
      id: 1,
      type: 'ai',
      timestamp: Date.now(),
      content: [
        { type: 'text', text: '可以看看这两道菜' },
        { type: 'card_dish', data: dishes },
        { type: 'card_plan', data: [{ summary: '午餐建议' }] },
        { type: 'text', text: '可以展开查看后确认' },
      ],
    },
  ];
  render();
  const group = wrapper.get('[role="group"][aria-label="推荐菜品"]');
  expect(wrapper.findAll('[role="group"][aria-label="推荐菜品"]')).toHaveLength(1);
  expect(group.findAll('.chat-dish-row')).toHaveLength(2);
  expect(group.findAll('dish-card-stub')).toHaveLength(2);
  expect(wrapper.get('.chat-card-stack-plans').findAll('planning-card-stub')).toHaveLength(1);
  expect(wrapper.findAll('.chat-bubble')).toHaveLength(2);
  expect(
    wrapper.findAll('.chat-bubble dish-card-stub, .chat-bubble planning-card-stub')
  ).toHaveLength(0);
});

test.each(['card_dish', 'card_plan', 'card_canteen', 'card_window'])(
  'an empty %s result does not render a segment between visible text',
  type => {
    chat.messages.value = [
      {
        id: 1,
        type: 'ai',
        timestamp: Date.now(),
        content: [
          { type: 'text', text: '前一段说明' },
          { type: 'text', text: '  ' },
          { type, data: [] },
          { type: 'text', text: '后一段说明' },
        ],
      },
    ];
    render();
    expect(wrapper.findAll('.chat-segment')).toHaveLength(2);
    expect(wrapper.find('[role="group"][aria-label="推荐菜品"]').exists()).toBe(false);
  }
);

test.each([
  ['sending', '发送中', '/static/icons/history.png', ''],
  ['received', '服务端已接收', '/static/icons/check-double.png', ''],
  ['failed', '发送异常，接收未确认', '/static/icons/alert.png', '发送异常，接收未确认'],
  ['unconfirmed', '接收未确认', undefined, '接收未确认'],
])(
  'user delivery %s renders only its explicit protocol status',
  (deliveryStatus, label, icon, visibleText) => {
    chat.messages.value = [
      {
        id: 1,
        type: 'user',
        content: [{ type: 'text', text: '午餐' }],
        timestamp: Date.now(),
        deliveryStatus,
      },
      { id: 2, type: 'ai', content: [{ type: 'text', text: '建议' }], timestamp: Date.now() },
    ];
    chat.aiLoading.value = deliveryStatus === 'received';
    render();
    const status = wrapper.get('.chat-delivery-status');
    expect(status.attributes('aria-label')).toBe(label);
    if (icon) expect(status.get('image, img').attributes('src')).toBe(icon);
    else expect(status.find('image, img').exists()).toBe(false);
    if (visibleText) expect(status.text()).toBe(visibleText);
    expect(wrapper.text()).not.toContain('已读');
    expect(wrapper.findAll('.chat-delivery-status')).toHaveLength(1);
  }
);

test('rejected send preserves draft, accepted snapshot clears, and newer draft survives pending acceptance', async () => {
  render();
  await input('未发送的内容');
  chat.sendMessage.mockResolvedValueOnce(false);
  await button('发送').trigger('click');
  await flushPromises();
  expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('未发送的内容');
  let accept!: (value: boolean) => void;
  chat.sendMessage.mockReturnValueOnce(
    new Promise(resolve => {
      accept = resolve;
    })
  );
  await button('发送').trigger('click');
  await input('新草稿');
  accept(true);
  await flushPromises();
  expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('新草稿');
  await button('发送').trigger('click');
  await flushPromises();
  expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('');
});

test('streaming keeps draft editable and stop usable without duplicate send', async () => {
  chat.aiLoading.value = true;
  render();
  await input('下一条问题');
  expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('下一条问题');
  await button('停止').trigger('click');
  expect(chat.stopStreaming).toHaveBeenCalledTimes(1);
  expect(chat.sendMessage).not.toHaveBeenCalled();
});

test('suggested questions belong to the transcript and stay available while composing', async () => {
  chat.suggestions.value = ['清淡午餐'];
  render();
  const suggestions = wrapper.get('.ai-chat-messages').get('suggestion-chips-stub');
  expect(wrapper.get('.ai-chat-footer').find('suggestion-chips-stub').exists()).toBe(false);
  await wrapper.findComponent(InputBar).get('textarea').trigger('focus');
  expect(suggestions.exists()).toBe(true);
  wrapper.getComponent(SuggestionChips).vm.$emit('select', '清淡午餐');
  await flushPromises();
  expect(chat.sendMessage).toHaveBeenCalledWith('清淡午餐');
});

test('late suggested questions follow the latest reply into view', async () => {
  render();
  chat.suggestions.value = ['清淡午餐'];
  await flushPromises();
  jest.advanceTimersByTime(20);
  await nextTick();
  expect(wrapper.get('.ai-chat-messages').attributes('scroll-into-view')).toBe(
    'chat-bottom-anchor'
  );
});

test('layout-driven scroll changes do not opt out of following the latest answer', async () => {
  render();
  wrapper
    .get('.ai-chat-messages')
    .element.dispatchEvent(
      new CustomEvent('scroll', { detail: { scrollTop: 50, scrollHeight: 1000, deltaY: 80 } })
    );
  await nextTick();
  const latest = wrapper.get('button[aria-label="回到最新"]');
  expect(latest.attributes('aria-hidden')).toBe('true');
  expect(latest.attributes('tabindex')).toBe('-1');
  expect(latest.attributes('disabled')).toBeDefined();
});

test.each(['wheel', 'touch', 'keyboard', 'scrollbar'])(
  'intentional %s reading stops auto-follow until return-to-latest is selected',
  async gesture => {
    chat.messages.value = [
      {
        id: 1,
        type: 'ai',
        content: [{ type: 'text', text: '回复' }],
        timestamp: Date.now(),
        isStreaming: true,
      },
    ];
    render();
    wrapper
      .get('.ai-chat-messages')
      .element.dispatchEvent(
        new CustomEvent('scroll', { detail: { scrollTop: 50, scrollHeight: 1000, deltaY: 50 } })
      );
    await nextTick();
    const scroll = wrapper.get('.ai-chat-messages');
    if (gesture === 'wheel') await scroll.trigger('wheel', { deltaY: -50 });
    else if (gesture === 'touch') {
      await scroll.trigger('touchstart', { touches: [{ clientY: 100 }] });
      await scroll.trigger('touchmove', { touches: [{ clientY: 160 }] });
    } else if (gesture === 'scrollbar') {
      scroll.element.scrollTop = 50;
      await scroll.trigger('mousedown', { button: 0 });
    } else await scroll.trigger('keydown', { key: 'PageUp' });
    chat.messages.value[0].content[0].text += '继续回复';
    await nextTick();
    jest.advanceTimersByTime(500);
    await nextTick();
    expect(wrapper.get('.ai-chat-messages').attributes('scroll-into-view') || '').toBe('');
    const latest = button('回到最新');
    expect(latest.text()).toBe('');
    expect(latest.attributes('aria-hidden')).toBe('false');
    expect(latest.attributes('disabled')).toBeUndefined();
    await button('回到最新').trigger('click');
    await nextTick();
    jest.advanceTimersByTime(20);
    await nextTick();
    expect(wrapper.get('.ai-chat-messages').attributes('scroll-into-view')).toBe(
      'chat-bottom-anchor'
    );
    expect(latest.attributes('aria-hidden')).toBe('true');
    expect(latest.attributes('disabled')).toBeDefined();
  }
);

test.each(['wheel', 'scrollbar'])(
  '%s reading pauses auto-follow after guest login and after logging in again',
  async gesture => {
    chat.isLoggedIn.value = false;
    render();
    expect(wrapper.find('.ai-chat-messages').exists()).toBe(false);
    for (const session of ['first-login', 'second-login']) {
      chat.isLoggedIn.value = true;
      chat.currentSessionId.value = session;
      chat.messages.value = [
        {
          id: session,
          type: 'ai',
          content: [{ type: 'text', text: '回复内容' }],
          timestamp: Date.now(),
        },
      ];
      await nextTick();
      const scroll = wrapper.get('.ai-chat-messages');
      scroll.element.dispatchEvent(new CustomEvent('scroll', { detail: { scrollTop: 50 } }));
      await nextTick();
      if (gesture === 'wheel') await scroll.trigger('wheel', { deltaY: -50 });
      else {
        scroll.element.scrollTop = 50;
        await scroll.trigger('mousedown', { button: 0 });
      }
      chat.messages.value[0].content[0].text += '继续回复';
      await nextTick();
      jest.advanceTimersByTime(500);
      await nextTick();
      expect(button('回到最新').attributes('aria-hidden')).toBe('false');
      expect(scroll.attributes('scroll-into-view') || '').toBe('');
      await button('回到最新').trigger('click');
      await nextTick();
      jest.advanceTimersByTime(20);
      await nextTick();
      expect(scroll.attributes('scroll-into-view')).toBe('chat-bottom-anchor');
      chat.isLoggedIn.value = false;
      chat.currentSessionId.value = '';
      await nextTick();
      expect(wrapper.find('.ai-chat-messages').exists()).toBe(false);
    }
  }
);

test('history deletion names its conversation and cancellation performs no deletion', async () => {
  chat.historyEntries.value = [
    { sessionId: 'old', title: '周末午餐', scene: 'meal_planner', updatedAt: Date.now() },
  ];
  render();
  await button('历史').trigger('click');
  await wrapper.get('button[aria-label="删除对话：周末午餐"]').trigger('click');
  const options = (uni.showModal as jest.Mock).mock.calls[0][0];
  expect(options.content).toContain('周末午餐');
  options.success({ confirm: false, cancel: true });
  expect(chat.deleteSession).not.toHaveBeenCalled();
  options.success({ confirm: true, cancel: false });
  expect(chat.deleteSession).toHaveBeenCalledWith('old', expect.any(Function));
});

test('history identifies the current conversation and keeps the marker reactive', async () => {
  chat.historyEntries.value = [
    { sessionId: 's1', title: '今天午餐', scene: 'meal_planner', updatedAt: Date.now() },
    { sessionId: 'older', title: '周末午餐', scene: 'general_chat', updatedAt: Date.now() },
  ];
  render();
  await button('历史').trigger('click');
  expect(wrapper.get('button[aria-label="打开对话：今天午餐"]').attributes('aria-current')).toBe(
    'true'
  );
  expect(
    wrapper.get('button[aria-label="打开对话：周末午餐"]').attributes('aria-current')
  ).toBeUndefined();
  chat.currentSessionId.value = 'older';
  await nextTick();
  expect(wrapper.get('button[aria-label="打开对话：周末午餐"]').attributes('aria-current')).toBe(
    'true'
  );
  expect(
    wrapper.get('button[aria-label="打开对话：今天午餐"]').attributes('aria-current')
  ).toBeUndefined();
});

test('new-conversation selection is explicit and cancellation preserves the composer draft', async () => {
  render();
  await input('还没有发送的午餐问题');
  await button('新对话').trigger('click');
  await button('菜品点评').trigger('click');
  expect(wrapper.get('.chat-scene-option[aria-pressed="true"]').text()).toBe('菜品点评');
  expect(
    wrapper.get('.chat-scene-option[aria-pressed="true"]').find('.chat-scene-check').exists()
  ).toBe(true);
  await button('取消').trigger('click');
  expect(wrapper.find('[role="dialog"][aria-label="开始新对话"]').exists()).toBe(false);
  expect(chat.resetChat).not.toHaveBeenCalled();
  expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('还没有发送的午餐问题');
  await button('新对话').trigger('click');
  expect(wrapper.get('.chat-scene-option[aria-pressed="true"]').text()).toBe('餐单规划');
  await button('菜品点评').trigger('click');
  await button('开始对话').trigger('click');
  expect(chat.resetChat).toHaveBeenCalledWith('dish_critic');
});

test('input action supports normalized repeated keydown with a single keyup activation', async () => {
  wrapper = mount(InputBar, { props: { modelValue: '午餐', loading: false } });
  const control = wrapper.get('button');
  await control.trigger('keydown', { key: 'Enter', code: 'Enter' });
  await control.trigger('keydown', { key: 'Enter', code: 'Enter' });
  expect(wrapper.emitted('send')).toBeUndefined();
  await control.trigger('keyup', { key: 'Enter', code: 'Enter' });
  expect(wrapper.emitted('send')).toEqual([['午餐']]);
});

test('composer is an explicitly named 2000-character textarea and preserves multiline and IME input', async () => {
  wrapper = mount(InputBar, { props: { modelValue: '想吃什么', loading: false } });
  const field = wrapper.get('textarea');
  expect(field.attributes('aria-label')).toBe('消息输入');
  expect(field.attributes('maxlength')).toBe('2000');
  await field.trigger('keydown', { key: 'Enter', shiftKey: true });
  await field.trigger('keyup', { key: 'Enter', shiftKey: true });
  expect(wrapper.emitted('send')).toBeUndefined();
  await field.trigger('compositionstart');
  await field.trigger('keydown', { key: 'Enter', isComposing: true });
  await field.trigger('compositionend');
  await field.trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('send')).toBeUndefined();
  await field.trigger('keydown', { key: 'Enter' });
  await field.trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('send')).toEqual([['想吃什么']]);
});

test('public uni linechange grows the native composer only up to four lines and resets to its minimum', async () => {
  wrapper = mount(InputBar, { props: { modelValue: '', loading: false } });
  (wrapper.vm as any).isH5 = false;
  wrapper.vm.$forceUpdate();
  await nextTick();
  const field = wrapper.get('.chat-input-native');
  expect(field.attributes('auto-height')).toBe('false');
  expect(field.attributes('style')).toContain('height: 44px');
  field.element.dispatchEvent(new CustomEvent('linechange', { detail: { lineCount: 3 } }));
  await nextTick();
  expect(field.attributes('style')).toContain('height: 88px');
  field.element.dispatchEvent(new CustomEvent('linechange', { detail: { lineCount: 6 } }));
  await nextTick();
  expect(field.attributes('style')).toContain('height: 110px');
  field.element.dispatchEvent(new CustomEvent('linechange', { detail: { lineCount: 1 } }));
  await nextTick();
  expect(field.attributes('style')).toContain('height: 44px');
});

test('the H5 composer grows for multiline input, caps its height and resets after clearing', async () => {
  wrapper = mount(InputBar, { props: { modelValue: '', loading: false } });
  const field = wrapper.get('textarea');
  expect(field.attributes('style')).toContain('height: 44px');
  let contentHeight = 88;
  Object.defineProperty(field.element, 'scrollHeight', {
    configurable: true,
    get: () => contentHeight,
  });
  await field.setValue('第一行\n第二行\n第三行');
  expect(field.attributes('style')).toContain('height: 88px');
  contentHeight = 200;
  await field.setValue('第一行\n第二行\n第三行\n第四行\n第五行');
  expect(field.attributes('style')).toContain('height: 110px');
  contentHeight = 44;
  await wrapper.setProps({ modelValue: '一行文字' });
  await nextTick();
  expect(field.attributes('style')).toContain('height: 44px');
  await wrapper.setProps({ modelValue: '' });
  await nextTick();
  expect(field.attributes('style')).toContain('height: 44px');
  expect(wrapper.emitted('send')).toBeUndefined();
});

test.each([
  ['failed', '回复失败，请稍后重试'],
  ['stopped', '已停止回复'],
  ['interrupted', '回复已中断'],
])('renders the %s outcome separately from AI content', (status, label) => {
  chat.messages.value = [
    {
      id: 1,
      type: 'ai',
      content: [{ type: 'text', text: '已生成的内容' }],
      timestamp: Date.now(),
      replyStatus: status,
    },
  ];
  render();
  expect(wrapper.get('.chat-message-status').text()).toBe(label);
  expect(wrapper.get('.chat-message-status').attributes('role')).toBe('status');
  expect(wrapper.get('.chat-bubble').text()).not.toContain(label);
  expect(wrapper.findAll('.chat-message-status')).toHaveLength(1);
});

test('an empty failed answer shows a status without an empty answer bubble', () => {
  chat.messages.value = [
    {
      id: 1,
      type: 'ai',
      content: [{ type: 'text', text: '' }],
      timestamp: Date.now(),
      replyStatus: 'failed',
    },
  ];
  render();
  expect(wrapper.find('.chat-bubble').exists()).toBe(false);
  expect(wrapper.get('.chat-message-status').text()).toBe('回复失败，请稍后重试');
});
