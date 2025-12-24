import { mount, flushPromises } from '@vue/test-utils';
import { jest } from '@jest/globals';

describe('RatingBars.vue', () => {
  const COMPONENT_PATH = '@/pages/dish/components/RatingBars.vue';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('renders default bars when no ratingDetail', async () => {
    const { default: RatingBars } = require(COMPONENT_PATH);
    const wrapper = mount(RatingBars as any, { props: { dishId: '' } });

    const texts = wrapper.text();
    expect(texts).toContain('5星');
    expect(texts).toContain('4星');
    // default percentages should be 0
    expect(texts).toContain('0%');
  });

  test.skip('computes percentages correctly after fetching rating detail', async () => {
    // Prepare fake response
    const fakeResponse = { code: 200, data: { rating: { detail: { '5': 3, '4': 1, '3': 1, '2': 0, '1': 0 } } } };

    const { default: RatingBars } = require(COMPONENT_PATH);
    const review = require('@/api/modules/review');
    // replace implementation at runtime
    review.getReviewsByDish = jest.fn(() => Promise.resolve(fakeResponse));

    const wrapper = mount(RatingBars as any, { props: { dishId: 'd1' } });

    // call exposed refresh to ensure fetch happens in test environment
    await (wrapper.vm as any).refresh();
    await flushPromises();

    expect(review.getReviewsByDish).toHaveBeenCalledWith('d1', { page: 1, pageSize: 1 });

    const texts = wrapper.text();
    // total = 5 -> percentages: 5:60%, 4:20%, 3:20%, others 0%
    expect(texts).toContain('60%');
    expect(texts).toContain('20%');
  });
});