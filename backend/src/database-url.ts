import { config as dotenv } from 'dotenv';
import { resolve } from 'node:path';

export function resolveDatabaseUrl(
  environment: Record<string, unknown>,
): string {
  if (environment.DATABASE_URL !== undefined) {
    if (
      typeof environment.DATABASE_URL !== 'string' ||
      !environment.DATABASE_URL.trim()
    ) {
      throw new Error('DATABASE_URL must be a nonempty string');
    }
    return environment.DATABASE_URL;
  }
  const field = (name: string, fallback?: string): string => {
    const value = environment[name] ?? fallback;
    if (typeof value !== 'string' || !value)
      throw new Error(`${name} is required`);
    return value;
  };
  const user = field('POSTGRES_USER');
  const password = field('POSTGRES_PASSWORD');
  const database = field('POSTGRES_DB');
  const host = field('POSTGRES_HOST', 'localhost');
  const port = field('POSTGRES_PORT', '5432');
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
  const sslmode = environment.POSTGRES_SSLMODE;
  if (sslmode) {
    if (
      typeof sslmode !== 'string' ||
      !['disable', 'prefer', 'require'].includes(sslmode)
    ) {
      throw new Error('POSTGRES_SSLMODE is invalid');
    }
    url.searchParams.set('sslmode', sslmode);
  }
  return url.toString();
}

/** Apply the same development configuration to Prisma CLI and maintenance tools. */
export function loadDatabaseEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  directory = process.cwd(),
): void {
  if (
    environment.NODE_ENV !== 'production' &&
    environment.NODE_ENV !== 'test'
  ) {
    const result = dotenv({
      path: resolve(directory, '.env'),
      processEnv: environment as Record<string, string>,
      quiet: true,
    });
    if (
      result.error &&
      (result.error as NodeJS.ErrnoException).code !== 'ENOENT'
    )
      throw result.error;
  }
  // Client generation needs no connection. Resolve only configured database inputs.
  if (
    environment.DATABASE_URL !== undefined ||
    environment.POSTGRES_USER !== undefined ||
    environment.POSTGRES_PASSWORD !== undefined ||
    environment.POSTGRES_DB !== undefined
  ) {
    environment.DATABASE_URL = resolveDatabaseUrl(environment);
  }
}

if (require.main === module) {
  try {
    process.stdout.write(resolveDatabaseUrl(process.env));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
