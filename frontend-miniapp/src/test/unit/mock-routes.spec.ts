import { findMockRoute } from '@/mock/mock-adapter';
import '@/mock/mock-routes';

describe('mock route contracts', () => {
  test('matches the static dishes images route before the dish id route', async () => {
    const match = findMockRoute('/dishes/images', 'GET');

    expect(match).not.toBeNull();
    const response = await match!.handler(
      '/dishes/images',
      { url: '/dishes/images', method: 'GET' },
      match!.params
    );

    expect(response).toMatchObject({ code: 200, data: expect.any(Object) });
    expect(response.data).toHaveProperty('images');
  });

  test.each(['like', 'dislike'])('handles recommendation %s feedback locally', async feedback => {
    const match = findMockRoute(`/recommend/events/${feedback}`, 'POST');

    expect(match).not.toBeNull();
    const response = await match!.handler(
      `/recommend/events/${feedback}`,
      {
        url: `/recommend/events/${feedback}`,
        method: 'POST',
        data: { dishId: 'dish-1' },
      },
      match!.params
    );

    expect(response).toMatchObject({ code: 200, data: { eventId: expect.any(String) } });
  });
});
