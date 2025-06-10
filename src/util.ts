export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export function createUniqueSlug(
  text: string,
  existingSlugs: string[] = []
): string {
  const baseSlug = createSlug(text);
  let uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
  while (existingSlugs.includes(uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
  }

  return uniqueSlug;
}
