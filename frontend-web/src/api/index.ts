import { authApi } from '@/api/modules/auth'
import { dishApi } from '@/api/modules/dish'
import { reviewApi } from '@/api/modules/review'
import { permissionApi } from '@/api/modules/permission'
import { logApi } from '@/api/modules/log'
import { newsApi } from '@/api/modules/news'
import { canteenApi } from '@/api/modules/canteen'
import { configApi } from '@/api/modules/config'
import { recommendApi } from '@/api/modules/recommend'

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
  getDishById: dishApi.getDishById.bind(dishApi),
  createDish: dishApi.createDish.bind(dishApi),
  updateDish: dishApi.updateDish.bind(dishApi),
  deleteDish: dishApi.deleteDish.bind(dishApi),
  batchUpload: dishApi.batchUpload.bind(dishApi),
  updateDishStatus: dishApi.updateDishStatus.bind(dishApi),
  uploadImage: dishApi.uploadImage.bind(dishApi),
  getDishReviews: dishApi.getDishReviews.bind(dishApi),

  // 权限管理
  getAdmins: permissionApi.getAdmins.bind(permissionApi),
  createAdmin: permissionApi.createAdmin.bind(permissionApi),
  deleteAdmin: permissionApi.deleteAdmin.bind(permissionApi),
  updateAdminPermissions: permissionApi.updateAdminPermissions.bind(permissionApi),

  // 审核相关
  getPendingReviews: reviewApi.getPendingReviews.bind(reviewApi),
  approveReview: reviewApi.approveReview.bind(reviewApi),
  rejectReview: reviewApi.rejectReview.bind(reviewApi),
  deleteReview: reviewApi.deleteReview.bind(reviewApi),
  getPendingComments: reviewApi.getPendingComments.bind(reviewApi),
  approveComment: reviewApi.approveComment.bind(reviewApi),
  rejectComment: reviewApi.rejectComment.bind(reviewApi),
  getReports: reviewApi.getReports.bind(reviewApi),
  handleReport: reviewApi.handleReport.bind(reviewApi),
  getPendingUploads: reviewApi.getPendingUploads.bind(reviewApi),
  approveUpload: reviewApi.approveUpload.bind(reviewApi),
  rejectUpload: reviewApi.rejectUpload.bind(reviewApi),
  getDishComments: reviewApi.getDishComments.bind(reviewApi),
  deleteComment: reviewApi.deleteComment.bind(reviewApi),

  // 日志管理
  getLogs: logApi.getLogs.bind(logApi),

  // 新闻管理
  getNews: newsApi.getNews.bind(newsApi),
  createNews: newsApi.createNews.bind(newsApi),
  updateNews: newsApi.updateNews.bind(newsApi),
  deleteNews: newsApi.deleteNews.bind(newsApi),

  // 食堂窗口管理
  getCanteens: canteenApi.getCanteens.bind(canteenApi),
  createCanteen: canteenApi.createCanteen.bind(canteenApi),
  updateCanteen: canteenApi.updateCanteen.bind(canteenApi),
  deleteCanteen: canteenApi.deleteCanteen.bind(canteenApi),
  getWindows: canteenApi.getWindows.bind(canteenApi),
  createWindow: canteenApi.createWindow.bind(canteenApi),
  updateWindow: canteenApi.updateWindow.bind(canteenApi),
  deleteWindow: canteenApi.deleteWindow.bind(canteenApi),

  // 配置管理
  getConfigTemplates: configApi.getTemplates.bind(configApi),
  getGlobalConfig: configApi.getGlobalConfig.bind(configApi),
  updateGlobalConfig: configApi.updateGlobalConfig.bind(configApi),
  getCanteenConfig: configApi.getCanteenConfig.bind(configApi),
  updateCanteenConfig: configApi.updateCanteenConfig.bind(configApi),
  getEffectiveConfig: configApi.getEffectiveConfig.bind(configApi),
  deleteCanteenConfigItem: configApi.deleteCanteenConfigItem.bind(configApi),

  // 推荐系统
  getRecommend: recommendApi.getRecommend.bind(recommendApi),
  getSimilarRecommend: recommendApi.getSimilarRecommend.bind(recommendApi),
  getPersonalRecommend: recommendApi.getPersonalRecommend.bind(recommendApi),
  recordClickEvent: recommendApi.recordClickEvent.bind(recommendApi),
  recordFavoriteEvent: recommendApi.recordFavoriteEvent.bind(recommendApi),
  recordReviewEvent: recommendApi.recordReviewEvent.bind(recommendApi),
  recordDislikeEvent: recommendApi.recordDislikeEvent.bind(recommendApi),
  getEventChain: recommendApi.getEventChain.bind(recommendApi),
  getFunnelAnalytics: recommendApi.getFunnelAnalytics.bind(recommendApi),
  getExperimentGroup: recommendApi.getExperimentGroup.bind(recommendApi),
  getHealth: recommendApi.getHealth.bind(recommendApi),
}

/**
 * 分类导出（推荐使用）
 */
export {
  authApi, // 认证
  dishApi, // 菜品
  reviewApi, // 审核
  permissionApi, // 权限
  logApi, // 日志
  newsApi, // 新闻
  canteenApi, // 食堂
  configApi, // 配置
  recommendApi, // 推荐系统
}

/**
 * 导出类型
 */
export type * from '@/types/api'
