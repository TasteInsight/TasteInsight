import { BaseResponseDto } from '@/common/dto/response.dto';

// 令牌数据
export class TokenData {
  accessToken: string;
  refreshToken: string;
}

export class LoginResponseData {
  token: TokenData;
  user: any; // 实际使用时会是 User 类型
}

export class LoginResponseDto extends BaseResponseDto<LoginResponseData> {}

export class AdminLoginResponseData {
  token: TokenData;
  admin: any; // 实际使用时会是 Admin 类型（不含密码）
  permissions: string[];
}

export class AdminLoginResponseDto extends BaseResponseDto<AdminLoginResponseData> {}

export class RefreshTokenResponseData {
  token: TokenData;
  user: any; // 可能是 User 或 Admin 类型（不含密码）
}

export class RefreshTokenResponseDto extends BaseResponseDto<RefreshTokenResponseData> {}
