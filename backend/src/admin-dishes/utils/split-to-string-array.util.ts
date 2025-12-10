export const splitToStringArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,，/、;；\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'number') {
    return [String(value)];
  }

  return [];
};
