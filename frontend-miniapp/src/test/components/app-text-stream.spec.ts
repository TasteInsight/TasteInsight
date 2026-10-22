import { shallowMount } from '@vue/test-utils';
import AppTextStream from '@/components/AppTextStream.vue';

const mountTransport = () =>
  shallowMount(AppTextStream, {
    global: { mocks: { stream: { update: jest.fn() } } },
  });
const options = () => ({
  url: 'https://api.test/chat',
  header: { Authorization: 'Bearer synthetic' },
  body: '{"message":"午餐"}',
  onStatus: jest.fn(),
  onText: jest.fn(),
  onError: jest.fn(),
  onComplete: jest.fn(),
});

test('keeps cancellation inside a bound object so the App bridge invokes its change handler', async () => {
  const wrapper = mountTransport();
  const task = wrapper.vm.start(options());
  await wrapper.vm.$nextTick();
  expect(wrapper.get('.app-text-stream').attributes('request')).toBeDefined();

  task.abort();
  await wrapper.vm.$nextTick();
  expect(wrapper.get('.app-text-stream').attributes('request')).toBeDefined();
  wrapper.unmount();
});

test('delivers only current events and releases callbacks at completion', () => {
  const wrapper = mountTransport();
  const callbacks = options();
  wrapper.vm.start(callbacks);
  const id = wrapper.vm.request!.id;
  wrapper.vm.receive({ id, type: 'status', status: 200 });
  wrapper.vm.receive({ id, type: 'text', text: '午餐🥢' });
  expect(callbacks.onText).toHaveBeenCalledWith('午餐🥢');
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  wrapper.vm.receive({ id, type: 'complete' });
  wrapper.vm.receive({ id, type: 'text', text: 'late' });
  expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
  expect(callbacks.onText).toHaveBeenCalledTimes(1);
  expect(wrapper.vm.active).toBeNull();
  expect(wrapper.vm.request).toBeNull();
  wrapper.unmount();
});

test('cancelling synchronously ignores queued events; an old handle cannot abort a new request', () => {
  const wrapper = mountTransport();
  const first = options();
  const old = wrapper.vm.start(first);
  const oldId = wrapper.vm.request!.id;
  old.abort();
  wrapper.vm.receive({ id: oldId, type: 'error', message: 'late failure' });
  const second = options();
  wrapper.vm.start(second);
  const id = wrapper.vm.request!.id;
  old.abort();
  wrapper.vm.receive({ id: oldId, type: 'complete' });
  wrapper.vm.receive({ id, type: 'text', text: 'new' });
  expect(first.onError).not.toHaveBeenCalled();
  expect(first.onComplete).not.toHaveBeenCalled();
  expect(second.onText).toHaveBeenCalledWith('new');
  wrapper.unmount();
  expect(wrapper.vm.active).toBeNull();
  expect(wrapper.vm.request).toBeNull();
});

test.each(['status', 'error', 'complete'] as const)(
  'cleans up before a %s callback starts another request',
  type => {
    const wrapper = mountTransport();
    const first = options();
    const second = options();
    const restart = () => wrapper.vm.start(second);
    first.onStatus.mockImplementation(restart);
    first.onError.mockImplementation(restart);
    first.onComplete.mockImplementation(restart);
    wrapper.vm.start(first);
    const id = wrapper.vm.request!.id;
    if (type === 'status') wrapper.vm.receive({ id, type, status: 401 });
    else if (type === 'error') wrapper.vm.receive({ id, type, message: 'disconnected' });
    else wrapper.vm.receive({ id, type });
    expect(wrapper.vm.request!.id).not.toBe(id);
    wrapper.vm.receive({ id: wrapper.vm.request!.id, type: 'text', text: 'new' });
    expect(second.onText).toHaveBeenCalledWith('new');
    wrapper.unmount();
  }
);
