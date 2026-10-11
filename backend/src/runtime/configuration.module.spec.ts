import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { RuntimeRole } from '../environment';
import { RuntimeConfigurationModule } from './configuration.module';

const database = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://fixture:dedicated-password@db:5432/role_test',
};
const background = {
  ...database,
  REDIS_HOST: 'redis',
  REDIS_PASSWORD: 'dedicated-redis-password',
};
const api = {
  ...background,
  APP_URL: 'https://api.example.test',
  JWT_SECRET: 'dedicated-access-key'.repeat(2),
  JWT_REFRESH_SECRET: 'dedicated-refresh-key'.repeat(2),
};

describe('runtime configuration composition', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
  });

  it.each<{ role: RuntimeRole; environment: NodeJS.ProcessEnv }>([
    { role: 'migrate', environment: database },
    { role: 'worker', environment: background },
    { role: 'public-api', environment: api },
    { role: 'admin-api', environment: api },
    { role: 'combined', environment: { NODE_ENV: 'test' } },
  ])(
    'boots the $role configuration with only its required values',
    async ({ role, environment }) => {
      process.env = { ...environment };
      const module = await Test.createTestingModule({
        imports: [RuntimeConfigurationModule.forRole(role)],
      }).compile();
      try {
        const config = module.get(ConfigService);
        expect(config.get('NODE_ENV')).toBe(environment.NODE_ENV);
        if (role === 'worker' || role === 'migrate') {
          expect(config.get('JWT_SECRET')).toBeUndefined();
          expect(config.get('AUTH_CHALLENGE_SECRET')).toBeUndefined();
        }
        if (role === 'migrate')
          expect(config.get('REDIS_HOST')).toBeUndefined();
        else expect(config.get('PORT')).toBe(3000);
      } finally {
        await module.close();
      }
    },
  );

  it.each<{
    role: RuntimeRole;
    environment: NodeJS.ProcessEnv;
    invalid: string;
  }>([
    {
      role: 'public-api',
      environment: { ...api, JWT_SECRET: '' },
      invalid: 'JWT_SECRET',
    },
    {
      role: 'admin-api',
      environment: { ...api, JWT_REFRESH_SECRET: '' },
      invalid: 'JWT_REFRESH_SECRET',
    },
    {
      role: 'worker',
      environment: { ...background, REDIS_PASSWORD: '' },
      invalid: 'REDIS_PASSWORD',
    },
    {
      role: 'migrate',
      environment: { ...database, DATABASE_URL: '' },
      invalid: 'DATABASE_URL',
    },
    {
      role: 'migrate',
      environment: { ...database, RUN_SEED: 'true' },
      invalid: 'RUN_SEED',
    },
  ])(
    'rejects invalid $role configuration before providers are instantiated',
    async ({ role, environment, invalid }) => {
      process.env = { ...environment };
      const instantiate = jest.fn(() => ({}));
      await expect(
        Test.createTestingModule({
          imports: [RuntimeConfigurationModule.forRole(role)],
          providers: [
            { provide: 'side-effecting-provider', useFactory: instantiate },
          ],
        }).compile(),
      ).rejects.toThrow(invalid);
      expect(instantiate).not.toHaveBeenCalled();
    },
  );

  it('retains optional service defaults rather than supplying empty strings', async () => {
    process.env = { ...api };
    const module = await Test.createTestingModule({
      imports: [RuntimeConfigurationModule.forRole('public-api')],
    }).compile();
    try {
      const config = module.get(ConfigService);
      expect(config.get('JWT_EXPIRATION_TIME', '3600')).toBe('3600');
      expect(
        config.get('UPLOAD_BASE_URL', 'https://api.example.test/images'),
      ).toBe('https://api.example.test/images');
      expect(config.get('UPLOAD_STORAGE_TYPE', 'local')).toBe('local');
      expect(config.get('EMBEDDING_SERVICE_BATCH_SIZE')).toBe(50);
      expect(config.get('REDIS_REC_DB')).toBe(1);
    } finally {
      await module.close();
    }
  });
});
