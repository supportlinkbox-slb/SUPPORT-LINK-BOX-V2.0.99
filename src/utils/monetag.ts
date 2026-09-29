// Monetag & Ads Disabled completely
export const MONETAG_CONFIG = {
  directLinkUrl: '',
  vignetteCooldownMinutes: 999999,
  cooldownMs: 999999999,
  dailyCap: 0,
  storageKeyDaily: 'slb_monetag_daily',
  storageKeyLastAd: 'slb_monetag_last_ad_ts',
  storageKeyCustomUrl: 'slb_monetag_custom_directlink',
};

export const getActiveMonetagLink = (): string => '';
export const setActiveMonetagLink = (_url: string): void => {};
export const canShowMonetag = (): boolean => false;

export const triggerMonetagDirectLink = (_customUrl?: string, _force = false): boolean => {
  // All ads strictly disabled
  return false;
};
