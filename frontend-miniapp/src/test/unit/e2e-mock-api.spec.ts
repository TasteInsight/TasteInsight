import { installMockApi } from '../../../e2e/helpers/mock-api';

describe('e2e mock API contract', () => {
  it('routes a configured API prefix while keeping static resources outside the matcher', async () => {
    const previous = process.env.VITE_API_BASE_URL;
    process.env.VITE_API_BASE_URL = ' https://api.example.invalid/api/v1/// ';
    try {
      const page = { route: jest.fn(async () => {}) };
      await installMockApi(page as any);
      expect(page.route).toHaveBeenCalledWith(
        'https://api.example.invalid/api/v1/**',
        expect.any(Function)
      );
      expect(page.route).not.toHaveBeenCalledWith(
        'https://api.example.invalid/**',
        expect.any(Function)
      );
    } finally {
      if (previous === undefined) delete process.env.VITE_API_BASE_URL;
      else process.env.VITE_API_BASE_URL = previous;
    }
  });

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
        url: () => 'https://api.example.invalid/api/v1/upload/image',
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
