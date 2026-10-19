import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import UserHeader from '@/pages/profile/components/UserHeader.vue';
import ProfileBioEditor from '@/pages/profile/components/ProfileBioEditor.vue';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@/store/modules/use-user-store');
let user: any;
const wrappers: any[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  user = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: {
      id: 'owner',
      nickname: '公开昵称',
      avatar: '/published-avatar.png',
      bio: '公开简介',
      publicProfileSubmission: {
        status: 'manual',
        fields: { nickname: '待审昵称', bio: '待审简介' },
        reason: null,
      },
    },
    updateProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

it('keeps public profile text visible while showing the owner pending status, then clears it after approval', async () => {
  const wrapper = mount(UserHeader, {
    props: { userInfo: user.userInfo, isLoggedIn: true, loading: false },
    global: { stubs: { UserAvatar: true, UiIcon: true } },
  });
  wrappers.push(wrapper);
  expect(wrapper.text()).toContain('公开昵称');
  expect(wrapper.text()).toContain('公开简介');
  expect(wrapper.text()).not.toContain('待审昵称');
  expect(wrapper.get('[role="status"]').text()).toContain('公开资料审核中');
  await wrapper.setProps({ userInfo: { ...user.userInfo, publicProfileSubmission: null } });
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
});

it('shows a rejected submission reason and hides owner status for guests', async () => {
  user.userInfo.publicProfileSubmission = {
    status: 'rejected',
    fields: { bio: '待审简介' },
    reason: '请修改简介',
  };
  const wrapper = mount(UserHeader, {
    props: { userInfo: user.userInfo, isLoggedIn: true, loading: false },
    global: { stubs: { UserAvatar: true, UiIcon: true } },
  });
  wrappers.push(wrapper);
  expect(wrapper.get('[role="status"]').text()).toContain('请修改简介');
  await wrapper.setProps({ isLoggedIn: false });
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
});

it('restores the owner biography draft and sends the revised biography with pending confirmation', async () => {
  const wrapper = mount(ProfileBioEditor);
  wrappers.push(wrapper);
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('待审简介');
  await wrapper.get('textarea').setValue('重新提交的简介');
  await wrapper
    .findAll('button')
    .find(button => button.text() === '保存')!
    .trigger('click');
  await flushPromises();
  expect(user.updateProfileAction).toHaveBeenCalledWith({ bio: '重新提交的简介' });
  expect(uni.showToast).toHaveBeenCalledWith({ title: '简介已提交审核', icon: 'none' });
  expect(wrapper.emitted('close')).toHaveLength(1);
});
