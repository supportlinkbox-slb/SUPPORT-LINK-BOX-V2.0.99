/**
 * Facebook Link Utilities (Chapter 03 Compliant)
 * Handles validation, deep linking, profile identity extraction & duplicate prevention
 */

export interface FacebookProfileValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
  identityType?: 'numeric_id' | 'username';
  identityKey?: string;
}

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
 * Validates Facebook Profile URL strictly according to Chapter 03 specifications.
 * Rejects Share, Post, Reel, Video, Group, and Story links.
 * Extracts numeric ID (first priority) or normalized username (secondary).
 */
export function validateAndExtractFacebookProfile(rawUrl: string): FacebookProfileValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'ফেসবুক প্রোফাইল লিংক প্রদান করুন।' };
  }

  const normalized = normalizeFacebookUrl(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, error: 'সঠিক ফেসবুক প্রোফাইল লিংক ফরম্যাট নয়।' };
  }

  const host = parsed.hostname.toLowerCase();
  const isFbDomain = host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.me');
  if (!isFbDomain) {
    return { valid: false, error: 'এটি কোনো ফেসবুক লিংক নয়। সঠিক ফেসবুক প্রোফাইল লিংক দিন।' };
  }

  const pathname = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();
  const fullPath = pathname + search;

  // Chapter 03 Section 9 Rejections:
  if (fullPath.includes('/share/') || fullPath.includes('/share/p/')) {
    return { valid: false, error: '⚠️ Post/Share Link নয় — আপনার নিজের Facebook Profile-এর আসল Link দিন।' };
  }
  if (fullPath.includes('/posts/') || fullPath.includes('/posts') || fullPath.includes('permalink.php')) {
    return { valid: false, error: '⚠️ এটি পোস্ট লিংক — আপনার নিজের Facebook Profile-এর আসল Link দিন।' };
  }
  if (fullPath.includes('/reel/') || fullPath.includes('/reels/')) {
    return { valid: false, error: '⚠️ এটি Reel Link — আপনার নিজের Facebook Profile-এর আসল Link দিন।' };
  }
  if (fullPath.includes('/watch') || fullPath.includes('/videos/') || fullPath.includes('/video.php')) {
    return { valid: false, error: '⚠️ এটি Video Link — আপনার নিজের Facebook Profile-এর আসল Link দিন।' };
  }
  if (fullPath.includes('/groups/')) {
    return { valid: false, error: '⚠️ এটি ফেসবুক গ্রুপের লিংক — আপনার নিজের ব্যক্তিগত প্রোফাইল লিংক দিন।' };
  }
  if (fullPath.includes('/stories/')) {
    return { valid: false, error: '⚠️ এটি Story Link — আপনার নিজের Facebook Profile-এর আসল Link দিন।' };
  }
  if (fullPath.includes('/photo.php') || fullPath.includes('/photos/')) {
    return { valid: false, error: '⚠️ এটি Photo Link — আপনার নিজের Facebook Profile-এর আসল Link দিন।' };
  }

  // 1. Check for Numeric Facebook ID (Priority 1: profile.php?id=123456789 or /people/name/123456789)
  const idParam = parsed.searchParams.get('id');
  if (idParam && /^\d+$/.test(idParam.trim())) {
    const numericId = idParam.trim();
    return {
      valid: true,
      normalizedUrl: `https://www.facebook.com/profile.php?id=${numericId}`,
      identityType: 'numeric_id',
      identityKey: numericId,
    };
  }

  const peopleMatch = pathname.match(/\/people\/[^/]+\/(\d+)/i);
  if (peopleMatch && peopleMatch[1]) {
    const numericId = peopleMatch[1];
    return {
      valid: true,
      normalizedUrl: `https://www.facebook.com/profile.php?id=${numericId}`,
      identityType: 'numeric_id',
      identityKey: numericId,
    };
  }

  // 2. Check for Username-based profile (Priority 2: facebook.com/username)
  // Remove leading/trailing slashes
  const segments = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const rawUsername = segments[0] ? decodeURIComponent(segments[0]).trim() : '';

  // Disallow common root paths that are not user profiles
  const disallowedRoots = [
    '',
    'home.php',
    'login',
    'signup',
    'messages',
    'notifications',
    'marketplace',
    'pages',
    'settings',
    'privacy',
    'help',
    'events',
  ];

  if (!rawUsername || disallowedRoots.includes(rawUsername.toLowerCase())) {
    return { valid: false, error: 'সঠিক ফেসবুক প্রোফাইল লিংক দিন (যেমন: facebook.com/your.username)।' };
  }

  // Normalize username: lowercase, alphanumeric + dots
  const normalizedUsername = rawUsername.toLowerCase();

  return {
    valid: true,
    normalizedUrl: `https://www.facebook.com/${rawUsername}`,
    identityType: 'username',
    identityKey: normalizedUsername,
  };
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
