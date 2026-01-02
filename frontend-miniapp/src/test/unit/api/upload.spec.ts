import { jest } from '@jest/globals';

describe('api/modules/upload.ts - uploadImage', () => {
  const MODULE_PATH = '@/api/modules/upload';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('mock mode resolves with url and filename', async () => {
    // keep other helpers from mock-adapter and only override USE_MOCK
    const realMock: any = jest.requireActual('@/mock/mock-adapter');
    jest.doMock('@/mock/mock-adapter', () => ({ ...realMock, USE_MOCK: true }));

    const { uploadImage } = require(MODULE_PATH);

    const res = await uploadImage('/path/to/file.jpg');
    expect(res).toHaveProperty('url', '/path/to/file.jpg');
    expect(res).toHaveProperty('filename');
    expect(res.filename).toMatch(/mock_image_\d+\.jpg/);
  });

  test('success path resolves with parsed data', async () => {
    jest.doMock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    (global as any).uni = {
      uploadFile: ({ success }: any) => {
        success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'http://a', filename: 'f.jpg' } }) });
      }
    };

    const { uploadImage } = require(MODULE_PATH);
    const res = await uploadImage('fp');
    expect(res).toEqual({ url: 'http://a', filename: 'f.jpg' });
  });

  test('non-200 statusCode rejects', async () => {
    jest.doMock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    (global as any).uni = {
      uploadFile: ({ success }: any) => {
        success({ statusCode: 500, data: '{}' });
      }
    };

    const { uploadImage } = require(MODULE_PATH);
    await expect(uploadImage('fp')).rejects.toThrow('上传失败: 500');
  });

  test('empty response data rejects with server message', async () => {
    jest.doMock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    (global as any).uni = {
      uploadFile: ({ success }: any) => {
        success({ statusCode: 200, data: '' });
      }
    };

    const { uploadImage } = require(MODULE_PATH);
    await expect(uploadImage('fp')).rejects.toThrow('服务器未返回数据');
  });

  test('invalid JSON rejects with parse error', async () => {
    jest.doMock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    (global as any).uni = {
      uploadFile: ({ success }: any) => {
        success({ statusCode: 200, data: 'not-json' });
      }
    };

    const { uploadImage } = require(MODULE_PATH);
    await expect(uploadImage('fp')).rejects.toThrow('解析服务器响应失败');
  });

  test('fail callback rejects with provided error', async () => {
    jest.doMock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    (global as any).uni = {
      uploadFile: ({ fail }: any) => {
        fail(new Error('network'));
      }
    };

    const { uploadImage } = require(MODULE_PATH);
    await expect(uploadImage('fp')).rejects.toThrow('network');
  });
});