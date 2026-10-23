import {
  parseParameterSchema,
  resolveModelParameters,
  EMPTY_PARAMETER_SCHEMA,
} from './model-parameters';

const schema = {
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
    count: {
      type: 'integer',
      title: '数量',
      default: 2,
      minimum: 1,
      maximum: 5,
    },
    enabled: { type: 'boolean', title: '启用', default: true },
    mode: {
      type: 'string',
      title: '模式',
      default: 'balanced',
      enum: ['balanced', 'quality'],
    },
  },
};
describe('model parameter declarations and values', () => {
  it('materializes defaults without mutating caller input and preserves explicit zero/false', () => {
    const input = { weight: 0, enabled: false };
    expect(resolveModelParameters(schema, input)).toEqual({
      weight: 0,
      enabled: false,
      count: 2,
      mode: 'balanced',
    });
    expect(input).toEqual({ weight: 0, enabled: false });
    expect(resolveModelParameters(schema)).toEqual({
      weight: 1,
      enabled: true,
      count: 2,
      mode: 'balanced',
    });
  });
  it.each([
    { weight: '1' },
    { weight: true },
    { weight: -1 },
    { weight: 3 },
    { weight: Infinity },
    { count: 1.2 },
    { enabled: 0 },
    { mode: 'other' },
    { unused: 1 },
    null,
    [],
  ])('rejects incompatible parameters: %j', (value) => {
    expect(() => resolveModelParameters(schema, value)).toThrow('模型参数无效');
  });
  it('keeps legacy models parameter-free', () => {
    expect(parseParameterSchema()).toEqual(EMPTY_PARAMETER_SCHEMA);
    expect(resolveModelParameters(undefined)).toEqual({});
    expect(() => resolveModelParameters(undefined, { weight: 1 })).toThrow();
  });
  it.each([
    { type: 'number', title: 'bad', default: 3, minimum: 0, maximum: 2 },
    { type: 'integer', title: 'bad', default: 1.5, minimum: 0, maximum: 2 },
    { type: 'string', title: 'bad', default: 'missing', enum: ['allowed'] },
    { type: 'number', title: 'bad', default: 1, minimum: 2, maximum: 0 },
    { type: 'object', title: 'nested', default: {} },
  ])(
    'rejects a declaration with unusable defaults or unsupported structure: %j',
    (field) => {
      expect(() =>
        parseParameterSchema({ ...schema, properties: { field } }),
      ).toThrow();
    },
  );
  it('rejects schema extension keywords and prototype property names', () => {
    expect(() =>
      parseParameterSchema({
        ...schema,
        $ref: 'https://external.invalid/schema',
      }),
    ).toThrow();
    expect(() =>
      parseParameterSchema({
        ...schema,
        properties: { constructor: schema.properties.weight },
      }),
    ).toThrow();
  });
});
