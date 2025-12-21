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
});
