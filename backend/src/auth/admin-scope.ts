export interface AdminCanteenScope {
  scope: 'GLOBAL' | 'CANTEENS';
  canteenIds: string[];
}

export function isGlobalScope(admin?: AdminCanteenScope): boolean {
  return !admin || admin.scope === 'GLOBAL';
}

export function canAccessCanteen(
  admin: AdminCanteenScope | undefined,
  canteenId: string | null | undefined,
): boolean {
  return (
    isGlobalScope(admin) ||
    Boolean(canteenId && admin!.canteenIds.includes(canteenId))
  );
}

export function canteenScopeFilter(
  admin?: AdminCanteenScope,
): { in: string[] } | undefined {
  return isGlobalScope(admin) ? undefined : { in: admin!.canteenIds };
}

export function defaultCanteenId(admin: AdminCanteenScope): string | undefined {
  return admin.scope === 'CANTEENS' && admin.canteenIds.length === 1
    ? admin.canteenIds[0]
    : undefined;
}
