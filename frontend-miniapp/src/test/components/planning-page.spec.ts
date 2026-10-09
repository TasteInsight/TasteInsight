import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PlanningPage from '@/pages/planning/index.vue';
import { ref, computed, defineComponent } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';

// Mock uni-app lifecycle hooks
jest.mock('@dcloudio/uni-app', () => ({
  onHide: jest.fn(),
  onBackPress: jest.fn(),
  onPullDownRefresh: jest.fn(),
}));

// Mock composables
jest.mock('@/pages/planning/composables/use-menu-planning', () => ({
  useMenuPlanning: jest.fn(),
}));

describe('PlanningPage', () => {
  let mockUseMenuPlanning: any;

  beforeEach(() => {
    setActivePinia(createPinia());

    mockUseMenuPlanning = {
      loading: ref(false),
      initialized: ref(true),
      error: null,
      currentPlans: [],
      historyPlans: [],
      selectedPlan: null,
      displayPlans: [],
      activeTab: 'current',
      showDetailDialog: false,
      showEditDialog: false,
      showCreateDialog: false,
      viewPlanDetail: jest.fn(),
      editPlan: jest.fn(),
      deletePlan: jest.fn(),
      createNewPlan: jest.fn(),
      submitCreate: jest.fn(),
      submitEdit: jest.fn(),
      closeDetailDialog: jest.fn(),
      closeEditDialog: jest.fn(),
      closeCreateDialog: jest.fn(),
      switchTab: jest.fn(),
      refreshPlans: jest.fn(),
      executePlan: jest.fn(),
    };

    const { useMenuPlanning } = require('@/pages/planning/composables/use-menu-planning');
    useMenuPlanning.mockReturnValue(mockUseMenuPlanning);
  });

  it.each(['Create', 'Edit'])(
    'native back asks the %s editor to guard unsaved input before leaving',
    kind => {
      mockUseMenuPlanning[`show${kind}Dialog`] = ref(true);
      const requestClose = jest.fn().mockResolvedValue(false);
      const wrapper = shallowMount(PlanningPage, {
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
      expect(mockUseMenuPlanning[`close${kind}Dialog`]).not.toHaveBeenCalled();
      wrapper.unmount();
    }
  );

  it('keeps fixed controls and withholds data while initially loading', () => {
    mockUseMenuPlanning.loading.value = true;
    mockUseMenuPlanning.initialized.value = false;

    const wrapper = shallowMount(PlanningPage, {
      global: {
        stubs: {
          PlanningSkeleton: true,
          PlanCard: true,
          PlanDetailDialog: true,
          PlanEditDialog: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'PlanningSkeleton' }).exists()).toBe(false);
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2);
    expect(wrapper.find('[aria-label="新建规划"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('暂无当前规划');
  });

  it('renders tabs when not loading', () => {
    mockUseMenuPlanning.loading = false;

    const wrapper = shallowMount(PlanningPage, {
      global: {
        stubs: {
          PlanningSkeleton: true,
          PlanCard: true,
          PlanDetailDialog: true,
          PlanEditDialog: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'PlanningSkeleton' }).exists()).toBe(false);
    expect(wrapper.findAll('[role="tab"]').length).toBe(2);
  });

  it('shows current plans count in tab', () => {
    mockUseMenuPlanning.loading = false;
    mockUseMenuPlanning.currentPlans = [{ id: '1' }, { id: '2' }];

    const wrapper = shallowMount(PlanningPage, {
      global: {
        stubs: {
          PlanningSkeleton: true,
          PlanCard: true,
          PlanDetailDialog: true,
          PlanEditDialog: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.text()).toContain('当前规划 (2)');
  });

  it('shows history plans count in tab', () => {
    mockUseMenuPlanning.loading = false;
    mockUseMenuPlanning.historyPlans = [{ id: '1' }];

    const wrapper = shallowMount(PlanningPage, {
      global: {
        stubs: {
          PlanningSkeleton: true,
          PlanCard: true,
          PlanDetailDialog: true,
          PlanEditDialog: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.text()).toContain('历史规划 (1)');
  });
});
