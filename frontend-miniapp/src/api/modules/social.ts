import request from '@/utils/request';
import type { ApiResponse, PaginatedData, PaginationParams, ReportRequest } from '@/types/api';

export interface PublicProfile {
  id: string;
  nickname: string;
  avatar: string;
  bio: string;
  isVerifiedStudent: boolean;
  postCount: number;
}

export interface Post {
  id: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  content: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment extends Omit<Post, 'images' | 'commentCount'> {
  postId: string;
  parentComment: { id: string; userId: string; userNickname: string; deleted: boolean } | null;
}

export interface PublicMealPlan {
  id: string;
  startDate: string;
  endDate: string;
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack';
  dishes: {
    id: string;
    name: string;
    images: string[];
    price: number;
    priceUnit?: string;
    canteenName: string;
    windowName: string;
  }[];
}

export type PostInput = { content: string; images: string[] };
const idPath = encodeURIComponent;
export const getPublicProfile = (id: string) =>
  request<PublicProfile>({ url: `/users/${idPath(id)}`, method: 'GET', auth: 'optional' });
export const getPosts = (params: PaginationParams & { authorId?: string } = {}, mine = false) =>
  request<PaginatedData<Post>>({
    url: mine ? '/user/posts' : '/posts',
    method: 'GET',
    auth: mine ? 'required' : 'optional',
    data: params,
  });
export const getPost = (id: string) =>
  request<Post>({ url: `/posts/${idPath(id)}`, method: 'GET', auth: 'optional' });
export const createPost = (data: PostInput) =>
  request<Post>({ url: '/posts', method: 'POST', data });
export const updatePost = (id: string, data: PostInput & { expectedUpdatedAt: string }) =>
  request<Post>({ url: `/posts/${idPath(id)}`, method: 'PUT', data });
export const deletePost = (id: string) =>
  request<null>({ url: `/posts/${idPath(id)}`, method: 'DELETE' });
export const getPostComments = (id: string, params: PaginationParams = {}) =>
  request<PaginatedData<PostComment> & { canReply: boolean }>({
    url: `/posts/${idPath(id)}/comments`,
    method: 'GET',
    auth: 'optional',
    data: params,
  });
export const createPostComment = (
  id: string,
  data: { content: string; parentCommentId?: string }
) => request<PostComment>({ url: `/posts/${idPath(id)}/comments`, method: 'POST', data });
export const deletePostComment = (id: string) =>
  request<null>({ url: `/post-comments/${idPath(id)}`, method: 'DELETE' });
export const setPostLike = (
  id: string,
  liked: boolean
): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> =>
  request({ url: `/posts/${idPath(id)}/like`, method: liked ? 'PUT' : 'DELETE' });
export const setPostCommentLike = (
  id: string,
  liked: boolean
): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> =>
  request({ url: `/post-comments/${idPath(id)}/like`, method: liked ? 'PUT' : 'DELETE' });
export const reportPost = (id: string, data: ReportRequest) =>
  request<null>({ url: `/posts/${idPath(id)}/report`, method: 'POST', data });
export const reportPostComment = (id: string, data: ReportRequest) =>
  request<null>({ url: `/post-comments/${idPath(id)}/report`, method: 'POST', data });
export const getPublicMealPlans = (id: string, params: PaginationParams = {}) =>
  request<{ items: PublicMealPlan[] }>({
    url: `/users/${idPath(id)}/meal-plans`,
    method: 'GET',
    auth: 'optional',
    data: params,
  });
