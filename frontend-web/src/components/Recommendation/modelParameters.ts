import type { ModelParameters, ModelParameterSchema } from '@/api/modules/recommendation'

export function modelParameterDefaults(schema?: ModelParameterSchema): ModelParameters {
  return Object.fromEntries(
    Object.entries(schema?.properties ?? {}).map(([name, field]) => [name, field.default]),
  )
}

// Mirror the declared input constraints for immediate feedback; the server validates saved values.
export function modelParameterErrors(
  schema: ModelParameterSchema | undefined,
  values: unknown,
): Record<string, string> {
  if (values === undefined) return {}
  if (!values || typeof values !== 'object' || Array.isArray(values))
    return { parameters: '模型参数须为 JSON 对象' }
  const errors: Record<string, string> = Object.create(null)
  const fields = schema?.properties ?? {}
  for (const [name, value] of Object.entries(values)) {
    const field = Object.prototype.hasOwnProperty.call(fields, name) ? fields[name] : undefined
    if (!field) errors[name] = `模型未声明参数 ${name}`
    else if (field.type === 'number' || field.type === 'integer') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (field.type === 'integer' && !Number.isInteger(value)) ||
        value < field.minimum ||
        value > field.maximum
      )
        errors[name] =
          `${field.title}须为 ${field.minimum} 至 ${field.maximum} 之间的${field.type === 'integer' ? '整数' : '数值'}`
    } else if (field.type === 'boolean' && typeof value !== 'boolean')
      errors[name] = `${field.title}须为布尔值`
    else if (field.type === 'string' && (typeof value !== 'string' || !field.enum.includes(value)))
      errors[name] = `${field.title}须选择：${field.enum.join('、')}`
  }
  return errors
}
