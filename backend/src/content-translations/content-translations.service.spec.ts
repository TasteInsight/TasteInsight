import { ContentTranslationsService } from './content-translations.service';
import { OpenAIProviderService } from '@/ai-chat/services/ai-provider/openai-provider.service';

describe('reviewable translation drafts', () => {
  const config = {
    apiKey: 'test-only-key',
    model: 'configured-model',
    baseUrl: 'https://provider.example',
  };
  let service: ContentTranslationsService;
  let complete: jest.SpyInstance;
  beforeEach(() => {
    service = new ContentTranslationsService({
      getProviderConfig: jest.fn().mockResolvedValue(config),
    } as any);
    jest
      .spyOn(OpenAIProviderService.prototype, 'setConfig')
      .mockImplementation(() => {});
    complete = jest.spyOn(OpenAIProviderService.prototype, 'completeChat');
  });
  afterEach(() => jest.restoreAllMocks());
  it('uses the configured provider and returns only a draft without persistence', async () => {
    complete.mockResolvedValue(
      JSON.stringify({
        nameEn: ' Tomato and eggs ',
        descriptionEn: 'Stir-fried tomatoes and eggs',
        unexpected: 'ignored',
      }),
    );
    const input = {
      kind: 'dish' as const,
      name: '番茄炒蛋',
      description: '番茄与鸡蛋炒制',
    };
    await expect(
      service.draft(input, new AbortController().signal),
    ).resolves.toEqual({
      nameEn: 'Tomato and eggs',
      descriptionEn: 'Stir-fried tomatoes and eggs',
    });
    expect(OpenAIProviderService.prototype.setConfig).toHaveBeenCalledWith(
      config,
    );
    expect(input.name).toBe('番茄炒蛋');
    expect(JSON.parse(complete.mock.calls[0][0][1].content)).toEqual(input);
  });
  it.each([
    'not JSON',
    '{"nameEn":"","descriptionEn":""}',
    '{"nameEn":12,"descriptionEn":""}',
    '{"nameEn":"Eggs"}',
  ])('rejects invalid provider output', async (raw) => {
    complete.mockResolvedValue(raw);
    await expect(
      service.draft(
        { kind: 'dish', name: '鸡蛋' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('英文建议生成失败');
  });
  it('returns a useful failure when configuration is absent without invoking a provider', async () => {
    service = new ContentTranslationsService({
      getProviderConfig: async () => ({ apiKey: '' }),
    } as any);
    await expect(
      service.draft(
        { kind: 'allergen', name: '花生' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('请先配置');
    expect(complete).not.toHaveBeenCalled();
  });
  it('hides provider errors and does not retry a timed out call', async () => {
    complete.mockRejectedValue(new Error('private upstream detail'));
    await expect(
      service.draft(
        { kind: 'dish', name: '鸡蛋' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('英文建议生成失败');
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
