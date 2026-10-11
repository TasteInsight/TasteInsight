function validateTestEnvironment(environment) {
  if (environment.NODE_ENV !== 'test') {
    throw new Error('E2E tests require NODE_ENV=test');
  }
  try {
    const url = new URL(environment.DATABASE_URL);
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
  } catch {
    throw new Error(
      'E2E tests require DATABASE_URL pointing to a separate PostgreSQL database whose name ends in _test',
    );
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
