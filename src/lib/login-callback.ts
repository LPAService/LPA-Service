/** Accept root-relative destinations only; URL parsing also normalizes dot segments. */
export function getLoginCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value)) {
    return '/';
  }

  const base = 'https://login.invalid';
  try {
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith('//')) return '/';
    if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
