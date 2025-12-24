/**
 * 页面状态缓存工具
 * 使用sessionStorage保存页面状态，以便在页面间跳转后恢复
 */

interface PageState {
  [key: string]: any
}

const STORAGE_PREFIX = 'page_state_'

/**
 * 保存页面状态
 * @param pageKey 页面唯一标识（如路由路径）
 * @param state 要保存的状态对象
 */
export function savePageState(pageKey: string, state: PageState): void {
  try {
    const storageKey = `${STORAGE_PREFIX}${pageKey}`
    sessionStorage.setItem(storageKey, JSON.stringify(state))
  } catch (error) {
    console.warn('保存页面状态失败:', error)
  }
}

/**
 * 恢复页面状态
 * @param pageKey 页面唯一标识（如路由路径）
 * @param defaultState 默认状态（如果缓存不存在则返回此值）
 * @returns 恢复的状态对象
 */
export function restorePageState<T extends PageState>(
  pageKey: string,
  defaultState: T,
): T {
  try {
    const storageKey = `${STORAGE_PREFIX}${pageKey}`
    const cached = sessionStorage.getItem(storageKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      // 合并默认状态和缓存状态，确保所有字段都存在
      return { ...defaultState, ...parsed }
    }
  } catch (error) {
    console.warn('恢复页面状态失败:', error)
  }
  return defaultState
}

/**
 * 清除页面状态
 * @param pageKey 页面唯一标识（如路由路径）
 */
export function clearPageState(pageKey: string): void {
  try {
    const storageKey = `${STORAGE_PREFIX}${pageKey}`
    sessionStorage.removeItem(storageKey)
  } catch (error) {
    console.warn('清除页面状态失败:', error)
  }
}

/**
 * 清除所有页面状态
 */
export function clearAllPageStates(): void {
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.warn('清除所有页面状态失败:', error)
  }
}

