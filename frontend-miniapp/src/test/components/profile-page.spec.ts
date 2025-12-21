import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, computed } from 'vue';
import ProfilePage from '@/pages/profile/index.vue';

// Mock uni-app lifecycle hooks
jest.mock('@dcloudio/uni-app', () => ({
  onPullDownRefresh: jest.fn(),
}));

// Mock composables
jest.mock('@/pages/profile/composables/use-profile', () => ({
  useProfile: jest.fn(),
}));

describe('ProfilePage', () => {
  let mockUseProfile: any;

  beforeEach(() => {
    setActivePinia(createPinia());

    const loading = ref(false);
    const userInfo = ref(null);
    const isLoggedIn = computed(() => !!userInfo.value);

    mockUseProfile = {
      userInfo,
      isLoggedIn,
      loading,
      handleLogout: jest.fn(),
      fetchProfile: jest.fn(),
    };

    const { useProfile } = require('@/pages/profile/composables/use-profile');
    useProfile.mockReturnValue(mockUseProfile);
  });

  it('renders skeleton when initially loading', () => {
    mockUseProfile.loading.value = true;

    const wrapper = shallowMount(ProfilePage, {
      global: {
        stubs: {
          ProfileSkeleton: true,
          UserHeader: true,
        },
      },
    });

    // Since hasLoaded starts as false, isInitialLoading should be true when loading is true
    expect(wrapper.findComponent({ name: 'ProfileSkeleton' }).exists()).toBe(true);
  });

  it('renders user header when not loading', () => {
    mockUseProfile.loading.value = false;
    mockUseProfile.isLoggedIn = true;

    const wrapper = shallowMount(ProfilePage, {
      global: {
        stubs: {
          ProfileSkeleton: true,
          UserHeader: true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'ProfileSkeleton' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'UserHeader' }).exists()).toBe(true);
  });

  it('shows menu items when logged in', () => {
    mockUseProfile.loading.value = false;
    mockUseProfile.isLoggedIn = true;

    const wrapper = shallowMount(ProfilePage, {
      global: {
        stubs: {
          ProfileSkeleton: true,
          UserHeader: true,
        },
      },
    });

    expect(wrapper.findAll('.flex.items-center.justify-between.p-4').length).toBeGreaterThan(0);
  });

  it('hides menu items when not logged in', () => {
    mockUseProfile.loading.value = false;
    mockUseProfile.userInfo.value = null; // This will make isLoggedIn false

    const wrapper = shallowMount(ProfilePage, {
      global: {
        stubs: {
          ProfileSkeleton: true,
          UserHeader: true,
        },
      },
    });

    // When not logged in, only the privacy and about menu items should be visible (2 items)
    expect(wrapper.findAll('.flex.items-center.justify-between.p-4').length).toBe(2);
  });
});
