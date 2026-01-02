/// <reference types="jest" />
import { useAddDish } from '@/pages/add-dish/composables/use-add-dish';
import { uploadDish } from '@/api/modules/dish';
import { getCanteenList } from '@/api/modules/canteen';

// Mock APIs
jest.mock('@/api/modules/dish', () => ({
  uploadDish: jest.fn(),
}));
jest.mock('@/api/modules/canteen', () => ({
  getCanteenList: jest.fn(),
}));

// Mock uni-app APIs
(global as any).uni = {
  showToast: jest.fn(),
  navigateBack: jest.fn(),
  chooseImage: jest.fn(),
} as any;

describe('useAddDish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { formData, loading, submitting, error, isFormValid } = useAddDish();

    expect(formData.name).toBe('');
    expect(formData.price).toBe(0);
    expect(loading.value).toBe(false);
    expect(submitting.value).toBe(false);
    expect(error.value).toBe('');
    expect(isFormValid.value).toBe(false);
  });

  it('should load canteen list successfully', async () => {
    const { loadCanteenList, canteenList, loading } = useAddDish();
    
    const mockCanteens = [{ id: '1', name: 'Canteen A' }];
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockCanteens }
    });

    const promise = loadCanteenList();
    expect(loading.value).toBe(true);
    
    await promise;
    
    expect(loading.value).toBe(false);
    expect(canteenList.value).toEqual(mockCanteens);
  });

  it('should select canteen and update form data', () => {
    const { selectCanteen, formData, selectedCanteen } = useAddDish();
    const mockCanteen = { id: '1', name: 'Canteen A', windows: [] } as any;

    selectCanteen(mockCanteen);

    expect(selectedCanteen.value).toEqual(mockCanteen);
    expect(formData.canteenId).toBe('1');
    expect(formData.canteenName).toBe('Canteen A');
  });

  it('should validate form correctly', () => {
    const { formData, isFormValid } = useAddDish();

    expect(isFormValid.value).toBe(false);

    formData.name = 'Test Dish';
    formData.price = 10;
    formData.canteenName = 'Canteen A';
    formData.windowName = 'Window 1';
    formData.availableMealTime = ['lunch'];

    expect(isFormValid.value).toBe(true);
  });

  it('should submit form successfully', async () => {
    const { submitForm, formData } = useAddDish();
    
    // Setup valid form
    formData.name = 'Test Dish';
    formData.price = 10;
    formData.canteenName = 'Canteen A';
    formData.windowName = 'Window 1';
    formData.availableMealTime = ['lunch'];

    (uploadDish as jest.Mock).mockResolvedValue({ code: 200 });

    const result = await submitForm();

    expect(uploadDish).toHaveBeenCalledWith(formData);
    expect(result).toBe(true);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '提交成功，等待审核' }));
  });

  it('should handle submit error', async () => {
    const { submitForm, formData, error } = useAddDish();
    
    // Setup valid form
    formData.name = 'Test Dish';
    formData.price = 10;
    formData.canteenName = 'Canteen A';
    formData.windowName = 'Window 1';
    formData.availableMealTime = ['lunch'];

    (uploadDish as jest.Mock).mockResolvedValue({ 
      code: 500, 
      message: 'Server Error' 
    });

    const result = await submitForm();

    expect(result).toBe(false);
    expect(error.value).toBe('Server Error');
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
  });

  it('should reset form', () => {
    const { resetForm, formData } = useAddDish();
    
    formData.name = 'Changed';
    resetForm();
    
    expect(formData.name).toBe('');
    expect(formData.price).toBe(0);
  });

  it('should select window and toggle mealtime', () => {
    const { selectWindow, formData, toggleMealTime } = useAddDish();
    const w = { number: '10', name: 'W', floor: { level: '2' } } as any;
    selectWindow(w);
    expect(formData.windowNumber).toBe('10');
    expect(formData.windowName).toBe('W');
    expect(formData.floor).toBe('2');

    toggleMealTime('lunch');
    expect(formData.availableMealTime).toContain('lunch');
    toggleMealTime('lunch');
    expect(formData.availableMealTime).not.toContain('lunch');
  });

  it('should toggle and manage tags and allergens', () => {
    const { toggleTag, formData, addCustomTag, customTagInput, customTags, removeCustomTag, toggleAllergen, addCustomAllergen, customAllergenInput, customAllergens, removeCustomAllergen } = useAddDish();

    toggleTag('辣');
    expect(formData.tags).toContain('辣');
    toggleTag('辣');
    expect(formData.tags).not.toContain('辣');

    customTagInput.value = '自定义';
    addCustomTag();
    expect(formData.tags).toContain('自定义');
    expect(customTags.value).toContain('自定义');
    removeCustomTag('自定义');
    expect(customTags.value).not.toContain('自定义');

    toggleAllergen('花生');
    expect(formData.allergens).toContain('花生');
    toggleAllergen('花生');
    expect(formData.allergens).not.toContain('花生');

    customAllergenInput.value = '鱼';
    addCustomAllergen();
    expect(formData.allergens).toContain('鱼');
    expect(customAllergens.value).toContain('鱼');

    removeCustomAllergen('鱼');
    expect(customAllergens.value).not.toContain('鱼');
  });

  it('should choose and remove images', () => {
    const { chooseImages, formData, removeImage } = useAddDish();
    (uni.chooseImage as jest.Mock).mockImplementation(({ success }: any) => success({ tempFilePaths: ['a.jpg'] }));

    chooseImages();
    expect(formData.images).toContain('a.jpg');

    removeImage(0);
    expect(formData.images?.length).toBe(0);
  });

  it('loadCanteenList failure sets error', async () => {
    (getCanteenList as jest.Mock).mockRejectedValue(new Error('bad'));
    const { loadCanteenList, error } = useAddDish();
    await loadCanteenList();
    expect(error.value).toBe('加载食堂列表失败');
  });

  it('submitForm triggers navigateBack after success timeout', async () => {
    jest.useFakeTimers();
    const { submitForm, formData } = useAddDish();
    formData.name = 'Test';
    formData.price = 10;
    formData.canteenName = 'C';
    formData.windowName = 'W';
    formData.availableMealTime = ['lunch'];

    (uploadDish as jest.Mock).mockResolvedValue({ code: 200 });

    const res = await submitForm();
    expect(res).toBe(true);
    // run timers to execute navigateBack
    jest.runAllTimers();
    expect((uni.navigateBack as jest.Mock)).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
