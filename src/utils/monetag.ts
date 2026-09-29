// Monetag Official SmartLink & Ad Network Configuration
// Replace or configure direct smartlink URL

export const MONETAG_CONFIG = {
  // Your official Monetag Direct SmartLink (High CPM Monetization)
  directLinkUrl: 'https://otieuwou.net/4/8856230',
  
  // Vignette & Cooldown setting
  vignetteCooldownMinutes: 5,
  
  cooldownMs: 5 * 60_000,
  dailyCap: 6,
  storageKeyDaily: 'slb_monetag_daily',
  storageKeyLastAd: 'slb_monetag_last_ad_ts',
  storageKeyCustomUrl: 'slb_monetag_custom_directlink',
};

/**
 * Gets currently active SmartLink (from localStorage admin setting or default)
 */
export const getActiveMonetagLink = (): string => {
  try {
    const custom = localStorage.getItem(MONETAG_CONFIG.storageKeyCustomUrl);
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim();
    }
  } catch {}
  return MONETAG_CONFIG.directLinkUrl;
};

/**
 * Sets custom SmartLink from Admin Panel
 */
export const setActiveMonetagLink = (url: string): void => {
  try {
    localStorage.setItem(MONETAG_CONFIG.storageKeyCustomUrl, url.trim());
  } catch {}
};

const bdDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

export const canShowMonetag = (): boolean => {
  try {
    const last = Number(localStorage.getItem(MONETAG_CONFIG.storageKeyLastAd) || 0);
    if (Date.now() - last < MONETAG_CONFIG.cooldownMs) return false;
    const d = JSON.parse(localStorage.getItem(MONETAG_CONFIG.storageKeyDaily) || '{}');
    return d.day !== bdDay() || (d.count ?? 0) < MONETAG_CONFIG.dailyCap;
  } catch {
    return true;
  }
};

export const triggerMonetagDirectLink = (customUrl?: string, force = false): boolean => {
  const url = customUrl || getActiveMonetagLink();
  if (!url || (!force && !canShowMonetag())) return false;
  try {
    if (new URL(url).protocol !== 'https:') return false;
    const d = JSON.parse(localStorage.getItem(MONETAG_CONFIG.storageKeyDaily) || '{}');
    const day = bdDay();
    localStorage.setItem(MONETAG_CONFIG.storageKeyLastAd, String(Date.now()));
    localStorage.setItem(
      MONETAG_CONFIG.storageKeyDaily,
      JSON.stringify({ day, count: d.day === day ? (d.count ?? 0) + 1 : 1 })
    );
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
};
