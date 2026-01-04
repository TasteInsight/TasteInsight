import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 管理员信息接口
 * 与 AdminAuthGuard 中设置的 request['admin'] 结构一致
 */
export interface AdminInfo {
  /** 管理员ID */
  id: string;
  /** 管理员用户名 */
  username: string;
  /** 管理员角色 */
  role: string;
  /** 管理员所属食堂ID（null 表示超级管理员，无食堂限制） */
  canteenId: string | null;
  /** 管理员权限列表 */
  permissions: string[];
}

/**
 * 获取当前登录管理员信息的参数装饰器
 *
 * @example
 * // 在控制器中使用
 * @Get()
 * async findAll(@CurrentAdmin() admin: AdminInfo) {
 *   return this.service.findAll(admin);
 * }
 *
 * // 也可以只获取特定属性
 * @Get()
 * async findAll(@CurrentAdmin('id') adminId: string) {
 *   return this.service.findAll(adminId);
 * }
 */
export const CurrentAdmin = createParamDecorator(
  (data: keyof AdminInfo | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const admin = request.admin as AdminInfo;

    // 如果指定了特定属性，只返回该属性
    if (data) {
      return admin?.[data];
    }

    return admin;
  },
);
