// 通用响应格式
export class TokenDto {
  accessToken: string;
  refreshToken: string;
}

export class BaseResponseDto<T = any> {
  code: number;
  message: string;
  data: T;
}

export class LoginResponseDataDto {
  token: TokenDto;
  user: any; // 实际使用时会是 User 类型
}

export class LoginResponseDto extends BaseResponseDto<LoginResponseDataDto> {}

export class AdminLoginResponseDataDto {
  token: TokenDto;
  admin: any; // 实际使用时会是 Admin 类型（不含密码）
  permissions: string[];
}

export class AdminLoginResponseDto extends BaseResponseDto<AdminLoginResponseDataDto> {}

export class RefreshTokenResponseDataDto {
  token: TokenDto;
  user: any; // 可能是 User 或 Admin 类型（不含密码）
}

export class RefreshTokenResponseDto extends BaseResponseDto<RefreshTokenResponseDataDto> {}
