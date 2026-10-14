import {
  assertLoginMethodEnabled,
  assertVerificationMethodEnabled,
  type LoginMethod,
  type CampusVerificationMethod,
} from './identity-configuration';

type ChallengeDefinition = (
  | { channel: 'sms' }
  | { channel: 'email'; subject: string; text: (code: string) => string }
) &
  (
    | { loginMethod: LoginMethod }
    | { verificationMethod: CampusVerificationMethod }
  );

const CHALLENGE_PURPOSES = {
  PHONE_LOGIN: { channel: 'sms', loginMethod: 'phone' },
  PHONE_BIND: { channel: 'sms', loginMethod: 'phone' },
  SCHOOL_EMAIL: {
    channel: 'email',
    verificationMethod: 'campusEmail',
    subject: 'TasteInsight 校园邮箱验证码',
    text: (code: string) =>
      `验证码：${code}。5分钟内有效，请勿向他人透露。邮箱验证完成后，学生资格申请需经审核。`,
  },
} satisfies Record<string, ChallengeDefinition>;

export type ChallengePurpose = keyof typeof CHALLENGE_PURPOSES;

export function challengeDefinition(
  purpose: ChallengePurpose,
): ChallengeDefinition {
  return CHALLENGE_PURPOSES[purpose];
}

export function assertChallengeEnabled(
  purpose: ChallengePurpose,
  get: (key: string) => unknown,
): void {
  const definition = challengeDefinition(purpose);
  if ('loginMethod' in definition)
    assertLoginMethodEnabled(definition.loginMethod, get);
  else assertVerificationMethodEnabled(definition.verificationMethod, get);
}
