export type StudentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED'

export interface StudentVerification {
  id: string
  userId: string
  schoolCode: string
  status: StudentVerificationStatus
  method: string
  email: string | null
  emailVerifiedAt: string | null
  verifiedAt: string | null
  expiresAt: string | null
  reviewedAt: string | null
  reason: string | null
  updatedAt: string
  user: { nickname: string }
}

export interface StudentDecision {
  decision: 'APPROVE' | 'REJECT' | 'REVOKE'
  reason: string
  expiresAt?: string
  expectedUpdatedAt: string
}
