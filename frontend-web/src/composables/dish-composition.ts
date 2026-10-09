import { reactive, watch } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import { authSessionVersion } from '@/utils/auth-session'

export const createDishForm = () => ({
  canteenId: '',
  canteen: '',
  floor: '',
  windowId: '',
  windowName: '',
  windowNumber: '',
  name: '',
  price: 0,
  description: '',
  allergens: '',
  ingredients: '',
  imageFiles: [] as Array<{ id: string; file: File; preview: string }>,
  tags: [] as string[],
  spicyLevel: 0,
  saltiness: 0,
  sweetness: 0,
  oiliness: 0,
  servingTime: { breakfast: false, lunch: true, dinner: true, night: true },
  availableDates: [] as Array<{ startDate: string; endDate: string }>,
})

interface SubItemDraft {
  name: string
  tempId: string
  uploadId?: string
  isSubmitting?: boolean
  formData?: ReturnType<typeof createDishForm>
}

export const dishComposition = reactive({
  parentUploadId: null as string | null,
  formData: { ...createDishForm(), subItems: [] as SubItemDraft[] },
})

let compositionVersion = 0

export const getDishCompositionVersion = () => compositionVersion

export const resetDishComposition = () => {
  compositionVersion += 1
  dishComposition.parentUploadId = null
  Object.assign(dishComposition.formData, createDishForm(), { subItems: [] })
}

export const getCompositionSubItem = (parentUploadId: unknown, tempId: unknown) => {
  if (!parentUploadId || dishComposition.parentUploadId !== parentUploadId) return undefined
  return dishComposition.formData.subItems.find((item) => item.tempId === tempId)
}

export const isDishCompositionRoute = (route: RouteLocationNormalized) =>
  route.path === '/single-add' ||
  (route.path === '/add-sub-dish' &&
    !route.query.parentId &&
    Boolean(getCompositionSubItem(route.query.parentUploadId, route.query.subItemTempId)))

watch(authSessionVersion, resetDishComposition, { flush: 'sync' })
