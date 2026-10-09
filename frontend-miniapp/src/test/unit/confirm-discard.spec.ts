import { confirmDiscardChanges } from '@/utils/confirm-discard';

beforeEach(() => { uni.showModal = jest.fn(); });
test('unchanged content closes without a confirmation', async () => {
  expect(await confirmDiscardChanges(false,'放弃修改？')).toBe(true);
  expect(uni.showModal).not.toHaveBeenCalled();
});
test.each([true,false])('dirty content only closes with confirmation %s', async confirm => {
  (uni.showModal as jest.Mock).mockImplementation(options => options.success({confirm,cancel:!confirm}));
  expect(await confirmDiscardChanges(true,'放弃未保存的修改？')).toBe(confirm);
  expect(uni.showModal).toHaveBeenCalledWith(expect.objectContaining({content:'放弃未保存的修改？'}));
});
test('a failed confirmation preserves content', async () => {
  (uni.showModal as jest.Mock).mockImplementation(options => options.fail(new Error('unavailable')));
  expect(await confirmDiscardChanges(true,'放弃修改？')).toBe(false);
});
