export type CommunityContentType = 'posts' | 'post-comments'
export type CommunityStatus = 'pending' | 'approved' | 'rejected'

export interface CommunityContent {
  id: string
  userId: string
  userNickname: string
  userAvatar: string | null
  content: string
  images?: string[]
  status: CommunityStatus
  rejectReason: string | null
  createdAt: string
  updatedAt: string
  postId?: string
  parentCommentId?: string | null
}

export interface CommunityQuery {
  page: number
  pageSize: number
  status?: CommunityStatus
  authorId?: string
}

export interface CommunityModeration {
  expectedUpdatedAt: string
}
