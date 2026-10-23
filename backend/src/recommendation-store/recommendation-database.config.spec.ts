import { ConfigService } from '@nestjs/config';
import { validateEnvironment } from '../environment';
import { recommendationDatabaseUrl } from './recommendation-database.config';
import { RecommendationStoreService } from './recommendation-store.service';

describe('recommendation database configuration', () => {
  const business = 'postgresql://business:secret@localhost:5432/business';

  it.each([undefined, '', '  '])(
    'disables the store when the URL is %s',
    (value) => {
      expect(recommendationDatabaseUrl(value, business)).toBeUndefined();
    },
  );

  it.each([
    'postgres://other:secret@localhost/business?schema=vectors',
    'postgresql://business:secret@127.0.0.1:5432/business?schema=public',
    'postgresql://other:secret@[::1]/%62usiness?schema=other',
  ])(
    'rejects a second schema or account in the same business database',
    (value) => {
      expect(() => recommendationDatabaseUrl(value, business)).toThrow(
        'separate database',
      );
      expect(
        () =>
          new RecommendationStoreService(
            new ConfigService({
              DATABASE_URL: business,
              RECOMMENDATION_DATABASE_URL: value,
            }),
          ),
      ).toThrow('separate database');
    },
  );

  it('accepts separate databases in the same instance and independent instances', () => {
    const sameInstance = 'postgresql://rec:secret@localhost/vectors';
    const separateInstance =
      'postgresql://rec:secret@recommendation-db/business';
    expect(recommendationDatabaseUrl(sameInstance, business)).toBe(
      sameInstance,
    );
    expect(recommendationDatabaseUrl(separateInstance, business)).toBe(
      separateInstance,
    );
  });

  it.each([
    'https://localhost/vectors',
    'postgresql://localhost/',
    'postgresql://localhost/one/two',
  ])('rejects malformed PostgreSQL URL %s', (value) => {
    expect(() => recommendationDatabaseUrl(value, business)).toThrow(
      'PostgreSQL URL',
    );
  });

  it('validates production credentials', () => {
    expect(() =>
      recommendationDatabaseUrl(
        'postgresql://rec:change-me@localhost/vectors',
        business,
        true,
      ),
    ).toThrow('credentials');
  });

  it.each([
    'public-api',
    'admin-api',
    'worker',
    'migrate',
    'combined',
  ] as const)('checks database separation for %s', (role) => {
    expect(() =>
      validateEnvironment(
        {
          NODE_ENV: 'test',
          DATABASE_URL: business,
          RECOMMENDATION_DATABASE_URL: business,
        },
        role,
      ),
    ).toThrow('separate database');
  });
});
