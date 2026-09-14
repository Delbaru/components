// Какие адреса пускаем в ссылку редактора: относительные, http(s) и mailto. Остальное — нет.

export function isAllowedLink(url: string): boolean {
  if (url.startsWith('/')) {
    return true;
  }

  try {
    const parsedUrl = new URL(url.includes('://') ? url : `https://${url}`);
    return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}
