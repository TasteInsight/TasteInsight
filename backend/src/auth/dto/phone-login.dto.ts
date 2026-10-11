import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class PhoneChallengeDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: '手机号须包含国家区号，例如 +8613812345678',
  })
  phone: string;
}

export class VerifyChallengeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  challengeId: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
