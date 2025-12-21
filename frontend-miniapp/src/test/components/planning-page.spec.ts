import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PlanningPage from '@/pages/planning/index.vue';
import { ref, computed } from 'vue';

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

  it('renders skeleton when initially loading', () => {
    mockUseMenuPlanning.loading.value = true;

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

    expect(wrapper.findComponent({ name: 'PlanningSkeleton' }).exists()).toBe(true);
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
    expect(wrapper.findAll('.flex-1.py-3.text-center').length).toBe(2); // current and history tabs
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