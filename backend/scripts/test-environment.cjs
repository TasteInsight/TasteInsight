function testDatabaseUrl(value, key) {
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.hash ||
      database.includes('/') ||
      !database.endsWith('_test')
    ) {
      throw new Error();
    }
    return url;
  } catch {
    throw new Error(
      `E2E tests require ${key} pointing to a separate PostgreSQL database whose name ends in _test`,
    );
  }
}

function validateTestEnvironment(environment) {
  if (environment.NODE_ENV !== 'test') {
    throw new Error('E2E tests require NODE_ENV=test');
  }
  const business = testDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL');
  if (environment.RECOMMENDATION_DATABASE_URL) {
    const recommendation = testDatabaseUrl(
      environment.RECOMMENDATION_DATABASE_URL,
      'RECOMMENDATION_DATABASE_URL',
    );
    const identity = (url) => {
      const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      const host = ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
        ? 'loopback'
        : hostname;
      return `${host}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
    };
    if (identity(business) === identity(recommendation)) {
      throw new Error(
        'RECOMMENDATION_DATABASE_URL must use a separate test database from DATABASE_URL',
      );
    }
  }
}

module.exports = validateTestEnvironment;

if (require.main === module) {
  try {
    validateTestEnvironment(process.env);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
