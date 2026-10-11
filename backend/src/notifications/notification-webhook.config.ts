export function notificationWebhookUrl(get: (key: string) => unknown): string {
  const urlValue = get('NOTIFICATION_WEBHOOK_URL') ?? '';
  if (typeof urlValue !== 'string') {
    throw new Error('NOTIFICATION_WEBHOOK_URL must be a string');
  }
  const url = urlValue.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      const nodeEnv = get('NODE_ENV') ?? 'development';
      const localHttp =
        (nodeEnv === 'development' || nodeEnv === 'test') &&
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      if (
        !/^https?:\/\//i.test(url) ||
        /\s/.test(url) ||
        (parsed.protocol !== 'https:' && !localHttp) ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      )
        throw new Error();
    } catch {
      throw new Error(
        'NOTIFICATION_WEBHOOK_URL must be an explicit HTTPS URL without credentials or fragments; development/test may use loopback HTTP',
      );
    }
  }
  return url;
}

export function notificationWebhookConfiguration(
  get: (key: string) => unknown,
) {
  const url = notificationWebhookUrl(get);
  const secret = get('NOTIFICATION_WEBHOOK_SECRET') ?? '';
  if (typeof secret !== 'string') {
    throw new Error('NOTIFICATION_WEBHOOK_SECRET must be a string');
  }
  if (url) {
    if (
      secret.trim().length < 32 ||
      /^(?:change[-_]me|your[-_])|placeholder/i.test(secret.trim())
    ) {
      throw new Error(
        'NOTIFICATION_WEBHOOK_SECRET must be a non-placeholder secret of at least 32 characters',
      );
    }
  }
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const input = get(key);
    const value =
      input === undefined || input === '' ? fallback : Number(input);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer from ${min} to ${max}`);
    }
    return value;
  };
  return {
    url,
    secret,
    pollMs: integer('NOTIFICATION_WEBHOOK_POLL_MS', 5000, 1000, 60000),
    timeoutMs: integer('NOTIFICATION_WEBHOOK_TIMEOUT_MS', 5000, 100, 30000),
    maxAttempts: integer('NOTIFICATION_WEBHOOK_MAX_ATTEMPTS', 5, 1, 20),
    backoffMs: integer('NOTIFICATION_WEBHOOK_BACKOFF_MS', 5000, 100, 60000),
  };
}
