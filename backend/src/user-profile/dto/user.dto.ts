import { UserPreferencesDto, UserSettingsDto } from './update-user-profile.dto';
import { ReviewData } from '@/reviews/dto/review.dto';

export class UserPreferenceData extends UserPreferencesDto {}

export class UserSettingData extends UserSettingsDto {}

export class UserProfileData {
  id: string;
  openId: string;
  nickname: string;
  avatar: string;
  preferences: UserPreferenceData;
  settings: UserSettingData;
  allergens: string[];
  myFavoriteDishes: string[];
  myReviews: string[];
  myComments: string[];
  createdAt: string;
  updatedAt: string;
}

export type UserReviewData = ReviewData & {
  status: string;
  dishName: string;
  dishImage: string;
};
export class UserFavoriteData {
  dishId: string;
  addedAt: string;
  dishName: string;
  dishImages: string[];
  dishPrice: number;
  canteenName: string;
  windowName: string;
  tags: string[];
  averageRating: number;
}
export class UserHistoryData {
  dishId: string;
  viewedAt: string;
  dishName: string;
  dishImages: string[];
  dishPrice: number;
  canteenName: string;
  windowName: string;
  tags: string[];
  averageRating: number;
}
export class UserUploadData {
  id: string;
  name: string;
  canteenName: string;
  price: number;
  status: string;
  rejectReason: string | null;
  createdAt: string;
}

export class UserReportData {
  id: string;
  reporterId: string;
  reporterNickname: string;
  reporter: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
  targetType: string;
  targetId: string;
  type: string;
  reason: string;
  status: string;
  handleResult: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
  handledAt: string | null;
}
