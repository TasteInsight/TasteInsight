import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';

export class CampusEmailChallengeDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class CampusOAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  state: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  error?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  error_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  iss?: string;
}

export class CompleteCampusOAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  attemptId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  handoffCode: string;
}

export class CampusLoginDto extends CompleteCampusOAuthDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  loginVerifier: string;
}

export class StudentDecisionDto {
  @IsIn(['APPROVE', 'REJECT', 'REVOKE'])
  decision: 'APPROVE' | 'REJECT' | 'REVOKE';

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsDateString()
  expectedUpdatedAt: string;
}
