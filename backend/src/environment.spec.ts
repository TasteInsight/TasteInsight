import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('parses numeric environment values before services consume them', () => {
    expect(
      validateEnvironment({
        REDIS_PORT: '6381',
        REDIS_REC_DB: '0',
        EMBEDDING_SERVICE_BATCH_SIZE: '50',
        UPLOAD_MAX_FILE_SIZE: '10485760',
        AI_PROVIDER: 'openai',
      }),
    ).toMatchObject({
      REDIS_PORT: 6381,
      REDIS_REC_DB: 0,
      EMBEDDING_SERVICE_BATCH_SIZE: 50,
      UPLOAD_MAX_FILE_SIZE: 10485760,
      AI_PROVIDER: 'openai',
    });
  });

  it('uses defaults for absent numeric settings', () => {
    expect(validateEnvironment({})).toMatchObject({
      REDIS_PORT: 6379,
      REDIS_REC_DB: 1,
      EMBEDDING_SERVICE_BATCH_SIZE: 50,
      UPLOAD_MAX_FILE_SIZE: 10485760,
    });
  });

  it.each([
    ['REDIS_PORT', '65536'],
    ['REDIS_REC_DB', '-1'],
    ['EMBEDDING_SERVICE_BATCH_SIZE', '0'],
    ['UPLOAD_MAX_FILE_SIZE', 'invalid'],
  ])('rejects invalid %s', (key, value) => {
    expect(() => validateEnvironment({ [key]: value })).toThrow(key);
  });
});
