import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * 自定义验证器约束：验证结束日期不早于开始日期
 */
@ValidatorConstraint({ name: 'isValidDateRange', async: false })
export class IsValidDateRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = value || (args.object as any);

    if (!object) return true;

    const startDate = object.startDate;
    const endDate = object.endDate;

    // 如果任一字段未提供，跳过验证（因为是可选的）
    if (!startDate || !endDate) return true;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 检查日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }

    return end >= start;
  }

  defaultMessage(args: ValidationArguments) {
    return '结束日期不能早于开始日期';
  }
}

/**
 * 自定义验证器装饰器：验证结束日期不早于开始日期
 * 使用方式：应用在类上
 */
export function IsValidDateRange(validationOptions?: ValidationOptions) {
  return function (target: Function) {
    registerDecorator({
      target: target,
      propertyName: undefined as any, // 类装饰器不需要属性名
      options: validationOptions,
      constraints: [],
      validator: IsValidDateRangeConstraint,
    });
  };
}
