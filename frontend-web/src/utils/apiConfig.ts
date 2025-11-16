/**
 * API 配置和工具函数
 * 
 * 使用说明：
 * 1. 根据 Apifox 中的接口规范，修改此文件中的配置
 * 2. 在 api.js 中使用这些配置
 */

// ============================================
// 第一步：配置统一的响应格式
// ============================================
// 根据 Apifox 中的实际响应格式修改以下配置

export const API_CONFIG = {
  // 成功状态码（有些接口用 200，有些用 0）
  SUCCESS_CODE: 200,
  
  // 响应数据结构
  RESPONSE_STRUCTURE: {
    // 如果响应格式是 { code, data, message }
    CODE_FIELD: 'code',
    DATA_FIELD: 'data',
    MESSAGE_FIELD: 'message',
    
    // 如果响应格式是 { status, result, msg }
    // CODE_FIELD: 'status',
    // DATA_FIELD: 'result',
    // MESSAGE_FIELD: 'msg',
  },
  
  // 分页响应格式
  PAGINATION_STRUCTURE: {
    // 如果分页数据在 data.list 中
    LIST_FIELD: 'list',        // 或 'items', 'data'
    TOTAL_FIELD: 'total',       // 或 'totalCount'
    PAGE_FIELD: 'page',         // 或 'pageNum'
    PAGE_SIZE_FIELD: 'pageSize', // 或 'page_size'
    TOTAL_PAGES_FIELD: 'totalPages' // 或 'total_pages'
  }
}

// ============================================
// 第二步：配置接口路径和参数
// ============================================

export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/auth/admin/login',
    LOGOUT: '/auth/admin/logout',
    REFRESH_TOKEN: '/auth/admin/refresh'
  },
  
  // 管理员相关
  ADMIN: {
    LIST: '/admin/admins',
    CREATE: '/admin/admins',
    DELETE: '/admin/admins',  // DELETE /admin/admins/{id}
    UPDATE_PERMISSIONS: '/admin/admins'  // PUT /admin/admins/{id}/permissions
  },
  
  // 菜品相关
  DISH: {
    LIST: '/dishes',
    CREATE: '/dishes',
    UPDATE: '/dishes',  // PUT /dishes/{id}
    DELETE: '/dishes',  // DELETE /dishes/{id}
    UPLOAD_EXCEL: '/dishes/upload'
  }
}

// ============================================
// 第三步：响应处理工具函数
// ============================================

/**
 * 处理统一响应格式
 * @param {Object} response - axios 响应对象
 * @returns {*} 返回 data 字段的内容
 */
export function handleApiResponse(response: any) {
  const { CODE_FIELD, DATA_FIELD, MESSAGE_FIELD, SUCCESS_CODE } = {
    ...API_CONFIG.RESPONSE_STRUCTURE,
    SUCCESS_CODE: API_CONFIG.SUCCESS_CODE
  }
  
  const res = response.data || response
  
  // 检查业务状态码
  if (res[CODE_FIELD] !== undefined && res[CODE_FIELD] !== SUCCESS_CODE) {
    const message = res[MESSAGE_FIELD] || '请求失败'
    throw new Error(message)
  }
  
  // 返回 data 字段
  return res[DATA_FIELD] !== undefined ? res[DATA_FIELD] : res
}

/**
 * 处理分页响应
 * @param {Object} response - API 响应
 * @returns {Object} 包含 list, total, page 等字段的对象
 */
export function handlePaginationResponse(response: any) {
  const data = handleApiResponse(response)
  const { LIST_FIELD, TOTAL_FIELD, PAGE_FIELD, PAGE_SIZE_FIELD, TOTAL_PAGES_FIELD } = API_CONFIG.PAGINATION_STRUCTURE
  
  return {
    list: data[LIST_FIELD] || data.items || data.data || [],
    total: data[TOTAL_FIELD] || data.totalCount || 0,
    page: data[PAGE_FIELD] || data.pageNum || 1,
    pageSize: data[PAGE_SIZE_FIELD] || data.page_size || 10,
    totalPages: data[TOTAL_PAGES_FIELD] || data.total_pages || Math.ceil((data[TOTAL_FIELD] || 0) / (data[PAGE_SIZE_FIELD] || 10))
  }
}

/**
 * 构建查询参数字符串
 * @param {Object} params - 参数对象
 * @returns {string} 查询字符串
 */
export function buildQueryString(params: any) {
  const query = new URLSearchParams()
  
  Object.keys(params).forEach(key => {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value)
    }
  })
  
  return query.toString()
}

/**
 * 构建路径参数 URL
 * @param {string} basePath - 基础路径，如 '/admin/admins'
 * @param {string|number} id - 路径参数
 * @param {string} suffix - 可选的后缀，如 '/permissions'
 * @returns {string} 完整路径
 */
export function buildPathUrl(basePath: string, id: string | number, suffix = '') {
  return `${basePath}/${id}${suffix}`
}

// ============================================
// 第四步：使用示例
// ============================================

/*
// 在 api.js 中使用：

import { API_ENDPOINTS, handleApiResponse, handlePaginationResponse, buildQueryString, buildPathUrl } from './apiConfig'

export const api = {
  // 获取管理员列表
  async getAdmins(params = {}) {
    const { page = 1, pageSize = 10 } = params
    const query = buildQueryString({ page, pageSize })
    const response = await request.get(`${API_ENDPOINTS.ADMIN.LIST}?${query}`)
    return handlePaginationResponse(response)
  },
  
  // 创建管理员
  async createAdmin(data) {
    const response = await request.post(API_ENDPOINTS.ADMIN.CREATE, {
      username: data.username,
      password: data.password,
      canteenId: data.canteenId,
      permissions: data.permissions || []
    })
    return handleApiResponse(response)
  },
  
  // 删除管理员
  async deleteAdmin(adminId) {
    const url = buildPathUrl(API_ENDPOINTS.ADMIN.DELETE, adminId)
    const response = await request.delete(url)
    return handleApiResponse(response)
  },
  
  // 更新权限
  async updateAdminPermissions(adminId, permissions) {
    const url = buildPathUrl(API_ENDPOINTS.ADMIN.UPDATE_PERMISSIONS, adminId, '/permissions')
    const response = await request.put(url, { permissions })
    return handleApiResponse(response)
  }
}
*/

