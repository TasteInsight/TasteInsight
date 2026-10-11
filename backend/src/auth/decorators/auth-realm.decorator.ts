import { SetMetadata } from '@nestjs/common';

export type AuthRealm = 'user' | 'admin' | 'combined';
export const AUTH_REALM_KEY = 'auth:realm';
export const AuthRealm = (realm: AuthRealm) =>
  SetMetadata(AUTH_REALM_KEY, realm);
