/**
 * Facebook Link Utilities
 * Handles validation, deep linking, and external app opening
 */

export function isValidFacebookUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Validates facebook.com, fb.watch, fb.com, m.facebook.com
  const fbRegex = /^(https?:\/\/)?((www|m|mobile|web)\.)?(facebook\.com|fb\.watch|fb\.me|fb\.com)\/.+$/i;
  return fbRegex.test(trimmed);
}

/**
 * Clean and normalize a Facebook URL
 */
export function normalizeFacebookUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

/**
 * Opens Facebook link externally.
 * Respects user workflow: "Do NOT replace the Facebook app workflow with an in-site Facebook viewer."
 * Opens cleanly in browser / external Facebook app.
 */
export function openFacebookPostExternally(url: string): Window | null {
  const normalized = normalizeFacebookUrl(url);
  if (!normalized) return null;
  return window.open(normalized, '_blank', 'noopener,noreferrer');
}
