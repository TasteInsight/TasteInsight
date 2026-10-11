import { shallowMount, flushPromises } from '@vue/test-utils';
import PlanningPage from '@/pages/planning/index.vue';
import { ref, computed, defineComponent, reactive } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { useMenuPlanning } from '@/pages/planning/composables/use-menu-planning';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onHide: jest.fn(),
  onBackPress: jest.fn(),
  onPullDownRefresh: jest.fn(),
}));
jest.mock('@/pages/planning/composables/use-menu-planning', () => ({ useMenuPlanning: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
const mockUpdatePlan = jest.fn();
jest.mock('@/store/modules/use-plan-store', () => ({
  usePlanStore: () => ({ updatePlan: mockUpdatePlan }),
}));

describe('PlanningPage', () => {
  let model: any;
  let user: any;
  const wrappers: any[] = [];
  const mountPage = (options = {}) => {
    const wrapper = shallowMount(PlanningPage, options);
    wrappers.push(wrapper);
    return wrapper;
  };
  const viewTab = (wrapper: any, label: string) =>
    wrapper
      .findAll('[aria-label="规划视图"] [role="tab"]')
      .find((tab: any) => tab.text() === label)!;

  beforeEach(() => {
    jest.clearAllMocks();
    user = reactive({
      sessionVersion: 0,
      isLoggedIn: true,
      userInfo: {
        id: 'A',
        capabilities: { canContribute: true },
        settings: { showMealPlans: false },
      },
      updateProfileAction: jest.fn(),
    });
    (useUserStore as unknown as jest.Mock).mockReturnValue(user);
    model = {
      loading: ref(false),
      initialized: ref(true),
      error: ref(''),
      submitting: ref(false),
      currentPlans: ref([]),
      historyPlans: ref([]),
      dayPlans: ref([]),
      selectedPlan: ref(null),
      activeTab: ref('current'),
      viewMode: ref('week'),
      showDetailDialog: ref(false),
      showEditDialog: ref(false),
      showCreateDialog: ref(false),
      viewPlanDetail: jest.fn(),
      editPlan: jest.fn(),
      deletePlan: jest.fn(),
      createNewPlan: jest.fn(),
      submitCreate: jest.fn(),
      submitEdit: jest.fn(),
      closeDetailDialog: jest.fn(),
      closeEditDialog: jest.fn(),
      closeCreateDialog: jest.fn(),
      refreshPlans: jest.fn(),
      executePlan: jest.fn(),
      handlePageShow: jest.fn(),
      handlePageHide: jest.fn(),
      calendarPlans: ref([]),
      selectedDate: ref('2026-10-09'),
      today: ref('2026-10-09'),
    };
    model.displayPlans = computed(() =>
      model.viewMode.value === 'list'
        ? model.activeTab.value === 'current'
          ? model.currentPlans.value
          : model.historyPlans.value
        : model.dayPlans.value
    );
    model.switchTab = jest.fn((tab: string) => {
      model.activeTab.value = tab;
    });
    model.setViewMode = jest.fn((mode: string) => {
      model.viewMode.value = mode;
    });
    model.selectDate = jest.fn((date: string) => {
      model.selectedDate.value = date;
    });
    (useMenuPlanning as jest.Mock).mockReturnValue(model);
  });
  afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

  it.each(['Create', 'Edit'])(
    'native back asks the %s editor to guard unsaved input before leaving',
    kind => {
      model[`show${kind}Dialog`].value = true;
      const requestClose = jest.fn().mockResolvedValue(false);
      mountPage({
        global: {
          stubs: {
            PlanEditDialog: defineComponent({
              setup(_, { expose }) {
                expose({ requestClose });
                return () => null;
              },
            }),
          },
        },
      });
      const back = (onBackPress as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(back()).toBe(true);
      expect(requestClose).toHaveBeenCalledTimes(1);
      expect(model[`close${kind}Dialog`]).not.toHaveBeenCalled();
    }
  );

  it('keeps one row of four view controls while initially loading, with no false empty state', () => {
    model.loading.value = true;
    model.initialized.value = false;
    const wrapper = mountPage();
    expect(wrapper.findAll('[role="tablist"]')).toHaveLength(1);
    expect(
      wrapper.findAll('[aria-label="规划视图"] [role="tab"]').map((tab: any) => tab.text())
    ).toEqual(['月', '周', '日', '列表']);
    expect(viewTab(wrapper, '周').attributes('aria-selected')).toBe('true');
    expect(wrapper.find('[aria-label="新建规划"]').exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/暂无当前规划|这天还没有安排|尚未安排/);
  });

  it('switches all calendar views and the list without clearing the selected date', async () => {
    model.selectedDate.value = '2027-01-02';
    const wrapper = mountPage();
    for (const [label, mode] of [
      ['月', 'month'],
      ['日', 'day'],
      ['列表', 'list'],
      ['周', 'week'],
    ]) {
      await viewTab(wrapper, label).trigger('click');
      expect(model.setViewMode).toHaveBeenLastCalledWith(mode);
      expect(viewTab(wrapper, label).attributes('aria-selected')).toBe('true');
      expect(model.selectedDate.value).toBe('2027-01-02');
    }
    expect(model.selectDate).not.toHaveBeenCalled();
    expect(wrapper.getComponent({ name: 'PlanCalendar' }).props('selectedDate')).toBe('2027-01-02');
  });

  it('limits current/history categories to the list and keeps count and creation date in sync', async () => {
    model.currentPlans.value = [{ id: '1' }, { id: '2' }];
    model.historyPlans.value = [{ id: '3' }];
    model.selectedDate.value = '2026-09-30';
    const wrapper = mountPage({ global: { stubs: { UiPicker: false } } });
    expect(wrapper.find('[aria-label="规划分类"]').exists()).toBe(false);
    await viewTab(wrapper, '列表').trigger('click');
    expect(wrapper.get('[aria-label="选择列表范围"]').text()).toContain('当前规划 (2)');
    expect(wrapper.findAllComponents({ name: 'PlanCard' })).toHaveLength(2);
    expect(wrapper.findAllComponents({ name: 'PlanEditDialog' })[1].props('initialDate')).toBe(
      '2026-10-09'
    );
    await wrapper.get('[aria-label="规划分类"]').trigger('change', { detail: { value: 1 } });
    expect(wrapper.get('[aria-label="选择列表范围"]').text()).toContain('历史规划 (1)');
    expect(wrapper.findAllComponents({ name: 'PlanCard' })[0].props('isHistory')).toBe(true);
    expect(wrapper.find('[aria-label="新建规划"]').exists()).toBe(false);
    await viewTab(wrapper, '日').trigger('click');
    expect(model.selectedDate.value).toBe('2026-09-30');
    expect(wrapper.find('[aria-label="新建规划"]').exists()).toBe(true);
    expect(wrapper.findAllComponents({ name: 'PlanEditDialog' })[1].props('initialDate')).toBe(
      '2026-09-30'
    );
  });

  it('day view organizes meals in four sections and avoids repeating the schedule inside cards', async () => {
    model.dayPlans.value = [
      { id: 'dinner', mealTime: 'dinner' },
      { id: 'breakfast', mealTime: 'breakfast' },
    ];
    const wrapper = mountPage();
    await viewTab(wrapper, '日').trigger('click');
    expect(wrapper.findAll('.planning-meal-title').map((title: any) => title.text())).toEqual([
      '早餐',
      '午餐',
      '晚餐',
      '夜宵',
    ]);
    expect(wrapper.findAll('.planning-meal-empty')).toHaveLength(2);
    const cards = wrapper.findAllComponents({ name: 'PlanCard' });
    expect(cards.map((card: any) => card.props('plan').id)).toEqual(['breakfast', 'dinner']);
    expect(cards.every((card: any) => card.props('showSchedule') === false)).toBe(true);
    expect(cards[0].props('occurrenceDate')).toBe('2026-10-09');
  });

  it('keeps account-level homepage settings out of planning and preserves private defaults', async () => {
    const wrapper = mountPage();
    expect(wrapper.find('switch').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('主页展示');
    for (const label of ['月', '日', '列表', '周']) await viewTab(wrapper, label).trigger('click');
    expect(user.updateProfileAction).not.toHaveBeenCalled();
    expect(user.userInfo.settings.showMealPlans).toBe(false);
  });

  it('publishes a selected plan only after explicit confirmation without enabling the global opt-in', async () => {
    model.dayPlans.value = [{ id: 'plan', mealTime: 'lunch', isPublic: false }];
    const wrapper = mountPage();
    (uni.showModal as jest.Mock).mockImplementation(options => options.success({ confirm: true }));
    wrapper.findComponent({ name: 'PlanCard' }).vm.$emit('privacy');
    await flushPromises();
    expect(uni.showModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: '公开这份计划', confirmText: '公开' })
    );
    expect(mockUpdatePlan).toHaveBeenCalledWith('plan', { isPublic: true });
    expect(user.updateProfileAction).not.toHaveBeenCalled();
    expect(user.userInfo.settings.showMealPlans).toBe(false);
  });

  it('ignores a visibility confirmation after switching account', async () => {
    model.dayPlans.value = [{ id: 'plan', mealTime: 'lunch', isPublic: false }];
    const wrapper = mountPage();
    (uni.showModal as jest.Mock).mockImplementation(() => undefined);
    wrapper.findComponent({ name: 'PlanCard' }).vm.$emit('privacy');
    const options = (uni.showModal as jest.Mock).mock.calls[0][0];
    user.sessionVersion++;
    options.success({ confirm: true });
    await flushPromises();
    expect(mockUpdatePlan).not.toHaveBeenCalled();
  });
});
