const PASSWORD_RESET_PATH = '/reset-password';

function cleanOrigin(value?: string): string {
  const raw = value?.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function getAppOrigin(currentOrigin?: string): string {
  return (
    cleanOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    cleanOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    cleanOrigin(currentOrigin)
  );
}

export function getPasswordResetRedirectUrl(currentOrigin?: string): string {
  const origin = getAppOrigin(currentOrigin);
  return origin ? `${origin}${PASSWORD_RESET_PATH}` : PASSWORD_RESET_PATH;
}
