import { installMockApi } from '../../../e2e/helpers/mock-api';

describe('e2e mock API contract', () => {
  it('returns uploaded image metadata for the add-dish flow', async () => {
    const handlers: Array<(route: any) => Promise<void>> = [];
    const page = {
      route: jest.fn(async (_pattern: string, handler: (route: any) => Promise<void>) => {
        handlers.push(handler);
      }),
    };

    await installMockApi(page as any);

    const fulfill = jest.fn();
    const route = {
      request: () => ({
        method: () => 'POST',
        url: () => 'https://www.zens.top/api/v1/upload/image',
        postData: () => null,
      }),
      fulfill,
    };
    await handlers[0](route);

    const response = JSON.parse(fulfill.mock.calls[0][0].body);
    expect(response).toMatchObject({
      code: 200,
      data: {
        url: expect.any(String),
        filename: expect.any(String),
      },
    });
  });
});
