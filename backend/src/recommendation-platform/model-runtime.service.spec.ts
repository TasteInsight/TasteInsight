import { ModelRuntimeService } from './model-runtime.service';

describe('ModelRuntimeService', () => {
  const model = {
    id: 'm1',
    kind: 'embedding',
    provider: 'http',
    serviceVersion: 'v3',
    artifactDigest: 'sha256:weights',
    featureSchemaVersion: 'dish-user-v1',
    dimension: 2,
    deploymentId: 'ml',
  } as any;
  const identity = {
    version: model.serviceVersion,
    artifactDigest: model.artifactDigest,
    featureSchemaVersion: model.featureSchemaVersion,
  };
  let service: ModelRuntimeService;
  let fetchMock: jest.SpyInstance;
  let cache: any;
  let embedding: any;
  beforeEach(() => {
    const values = new Map();
    cache = {
      getUserEmbedding: jest.fn(async (key) => values.get(key)),
      setUserEmbedding: jest.fn(async (key, vector, version) => {
        values.set(key, { embedding: vector, version });
      }),
    };
    embedding = {
      mapToDishFeatures: (dish) => dish,
      buildDishFeatureText: () => 'dish',
      extractDishNumericFeatures: (dish) => ({ price: dish.price }),
      buildUserFeatureText: (features) => JSON.stringify(features.preferences),
      extractUserNumericFeatures: (features) => ({
        price: features.preferences.price,
      }),
    };
    service = new ModelRuntimeService(
      {
        get: () =>
          JSON.stringify({
            ml: { url: 'https://model.test', token: 'secret', timeoutMs: 1000 },
          }),
      } as any,
      {
        encodeDishFeatures: () => Array(128).fill(0),
        encodeUserFeatures: () => Array(128).fill(0),
      } as any,
      embedding,
      cache,
    );
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ...identity,
        dimension: 2,
        embedding: [0.2, 0.8],
      }),
    } as Response);
  });
  afterEach(() => jest.restoreAllMocks());
  const reply = (payload) =>
    ({ ok: true, json: async () => payload }) as Response;

  it('verifies readiness, kind, complete identity and dimension', async () => {
    const valid = { ...identity, ready: true, kind: 'embedding', dimension: 2 };
    fetchMock.mockResolvedValue(reply(valid));
    await service.verify(model);
    for (const invalid of [
      { ready: false },
      { kind: 'ranking' },
      { version: 'v2' },
      { artifactDigest: 'other' },
      { featureSchemaVersion: 'other' },
      { dimension: 3 },
    ]) {
      fetchMock.mockResolvedValue(reply({ ...valid, ...invalid }));
      await expect(service.verify(model)).rejects.toThrow();
    }
  });

  it.each([
    { version: 'v2' },
    { artifactDigest: 'other' },
    { featureSchemaVersion: 'other' },
    { dimension: 3 },
    { embedding: [1] },
    { embedding: [NaN, 1] },
    { embedding: ['1', 1] },
  ])('rejects an incompatible embedding response %j', async (override) => {
    fetchMock.mockResolvedValue(
      reply({ ...identity, dimension: 2, embedding: [1, 0], ...override }),
    );
    await expect(service.generateDish(model, {})).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads a draft model declaration and refuses declaration drift after verification', async () => {
    const parameterSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        weight: {
          type: 'number',
          title: '权重',
          default: 1,
          minimum: 0,
          maximum: 2,
        },
      },
    };
    fetchMock.mockResolvedValue(
      reply({
        ...identity,
        ready: true,
        kind: 'embedding',
        dimension: 2,
        parameterSchema,
      }),
    );
    expect(await service.verify({ ...model, status: 'draft' })).toEqual(
      parameterSchema,
    );
    await expect(
      service.verify({ ...model, status: 'ready', parameterSchema }),
    ).resolves.toEqual(parameterSchema);
    await expect(service.verify({ ...model, status: 'ready' })).rejects.toThrow(
      'parameter schema mismatch',
    );
  });

  it('binds embedding parameters to the request, output confirmation and cache key', async () => {
    const parameterSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        weight: {
          type: 'number',
          title: '权重',
          default: 1,
          minimum: 0,
          maximum: 2,
        },
      },
    };
    const parameterModel = { ...model, parameterSchema };
    fetchMock.mockImplementation(async (_url, options) => {
      const parameters = JSON.parse(options.body).parameters;
      return reply({
        ...identity,
        parameterSchema,
        appliedParameters: parameters,
        dimension: 2,
        embedding: [1, parameters.weight],
      });
    });
    const user = { userId: 'u', preferences: { price: 10 } } as any;
    expect(await service.generateUser(parameterModel, user)).toEqual([1, 1]);
    expect(
      await service.generateUser(parameterModel, user, { weight: 0 }),
    ).toEqual([1, 0]);
    expect(
      await service.generateUser(parameterModel, user, { weight: 0 }),
    ).toEqual([1, 0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.setUserEmbedding.mock.calls[0][0]).not.toBe(
      cache.setUserEmbedding.mock.calls[1][0],
    );
    fetchMock.mockResolvedValue(
      reply({
        ...identity,
        parameterSchema,
        appliedParameters: { weight: 1 },
        dimension: 2,
        embedding: [1, 1],
      }),
    );
    await expect(
      service.generateDish(parameterModel, {}, { weight: 0 }),
    ).rejects.toThrow('confirm applied parameters');
  });

  it('resolves rank defaults and refuses silent ignored or missing parameter acknowledgements', async () => {
    const parameterSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        reverse: { type: 'boolean', title: '反向', default: true },
      },
    };
    const parameterModel = { ...model, kind: 'ranking', parameterSchema };
    const base = {
      ...identity,
      parameterSchema,
      scores: [{ dishId: 'a', score: 0.3 }],
    };
    fetchMock.mockResolvedValue(
      reply({ ...base, appliedParameters: { reverse: false } }),
    );
    await service.rank(
      parameterModel,
      { preferences: { price: 1 } } as any,
      [{ id: 'a', price: 10 }],
      100,
      { reverse: false },
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).parameters).toEqual({
      reverse: false,
    });
    fetchMock.mockResolvedValue(reply(base));
    await expect(
      service.rank(
        parameterModel,
        { preferences: { price: 1 } } as any,
        [{ id: 'a' }],
        100,
      ),
    ).rejects.toThrow('confirm applied parameters');
    const before = fetchMock.mock.calls.length;
    await expect(
      service.rank(parameterModel, {} as any, [], 100, { reverse: 0 }),
    ).rejects.toThrow('模型参数无效');
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('isolates cache by input, model ID and artifact digest', async () => {
    const user = { userId: 'u', preferences: { price: 10 } } as any;
    await service.generateUser(model, user);
    await service.generateUser(model, user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await service.generateUser(model, { ...user, preferences: { price: 20 } });
    await service.generateUser({ ...model, id: 'm2' }, user);
    fetchMock.mockResolvedValue(
      reply({
        ...identity,
        artifactDigest: 'new',
        dimension: 2,
        embedding: [1, 0],
      }),
    );
    await service.generateUser({ ...model, artifactDigest: 'new' }, user);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      new Set(cache.setUserEmbedding.mock.calls.map((args) => args[0])).size,
    ).toBe(4);
  });

  it.each([
    [{ dishId: 'a', score: 1 }],
    [
      { dishId: 'a', score: 1 },
      { dishId: 'a', score: 2 },
    ],
    [
      { dishId: 'a', score: 1 },
      { dishId: 'unknown', score: 2 },
    ],
    [
      { dishId: 'a', score: Infinity },
      { dishId: 'b', score: 2 },
    ],
  ])('rejects incomplete or invalid rank scores %j', async (...scores) => {
    fetchMock.mockResolvedValue(reply({ ...identity, scores }));
    await expect(
      service.rank(
        { ...model, kind: 'ranking' },
        { preferences: { price: 1 } } as any,
        [{ id: 'a' }, { id: 'b' }],
        100,
      ),
    ).rejects.toThrow();
  });

  it('rejects ranker version drift and HTTP failures without retrying another model', async () => {
    fetchMock.mockResolvedValue(
      reply({
        ...identity,
        version: 'different',
        scores: [{ dishId: 'a', score: 1 }],
      }),
    );
    await expect(
      service.rank(
        { ...model, kind: 'ranking' },
        { preferences: { price: 1 } } as any,
        [{ id: 'a' }],
        100,
      ),
    ).rejects.toThrow('identity mismatch');
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(service.generateDish(model, {})).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts full unordered rank results and binds authentication and explicit identity', async () => {
    fetchMock.mockResolvedValue(
      reply({
        ...identity,
        scores: [
          { dishId: 'b', score: 0.2 },
          { dishId: 'a', score: 0.8 },
        ],
      }),
    );
    const scores = await service.rank(
      { ...model, kind: 'ranking' },
      { preferences: { price: 1 } } as any,
      [{ id: 'a' }, { id: 'b' }],
      100,
    );
    expect(scores.get('a')).toBe(0.8);
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(options.body)).toMatchObject(identity);
    expect(options.redirect).toBe('error');
  });

  it('accepts only the fixed local model contract without HTTP calls', async () => {
    const local = {
      ...model,
      provider: 'local',
      serviceVersion: 'local-v1',
      artifactDigest: 'local-v1',
      featureSchemaVersion: 'dish-user-v1',
      dimension: 128,
    };
    await service.verify(local);
    expect(await service.generateDish(local, {})).toHaveLength(128);
    await expect(
      service.generateDish({ ...local, artifactDigest: 'other' }, {}),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
