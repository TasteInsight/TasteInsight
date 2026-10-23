function parsePostgres(value: unknown, key: string): URL {
  try {
    if (typeof value !== 'string') throw new Error();
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname ||
      url.pathname === '/' ||
      url.pathname.slice(1).includes('/')
    )
      throw new Error();
    decodeURIComponent(url.pathname);
    return url;
  } catch {
    throw new Error(`${key} must be a PostgreSQL URL with a database name`);
  }
}

function databaseIdentity(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const normalizedHost = ['localhost', '127.0.0.1', '[::1]'].includes(host)
    ? 'loopback'
    : host;
  return `${normalizedHost}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function recommendationDatabaseUrl(
  value: unknown,
  businessUrl?: unknown,
  production = false,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const url = parsePostgres(value, 'RECOMMENDATION_DATABASE_URL');
  if (
    production &&
    (!url.username ||
      !url.password ||
      /^(?:change[-_]me|your[-_])|placeholder/i.test(
        decodeURIComponent(url.password),
      ))
  ) {
    throw new Error(
      'RECOMMENDATION_DATABASE_URL requires non-placeholder credentials in production',
    );
  }
  if (
    businessUrl &&
    databaseIdentity(url) ===
      databaseIdentity(parsePostgres(businessUrl, 'DATABASE_URL'))
  ) {
    throw new Error(
      'RECOMMENDATION_DATABASE_URL must use a separate database from DATABASE_URL',
    );
  }
  return (value as string).trim();
}
