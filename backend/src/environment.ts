function integerSetting(
  value: unknown,
  key: string,
  fallback: number,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const input = typeof value === 'string' ? value.trim() : value;
  const parsed = input === undefined || input === '' ? fallback : Number(input);

  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  }

  return parsed;
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...environment,
    REDIS_PORT: integerSetting(
      environment.REDIS_PORT,
      'REDIS_PORT',
      6379,
      1,
      65535,
    ),
    REDIS_REC_DB: integerSetting(
      environment.REDIS_REC_DB,
      'REDIS_REC_DB',
      1,
      0,
    ),
    EMBEDDING_SERVICE_BATCH_SIZE: integerSetting(
      environment.EMBEDDING_SERVICE_BATCH_SIZE,
      'EMBEDDING_SERVICE_BATCH_SIZE',
      50,
      1,
    ),
    UPLOAD_MAX_FILE_SIZE: integerSetting(
      environment.UPLOAD_MAX_FILE_SIZE,
      'UPLOAD_MAX_FILE_SIZE',
      10485760,
      1,
    ),
  };
}
