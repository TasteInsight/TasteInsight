import { authApi } from '@/api/modules/auth'
import { dishApi } from '@/api/modules/dish'
import { adminApi } from '@/api/modules/admin'

/**
 * 统一 API 对象
 * 保持向后兼容，原有的 api.xxx 调用方式仍然可用
 */
export const api = {
  // 认证相关
  adminLogin: authApi.adminLogin.bind(authApi),
  refreshToken: authApi.refreshToken.bind(authApi),
  
  // 菜品相关
  getDishes: dishApi.getDishes.bind(dishApi),
  createDish: dishApi.createDish.bind(dishApi),
  updateDish: dishApi.updateDish.bind(dishApi),
  deleteDish: dishApi.deleteDish.bind(dishApi),
  batchUpload: dishApi.batchUpload.bind(dishApi),
  updateDishStatus: dishApi.updateDishStatus.bind(dishApi),
  
  // 管理员相关
  getAdmins: adminApi.getAdmins.bind(adminApi),
  createAdmin: adminApi.createAdmin.bind(adminApi),
  deleteAdmin: adminApi.deleteAdmin.bind(adminApi),
  updateAdminPermissions: adminApi.updateAdminPermissions.bind(adminApi),
  
  // 审核相关
  getPendingReviews: adminApi.getPendingReviews.bind(adminApi),
  approveReview: adminApi.approveReview.bind(adminApi),
  rejectReview: adminApi.rejectReview.bind(adminApi),
  getPendingComments: adminApi.getPendingComments.bind(adminApi),
  approveComment: adminApi.approveComment.bind(adminApi),
  rejectComment: adminApi.rejectComment.bind(adminApi),
  getReports: adminApi.getReports.bind(adminApi),
  handleReport: adminApi.handleReport.bind(adminApi),
  getPendingUploads: adminApi.getPendingUploads.bind(adminApi),
  approveUpload: adminApi.approveUpload.bind(adminApi),
  rejectUpload: adminApi.rejectUpload.bind(adminApi),
  
  // 其他管理功能
  getLogs: adminApi.getLogs.bind(adminApi),
  getNews: adminApi.getNews.bind(adminApi),
  getCanteens: adminApi.getCanteens.bind(adminApi),
  getWindows: adminApi.getWindows.bind(adminApi),
}

/**
 * 分类导出（推荐使用）
 */
export { authApi, dishApi, adminApi }

/**
 * 导出类型
 */
export type * from '@/types/api'

