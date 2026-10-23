import { BadRequestException } from '@nestjs/common';
import Ajv from 'ajv';
import { canonicalValue, digest } from './strategy-config';

export type ModelParameters = Record<string, number | string | boolean>;
export type ModelParameterProperty = {
  title: string;
  description?: string;
} & (
  | {
      type: 'number' | 'integer';
      default: number;
      minimum: number;
      maximum: number;
    }
  | { type: 'boolean'; default: boolean }
  | { type: 'string'; default: string; enum: string[] }
);
export interface ModelParameterSchema {
  type: 'object';
  additionalProperties: false;
  properties: Record<string, ModelParameterProperty>;
}
export const EMPTY_PARAMETER_SCHEMA: ModelParameterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};
const ajv = new Ajv({
  allErrors: true,
  strictNumbers: true,
  useDefaults: true,
  ownProperties: true,
});
const common = {
  title: { type: 'string', minLength: 1 },
  description: { type: 'string' },
};
const declaration = ajv.compile({
  type: 'object',
  additionalProperties: false,
  required: ['type', 'additionalProperties', 'properties'],
  properties: {
    type: { const: 'object' },
    additionalProperties: { const: false },
    properties: {
      type: 'object',
      propertyNames: {
        pattern: '^[A-Za-z][A-Za-z0-9_]*$',
        not: { enum: ['constructor', 'prototype'] },
      },
      additionalProperties: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'title', 'default', 'minimum', 'maximum'],
            properties: {
              ...common,
              type: { enum: ['number', 'integer'] },
              default: { type: 'number' },
              minimum: { type: 'number' },
              maximum: { type: 'number' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'title', 'default'],
            properties: {
              ...common,
              type: { const: 'boolean' },
              default: { type: 'boolean' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'title', 'default', 'enum'],
            properties: {
              ...common,
              type: { const: 'string' },
              default: { type: 'string' },
              enum: {
                type: 'array',
                minItems: 1,
                uniqueItems: true,
                items: { type: 'string' },
              },
            },
          },
        ],
      },
    },
  },
});

export function parseParameterSchema(
  value: unknown = EMPTY_PARAMETER_SCHEMA,
): ModelParameterSchema {
  if (!declaration(value))
    throw new BadRequestException(
      `模型参数声明无效：${ajv.errorsText(declaration.errors)}`,
    );
  const schema = structuredClone(value) as ModelParameterSchema;
  const validate = parameterValidator(schema);
  if (!validate({}))
    throw new BadRequestException(
      `模型参数默认值无效：${ajv.errorsText(validate.errors)}`,
    );
  return schema;
}
function parameterValidator(schema: ModelParameterSchema) {
  const key = `model-parameters:${digest(schema)}`;
  if (!ajv.getSchema(key)) ajv.addSchema(schema, key);
  return ajv.getSchema(key)!;
}
export function resolveModelParameters(
  schemaValue: unknown,
  value?: unknown,
): ModelParameters {
  const schema = parseParameterSchema(schemaValue);
  const parameters: unknown = value === undefined ? {} : structuredClone(value);
  const validate = parameterValidator(schema);
  if (!validate(parameters))
    throw new BadRequestException(
      `模型参数无效：${ajv.errorsText(validate.errors)}`,
    );
  return canonicalValue(parameters) as ModelParameters;
}
export function sameParameters(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(canonicalValue(left)) ===
    JSON.stringify(canonicalValue(right))
  );
}
