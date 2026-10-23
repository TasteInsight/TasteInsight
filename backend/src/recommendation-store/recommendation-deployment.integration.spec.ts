import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const integration =
  process.env.RECOMMENDATION_COMPOSE_TEST === '1' ? describe : describe.skip;

integration('recommendation Compose deployment', () => {
  let directory: string;
  let envFile: string;
  const url =
    'postgresql://recommendation:fixture-password@recommendation-db:5432/vectors';
  const backend = resolve(__dirname, '../..');

  beforeAll(() => {
    directory = mkdtempSync(resolve(tmpdir(), 'recommendation-compose-'));
    envFile = resolve(directory, 'selected.env');
    writeFileSync(
      envFile,
      [
        'POSTGRES_USER=business',
        'POSTGRES_PASSWORD=fixture-password',
        'POSTGRES_DB=business',
        'REDIS_PASSWORD=fixture-redis',
        'JWT_SECRET=fixture-access-secret',
        'JWT_REFRESH_SECRET=fixture-refresh-secret',
        'APP_URL=https://api.example.test',
        'ADMIN_APP_URL=https://admin.example.test',
        `RECOMMENDATION_DATABASE_URL=${url}`,
        'PYTHON_EMBEDDING_TOKEN=fixture-model-token',
        'PYTHON_EMBEDDING_ENABLED=false',
        'PYTHON_RANKING_VERSION=ranker-fixture-v1',
        'PYTHON_RANKING_CHECKPOINT=/app/checkpoints/ranker-fixture.pt',
        'RECOMMENDATION_MODEL_DEPLOYMENTS={"fixture":{"url":"http://model:5001"}}',
      ].join('\n'),
    );
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  function compose(files: string[], profiles: string[] = []) {
    return JSON.parse(
      execFileSync(
        'docker',
        [
          'compose',
          '--env-file',
          envFile,
          ...files.flatMap((file) => ['-f', resolve(backend, file)]),
          ...profiles.flatMap((profile) => ['--profile', profile]),
          'config',
          '--format',
          'json',
        ],
        {
          encoding: 'utf8',
          env: { PATH: process.env.PATH, HOME: process.env.HOME },
        },
      ),
    );
  }

  it('routes all roles to the recommendation URL with an isolated data volume', () => {
    const model = compose(['docker-compose.yml'], ['recommendation']);
    for (const role of ['public-api', 'admin-api', 'worker', 'migrate']) {
      expect(model.services[role].environment.RECOMMENDATION_DATABASE_URL).toBe(
        url,
      );
    }
    for (const role of ['public-api', 'admin-api', 'worker']) {
      expect(
        model.services[role].environment.RECOMMENDATION_MODEL_DEPLOYMENTS,
      ).toContain('fixture');
    }
    expect(model.services['recommendation-db'].ports ?? []).toHaveLength(0);
    expect(model.services['recommendation-db'].volumes[0].source).toBe(
      'recommendation-db-data',
    );
    expect(
      model.services.migrate.depends_on['recommendation-db'].condition,
    ).toBe('service_healthy');
  });

  it('passes model authentication and ranking artifact configuration to Python', () => {
    const model = compose(['docker-compose.yml'], ['embedding']);
    expect(model.services['embedding-service'].environment).toMatchObject({
      PYTHON_EMBEDDING_TOKEN: 'fixture-model-token',
      PYTHON_EMBEDDING_ENABLED: 'false',
      PYTHON_RANKING_VERSION: 'ranker-fixture-v1',
      PYTHON_RANKING_CHECKPOINT: '/app/checkpoints/ranker-fixture.pt',
    });
  });

  it('keeps the bundled recommendation database opt-in', () => {
    const model = compose(['docker-compose.yml']);
    expect(model.services['recommendation-db']).toBeUndefined();
    expect(model.services['public-api']).toBeDefined();
  });

  it('supports external databases and an explicitly selected bundled recommendation database', () => {
    const files = ['docker-compose.yml', 'docker-compose.external.yml'];
    expect(compose(files).services['recommendation-db']).toBeUndefined();
    expect(
      compose(files, ['local-recommendation-db']).services['recommendation-db'],
    ).toBeDefined();
  });

  it('binds the host-development recommendation database to loopback', () => {
    const model = compose(['docker-compose.local.yml'], ['recommendation']);
    expect(model.services['recommendation-db'].ports[0]).toMatchObject({
      host_ip: '127.0.0.1',
      published: '5435',
      target: 5432,
    });
  });
});
