// Monetag Ad Network Helper & SDK Loader for Support Link Box
// Clean, Non-Intrusive, High CPM Monetization

declare global {
  interface Window {
    monetagDirectLink?: string;
    showMonetagVignette?: () => void;
    showMonetagInPagePush?: () => void;
  }
}

export const MONETAG_CONFIG = {
  // Direct SmartLink for Rewards / Interstitial Action triggers
  directLinkUrl: 'https://otieuwou.net/4/8856230', // Fallback or configurable DirectLink
  
  // Vignette / Interstitial trigger cooldown in minutes (prevents annoying spam)
  vignetteCooldownMinutes: 10,
  
  // Storage key to record last interstitial show timestamp
  storageKeyLastAd: 'slb_monetag_last_ad_ts',
};

/**
 * Checks if user is eligible for a non-intrusive interstitial/vignette ad based on cooldown.
 */
export const canShowInterstitial = (): boolean => {
  try {
    const lastAdTs = localStorage.getItem(MONETAG_CONFIG.storageKeyLastAd);
    if (!lastAdTs) return true;
    
    const elapsedMinutes = (Date.now() - parseInt(lastAdTs, 10)) / (1000 * 60);
    return elapsedMinutes >= MONETAG_CONFIG.vignetteCooldownMinutes;
  } catch {
    return true;
  }
};

/**
 * Marks that an ad was shown to reset cooldown.
 */
export const recordAdShown = (): void => {
  try {
    localStorage.setItem(MONETAG_CONFIG.storageKeyLastAd, Date.now().toString());
  } catch {
    // Ignore storage restrictions
  }
};

/**
 * Opens a clean Monetag SmartLink / Rewarded link in a safe tab if configured.
 */
export const triggerMonetagDirectLink = (customUrl?: string): void => {
  const url = customUrl || MONETAG_CONFIG.directLinkUrl;
  if (!url) return;
  
  try {
    recordAdShown();
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('Could not open Monetag direct link:', err);
  }
};
