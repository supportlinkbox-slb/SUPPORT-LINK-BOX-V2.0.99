// Monetag Official SmartLink & Ad Network Configuration
// Replace or configure direct smartlink URL

export const MONETAG_CONFIG = {
  // Your official Monetag Direct SmartLink (High CPM Monetization)
  directLinkUrl: 'https://otieuwou.net/4/8856230',
  
  // Vignette & Cooldown setting
  vignetteCooldownMinutes: 5,
  
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

/**
 * Triggers Monetag SmartLink in a safe new tab without disturbing app state
 */
export const triggerMonetagDirectLink = (customUrl?: string): void => {
  const url = customUrl || getActiveMonetagLink();
  if (!url) return;
  
  try {
    localStorage.setItem(MONETAG_CONFIG.storageKeyLastAd, Date.now().toString());
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('Could not open Monetag link:', err);
  }
};
