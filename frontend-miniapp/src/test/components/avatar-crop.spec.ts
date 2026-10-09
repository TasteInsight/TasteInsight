import { mount, flushPromises } from '@vue/test-utils';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import AvatarCrop from '@/pages/settings/components/avatar-crop.vue';

jest.mock('@dcloudio/uni-app', () => ({ onLoad: jest.fn(), onUnload: jest.fn() }));
const ctx = {
  clearRect: jest.fn(),
  drawImage: jest.fn(),
  draw: jest.fn((_reserve, done) => done()),
};
const channel = { on: jest.fn(), emit: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).getCurrentPages = () => [{ getOpenerEventChannel: () => channel }];
  Object.assign(uni, {
    getSystemInfoSync: jest.fn(() => ({ windowWidth: 360, windowHeight: 640 })),
    getImageInfo: jest.fn(),
    createCanvasContext: jest.fn(() => ctx),
    canvasToTempFilePath: jest.fn(options => options.success({ tempFilePath: 'cropped.jpg' })),
    navigateBack: jest.fn(),
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    showToast: jest.fn(),
  });
});

it.each([
  [800, 400, -160, 0, [300, 100, 200, 200]],
  [400, 800, 0, -160, [100, 300, 200, 200]],
])('exports the same centered 2x crop for a %sx%s image', async (width, height, x, y, expected) => {
  (uni.getImageInfo as jest.Mock).mockImplementation(options => options.success({ width, height }));
  const wrapper = mount(AvatarCrop);
  (onLoad as jest.Mock).mock.calls[0][0]({ src: 'original.jpg' });
  await flushPromises();
  const vm = wrapper.vm as any;
  vm.handleScaleChange({ detail: { x, y, scale: 2 } });
  const pending = vm.handleConfirm();
  await vm.handleConfirm();
  await pending;
  expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  expect(ctx.drawImage).toHaveBeenCalledWith('original.jpg', ...expected, 0, 0, 400, 400);
  expect(channel.emit).toHaveBeenCalledWith('cropped', { tempFilePath: 'cropped.jpg' });
  expect(uni.hideLoading).toHaveBeenCalledTimes(1);
  expect((uni.hideLoading as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    channel.emit.mock.invocationCallOrder[0]
  );
  expect(wrapper.classes()).toContain('page-viewport');
  wrapper.unmount();
});

it('retains scale when a subsequent drag event only contains x and y', async () => {
  (uni.getImageInfo as jest.Mock).mockImplementation(options =>
    options.success({ width: 800, height: 400 })
  );
  const wrapper = mount(AvatarCrop);
  (onLoad as jest.Mock).mock.calls[0][0]({ src: 'original.jpg' });
  await flushPromises();
  const vm = wrapper.vm as any;
  vm.handleScaleChange({ detail: { x: -160, y: 0, scale: 2 } });
  vm.handleMoveChange({ detail: { x: -520, y: -200 } });
  await vm.handleConfirm();
  expect(ctx.drawImage).toHaveBeenCalledWith('original.jpg', 325, 125, 200, 200, 0, 0, 400, 400);
  wrapper.unmount();
});

it('deduplicates source initialization and closes cancellation through the event channel', async () => {
  (uni.getImageInfo as jest.Mock).mockImplementation(options =>
    options.success({ width: 400, height: 400 })
  );
  const wrapper = mount(AvatarCrop);
  (onLoad as jest.Mock).mock.calls[0][0]({ src: 'original.jpg' });
  channel.on.mock.calls[0][1]({ src: 'original.jpg' });
  await flushPromises();
  expect(uni.getImageInfo).toHaveBeenCalledTimes(1);
  (onUnload as jest.Mock).mock.calls[0][0]();
  expect(channel.emit).toHaveBeenCalledWith('cancel');
  wrapper.unmount();
});
