export function createDockerDatabaseUrl(
  environment: NodeJS.ProcessEnv,
): string {
  const user = environment.POSTGRES_USER;
  const password = environment.POSTGRES_PASSWORD;
  const database = environment.POSTGRES_DB;

  if (!user) throw new Error('POSTGRES_USER is required');
  if (!password) throw new Error('POSTGRES_PASSWORD is required');
  if (!database) throw new Error('POSTGRES_DB is required');

  const host = environment.POSTGRES_HOST || 'db';
  const port = environment.POSTGRES_PORT || '5432';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('POSTGRES_PORT must be an integer from 1 to 65535');
  }
  let url: URL;
  try {
    url = new URL(`postgresql://${host}:${port}`);
    if (
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname ||
      url.search ||
      url.hash ||
      /[\s/@?#]/.test(host)
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('POSTGRES_HOST must be a hostname or an IP address');
  }
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  url.pathname = `/${encodeURIComponent(database)}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

if (require.main === module) {
  try {
    process.stdout.write(createDockerDatabaseUrl(process.env));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
