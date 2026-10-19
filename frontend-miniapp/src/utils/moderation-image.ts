export function moderationImageIdentity(value: string): string {
  const path = value.split(/[?#]/)[0];
  return /^https?:\/\/[^?#]+\/content-moderation\/images\/[a-zA-Z0-9_-]{15,80}$/.test(path)
    ? path
    : value;
}
