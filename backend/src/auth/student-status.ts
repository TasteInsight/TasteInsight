export function isCurrentStudent(
  verification:
    | { status: string; expiresAt: Date | string | null }
    | null
    | undefined,
  now = new Date(),
): boolean {
  return (
    !!verification &&
    verification.status === 'VERIFIED' &&
    verification.expiresAt !== null &&
    new Date(verification.expiresAt).getTime() > now.getTime()
  );
}
