import { effectScope, nextTick, reactive } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';
import { useSessionRefresh } from '@/composables/use-session-refresh';

jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn(), onHide: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));

test('a session change reloads the retained route on return, including a failed login attempt', async () => {
  const user = reactive({ sessionVersion: 0 });
  const route = reactive({ id: 'dish-a' });
  const snapshots: string[] = [];
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  const scope = effectScope();
  scope.run(() =>
    useSessionRefresh(
      () => {
        snapshots.push(route.id);
      },
      () => !!route.id
    )
  );
  const show = (onShow as jest.Mock).mock.calls.at(-1)[0];
  const hide = (onHide as jest.Mock).mock.calls.at(-1)[0];
  show();
  expect(snapshots).toEqual([]);
  hide();
  user.sessionVersion++;
  await nextTick();
  expect(snapshots).toEqual([]);
  show();
  expect(snapshots).toEqual(['dish-a']);
  show();
  expect(snapshots).toEqual(['dish-a']);
  user.sessionVersion++;
  await nextTick();
  expect(snapshots).toEqual(['dish-a', 'dish-a']);
  scope.stop();
  user.sessionVersion++;
  await nextTick();
  expect(snapshots).toHaveLength(2);
});
