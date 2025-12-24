import { jest } from '@jest/globals';

describe('pages/planning/composables/use-menu-planning.ts', () => {
  const MODULE_PATH = '@/pages/planning/composables/use-menu-planning';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('viewPlanDetail and editPlan set dialogs and call store.setSelectedPlan', () => {
    const setSelectedPlan = jest.fn();
    const mockStore = { fetchPlans: jest.fn(), setSelectedPlan };
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStore }));

    const { useMenuPlanning } = require(MODULE_PATH);
    const inst = useMenuPlanning();

    const plan = { id: 'p1' } as any;
    inst.viewPlanDetail(plan);
    expect(inst.showDetailDialog.value).toBe(true);
    expect(setSelectedPlan).toHaveBeenCalledWith(plan);

    inst.editPlan(plan);
    expect(inst.showEditDialog.value).toBe(true);
    expect(setSelectedPlan).toHaveBeenCalledWith(plan);
  });

  test('deletePlan respects confirmation and calls removePlan', async () => {
    const removePlan = jest.fn() as unknown as jest.Mock<any, any>;
    removePlan.mockResolvedValue({});
    const mockStore = { fetchPlans: jest.fn(), setSelectedPlan: jest.fn(), removePlan };
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStore }));

    // confirm true
    (global as any).uni = {
      showModal: (opts: any) => opts.success({ confirm: true }),
      showToast: jest.fn(),
    };

    const { useMenuPlanning } = require(MODULE_PATH);
    const inst = useMenuPlanning();

    await inst.deletePlan('p1');
    expect(removePlan).toHaveBeenCalledWith('p1');

    // confirm false
    (global as any).uni = { showModal: (opts: any) => opts.success({ confirm: false }), showToast: jest.fn() };
    await inst.deletePlan('p2');
    expect(removePlan).toHaveBeenCalledTimes(1);
  });

  test('createNewPlan and submitCreate handle success and failure', async () => {
    const createPlan = jest.fn() as unknown as jest.Mock<any, any>;
    createPlan.mockResolvedValue({});
    const mockStore = { fetchPlans: jest.fn(), setSelectedPlan: jest.fn(), createPlan };
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStore }));

    const { useMenuPlanning } = require(MODULE_PATH);
    const inst = useMenuPlanning();

    inst.createNewPlan();
    expect(inst.showCreateDialog.value).toBe(true);

    await inst.submitCreate({} as any);
    expect(createPlan).toHaveBeenCalled();
    expect(inst.showCreateDialog.value).toBe(false);

    createPlan.mockRejectedValueOnce(new Error('fail'));
    await expect(inst.submitCreate({} as any)).rejects.toThrow();
  });

  test('submitEdit returns early when no selectedPlan, otherwise updates and hides', async () => {
    const updatePlan = jest.fn() as unknown as jest.Mock<any, any>;
    updatePlan.mockResolvedValue({});
    // First: ensure when no selectedPlan updatePlan not called
    const mockStoreNo = { fetchPlans: jest.fn(), setSelectedPlan: jest.fn(), updatePlan, selectedPlan: null } as any;
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStoreNo }));
    const { useMenuPlanning: useMenuPlanningNo } = require(MODULE_PATH);
    const instNo = useMenuPlanningNo();
    await instNo.submitEdit({} as any);
    expect(updatePlan).not.toHaveBeenCalled();

    // Reset modules and test with selectedPlan present
    jest.resetModules();
    const mockStoreYes = { fetchPlans: jest.fn(), setSelectedPlan: jest.fn(), updatePlan, selectedPlan: { id: 'p1' } } as any;
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStoreYes }));
    const { useMenuPlanning: useMenuPlanningYes } = require(MODULE_PATH);
    const instYes = useMenuPlanningYes();
    await instYes.submitEdit({} as any);
    expect(updatePlan).toHaveBeenCalled();
    expect(instYes.showEditDialog.value).toBe(false);
  });

  test('executePlan success and failure show appropriate toasts', async () => {
    const executePlan = jest.fn() as unknown as jest.Mock<any, any>;
    executePlan.mockResolvedValue({});
    const mockStore = { fetchPlans: jest.fn(), setSelectedPlan: jest.fn(), executePlan };
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStore }));

    (global as any).uni = { showToast: jest.fn() };

    const { useMenuPlanning } = require(MODULE_PATH);
    const inst = useMenuPlanning();

    await inst.executePlan('p1');
    expect(executePlan).toHaveBeenCalledWith('p1');
    expect((global as any).uni.showToast).toHaveBeenCalled();

    executePlan.mockRejectedValueOnce(new Error('err'));
    await inst.executePlan('p2');
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('switchTab closes dialogs and sets activeTab', () => {
    const mockStore = { fetchPlans: jest.fn(), setSelectedPlan: jest.fn() };
    jest.doMock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => mockStore }));

    const { useMenuPlanning } = require(MODULE_PATH);
    const inst = useMenuPlanning();

    inst.showDetailDialog.value = true;
    inst.switchTab('history');
    expect(inst.showDetailDialog.value).toBe(false);
    expect(inst.activeTab.value).toBe('history');
  });
});