import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * 自定义验证器约束：验证范围对象中 min <= max
 */
@ValidatorConstraint({ name: 'isValidRange', async: false })
export class IsValidRangeConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true; // 如果值为空（可选字段），跳过验证
    if (typeof value !== 'object') return false;

    const { min, max } = value;
    if (typeof min !== 'number' || typeof max !== 'number') {
      return false;
    }
    return min <= max;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} 范围无效：min 必须小于或等于 max`;
  }
}

/**
 * 自定义验证器装饰器：验证范围对象中 min <= max
 * 使用方式：直接应用在范围类型的属性上
 */
export function IsValidRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidRangeConstraint,
    });
  };
}
