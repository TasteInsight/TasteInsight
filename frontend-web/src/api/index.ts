/**
 * API 统一导出
 * 
 * 使用方式：
 * import { api } from '@/api'
 * 
 * 或者按需导入：
 * import { authApi, dishApi, adminApi } from '@/api'
 */

import { authApi } from './auth'
import { dishApi } from './dish'
import { adminApi } from './admin'

/**
 * 统一 API 对象
 * 保持向后兼容，原有的 api.xxx 调用方式仍然可用
 */
export const api = {
  // 认证相关
  adminLogin: authApi.adminLogin.bind(authApi),
  adminLogout: authApi.adminLogout.bind(authApi),
  refreshToken: authApi.refreshToken.bind(authApi),
  
  // 菜品相关
  getDishes: dishApi.getDishes.bind(dishApi),
  addDish: dishApi.addDish.bind(dishApi),
  updateDish: dishApi.updateDish.bind(dishApi),
  deleteDish: dishApi.deleteDish.bind(dishApi),
  uploadExcel: dishApi.uploadExcel.bind(dishApi),
  
  // 管理员相关
  getAdmins: adminApi.getAdmins.bind(adminApi),
  createAdmin: adminApi.createAdmin.bind(adminApi),
  deleteAdmin: adminApi.deleteAdmin.bind(adminApi),
  updateAdminPermissions: adminApi.updateAdminPermissions.bind(adminApi),
  resetAdminPassword: adminApi.resetAdminPassword.bind(adminApi)
}

/**
 * 分类导出（推荐使用）
 */
export { authApi, dishApi, adminApi }

/**
 * 导出类型
 */
export type * from './types'

/**
 * 导出 axios 实例（如果需要直接使用）
 */
export { default as request } from './request'

export default api

