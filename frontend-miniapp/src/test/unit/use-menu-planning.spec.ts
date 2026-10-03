jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'user' } }),
}));

import { useMenuPlanning } from '@/pages/planning/composables/use-menu-planning';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { ref, reactive, nextTick } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-plan-store', () => ({
  usePlanStore: jest.fn(),
}));

// Mock onMounted
jest.mock('vue', () => {
  const original = jest.requireActual('vue');
  return {
    ...original,
    onMounted: (fn: Function) => fn(),
  };
});

// Mock global.uni
(global as any).uni = {
  showModal: jest.fn(),
  showToast: jest.fn(),
};

describe('useMenuPlanning', () => {
  let mockStore: any;

  beforeEach(() => {
    // Use reactive state to simulate Pinia store behavior
    mockStore = reactive({
      loading: false,
      error: null,
      currentPlans: [],
      historyPlans: [],
      selectedPlan: null,
      fetchPlans: jest.fn(),
      setSelectedPlan: jest.fn(plan => {
        mockStore.selectedPlan = plan;
      }),
      removePlan: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
    });
    (usePlanStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    const { showCreateDialog, activeTab } = useMenuPlanning();

    expect(showCreateDialog.value).toBe(false);
    expect(activeTab.value).toBe('current');
    expect(mockStore.fetchPlans).toHaveBeenCalled();
  });

  it('should handle viewPlanDetail', () => {
    const { viewPlanDetail, showDetailDialog } = useMenuPlanning();
    const plan = { id: '1', name: 'Plan 1' };

    viewPlanDetail(plan as any);

    expect(mockStore.setSelectedPlan).toHaveBeenCalledWith(plan);
    expect(showDetailDialog.value).toBe(true);
  });

  it('should handle editPlan', () => {
    const { editPlan, showEditDialog } = useMenuPlanning();
    const plan = { id: '1', name: 'Plan 1' };

    editPlan(plan as any);

    expect(mockStore.setSelectedPlan).toHaveBeenCalledWith(plan);
    expect(showEditDialog.value).toBe(true);
  });

  it('should handle deletePlan', async () => {
    const { deletePlan } = useMenuPlanning();

    // Mock uni.showModal
    (global as any).uni.showModal.mockImplementation((options: any) => {
      options.success({ confirm: true });
    });

    await deletePlan('123');

    expect(mockStore.removePlan).toHaveBeenCalledWith('123');
  });

  it('should handle createNewPlan', () => {
    const { createNewPlan, showCreateDialog } = useMenuPlanning();

    createNewPlan();

    expect(mockStore.setSelectedPlan).toHaveBeenCalledWith(null);
    expect(showCreateDialog.value).toBe(true);
  });

  it('should handle submitCreate', async () => {
    const { submitCreate, showCreateDialog } = useMenuPlanning();
    const planData = { name: 'New Plan' };

    await submitCreate(planData as any);

    expect(mockStore.createPlan).toHaveBeenCalledWith(planData);
    expect(showCreateDialog.value).toBe(false);
  });

  it('owns pending creation until the request settles and ignores repeated submission', async () => {
    let resolveCreate!: () => void;
    mockStore.createPlan.mockImplementation(() => new Promise<void>(resolve => {
      resolveCreate = resolve;
    }));
    const planning = useMenuPlanning();
    planning.createNewPlan();
    const first = planning.submitCreate({ dishes: ['dish'] } as any);
    expect(planning.submitting.value).toBe(true);
    await planning.submitCreate({ dishes: ['dish'] } as any);
    expect(mockStore.createPlan).toHaveBeenCalledTimes(1);
    expect(planning.showCreateDialog.value).toBe(true);
    resolveCreate();
    await first;
    expect(planning.submitting.value).toBe(false);
    expect(planning.showCreateDialog.value).toBe(false);
  });

  it('releases pending state after an unsuccessful save so it can be retried', async () => {
    mockStore.createPlan.mockRejectedValueOnce(new Error('save failed'));
    const planning = useMenuPlanning();
    planning.createNewPlan();
    await expect(planning.submitCreate({} as any)).rejects.toThrow('save failed');
    expect(planning.submitting.value).toBe(false);
    expect(planning.showCreateDialog.value).toBe(true);
    await planning.submitCreate({} as any);
    expect(mockStore.createPlan).toHaveBeenCalledTimes(2);
  });

  it('should handle submitEdit', async () => {
    const { submitEdit, showEditDialog } = useMenuPlanning();
    const planData = { name: 'Updated Plan' };

    // Set selected plan in store
    mockStore.selectedPlan = { id: '123', name: 'Old Plan' };

    await submitEdit(planData as any);

    expect(mockStore.updatePlan).toHaveBeenCalledWith('123', planData);
  });

  it('should switch tabs and display correct plans', async () => {
    const { activeTab, displayPlans } = useMenuPlanning();

    mockStore.currentPlans = [{ id: '1' }];
    mockStore.historyPlans = [{ id: '2' }];

    // Wait for computed to update
    await nextTick();

    expect(activeTab.value).toBe('current');
    expect(displayPlans.value).toEqual([{ id: '1' }]);

    activeTab.value = 'history';
    await nextTick();
    expect(displayPlans.value).toEqual([{ id: '2' }]);
  });
});
