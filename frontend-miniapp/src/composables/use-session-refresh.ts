import { onScopeDispose, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';

/** 保留页面路由身份，在可见时恢复新会话对应的资源。 */
export function useSessionRefresh(refresh: () => unknown, enabled: () => boolean = () => true) {
  const user = useUserStore();
  let session = user.sessionVersion;
  let visible = false;

  const refreshIfChanged = () => {
    if (!visible || session === user.sessionVersion || !enabled()) return;
    session = user.sessionVersion;
    void refresh();
  };
  onShow(() => {
    visible = true;
    refreshIfChanged();
  });
  onHide(() => {
    visible = false;
  });
  watch(() => user.sessionVersion, refreshIfChanged, { flush: 'post' });
  onScopeDispose(() => {
    visible = false;
  });
}
