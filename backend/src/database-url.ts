export function createDockerDatabaseUrl(
  environment: NodeJS.ProcessEnv,
): string {
  const user = environment.POSTGRES_USER;
  const password = environment.POSTGRES_PASSWORD;
  const database = environment.POSTGRES_DB;

  if (!user) throw new Error('POSTGRES_USER is required');
  if (!password) throw new Error('POSTGRES_PASSWORD is required');
  if (!database) throw new Error('POSTGRES_DB is required');

  const url = new URL('postgresql://db:5432');
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
