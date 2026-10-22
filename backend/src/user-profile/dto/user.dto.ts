import { UserPreferencesDto, UserSettingsDto } from './update-user-profile.dto';
import { ReviewData } from '@/reviews/dto/review.dto';

export class UserPreferenceData extends UserPreferencesDto {}

export class UserSettingData extends UserSettingsDto {}

export class UserProfileData {
  id: string;
  openId: string | null;
  nickname: string;
  avatar: string;
  bio?: string;
  capabilities?: { canContribute: boolean };
  publicProfileSubmission?: {
    status: string;
    fields: Record<string, string | null>;
    reason: string | null;
  } | null;
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
  dishNameEn?: string | null;
  dishImage: string;
};
export class UserFavoriteData {
  dishId: string;
  addedAt: string;
  dishName: string;
  dishNameEn?: string | null;
  dishImages: string[];
  dishPrice: number;
  priceUnit: string | null;
  status: string;
  calories?: number | null;
  protein?: number | null;
  carbohydrate?: number | null;
  fat?: number | null;

  canteenName: string;
  windowName: string;
  tags: string[];
  averageRating: number;
}
export class UserHistoryData {
  dishId: string;
  viewedAt: string;
  dishName: string;
  dishNameEn?: string | null;
  dishImages: string[];
  dishPrice: number;
  priceUnit: string | null;
  status: string;
  calories?: number | null;
  protein?: number | null;
  carbohydrate?: number | null;
  fat?: number | null;

  canteenName: string;
  windowName: string;
  tags: string[];
  averageRating: number;
}
export class UserUploadData {
  calories: number | null;
  protein: number | null;
  carbohydrate: number | null;
  fat: number | null;

  id: string;
  name: string;
  nameEn?: string | null;
  descriptionEn?: string | null;
  images: string[];
  canteenName: string;
  windowName: string;
  price: number;
  priceUnit: string | null;
  status: string;
  rejectReason: string | null;
  kind: string;
  targetDishId: string | null;
  approvedDishId: string | null;
  revision: number;
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
