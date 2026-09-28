// 12-hour AM/PM and 24-hour time formatting utilities for Bangladesh Time & Admin UI

export interface Time12Hour {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
}

/**
 * Converts "16:50" or "00:00" string to 12-hour format string: "04:50 PM" or "12:00 AM"
 */
export function convert24To12HourString(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const hDisplay = String(h12).padStart(2, '0');
  const mDisplay = String(m).padStart(2, '0');
  return `${hDisplay}:${mDisplay} ${period}`;
}

/**
 * Converts 12-hour parts (12, 0, 'AM') to "00:00" 24-hour format string
 */
export function convert12To24HourString(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h24 = hour12;
  if (period === 'AM') {
    if (h24 === 12) h24 = 0;
  } else {
    if (h24 < 12) h24 += 12;
  }
  const hDisplay = String(h24).padStart(2, '0');
  const mDisplay = String(minute).padStart(2, '0');
  return `${hDisplay}:${mDisplay}`;
}
