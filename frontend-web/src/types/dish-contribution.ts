import type { AvailableDate, Floor } from './api'

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'nightsnack'
export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface ContributionFields {
  name: string
  price: number
  priceUnit?: string | null
  description?: string | null
  images?: string[]
  tags?: string[]
  ingredients?: string[]
  allergens?: string[]
  spicyLevel?: number | null
  saltiness?: number | null
  sweetness?: number | null
  oiliness?: number | null
  windowId?: string | null
  availableMealTime?: MealTime[]
  availableDates?: AvailableDate[] | null
}

export type ContributionField = keyof ContributionFields

export interface ContributionLocation {
  canteenId: string
  canteenName: string
  windowName?: string | null
  windowNumber?: string | null
  floorId?: string | null
  floorName?: string | null
  floorLevel?: string | null
  floor?: Floor | null
}

export interface ContributionTargetDish extends ContributionFields, ContributionLocation {
  id: string
  status: 'online' | 'offline'
  updatedAt: string
}

/** 审核资料直接对应上传 DTO，保留其独立身份和版本。 */
export interface DishContribution extends ContributionFields, ContributionLocation {
  id: string
  status: ContributionStatus
  revision: number
  kind: 'create' | 'update'
  targetDishId?: string | null
  approvedDishId?: string | null
  changedFields?: (ContributionField | 'windowName' | 'windowNumber')[]
  baseSnapshot?: Partial<ContributionTargetDish> | null
  targetDish?: ContributionTargetDish | null
  duplicateCandidates?: ContributionTargetDish[]
  rejectReason?: string | null
  parentDishId?: string | null
  parentUploadId?: string | null
  parentDishName?: string | null
  userId?: string | null
  adminId?: string | null
  uploaderType?: 'user' | 'admin'
  uploaderName?: string | null
  createdAt: string
  updatedAt: string
}

export interface ContributionRevision { revision: number }
export type ContributionEditRequest = Partial<ContributionFields> & ContributionRevision & { targetDishUpdatedAt?: string }
export interface ContributionApprovalRequest extends ContributionRevision {
  mergeDishId?: string
  mergeDishUpdatedAt?: string
  mergeFields?: ContributionField[]
}
export interface ContributionRejectionRequest extends ContributionRevision { reason: string }
