/**
 * Bangladesh Standard Time (BDT) Utility
 * Timezone: Asia/Dhaka (UTC+6)
 * Note: Never call Bangladesh time "BST". Always BDT.
 */

export const BDT_TIMEZONE = 'Asia/Dhaka';

/**
 * Returns current Date object represented in Bangladesh Time (UTC+6)
 */
export function getBangladeshNow(): Date {
  const now = new Date();
  // Compute UTC timestamp then add 6 hours for BDT
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 6);
}

/**
 * Returns today's date in YYYY-MM-DD format based on Bangladesh Time
 */
export function getBangladeshDateString(date = getBangladeshNow()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a Date or ISO timestamp into formatted BDT string
 * Example: "04:30 PM BDT", "13 Sep 2026, 04:30 PM BDT"
 */
export function formatToBDT(dateInput: Date | string | number, includeDate = false): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return 'N/A';

    const options: Intl.DateTimeFormatOptions = {
      timeZone: BDT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...(includeDate
        ? {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }
        : {}),
    };

    const formatted = new Intl.DateTimeFormat('en-US', options).format(d);
    return `${formatted} BDT`;
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Checks whether current BDT time is within normal member link submission window:
 * Default: 10:00 AM to 04:50 PM BDT
 */
export function isWithinSubmissionWindow(
  startTime = '10:00',
  endTime = '16:50'
): { isOpen: boolean; message: string } {
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (currentMinutes < startMinutes) {
    return {
      isOpen: false,
      message: `লিংক সাবমিশন শুরু হবে সকাল ১০:০০ টায় (BDT)`,
    };
  }

  if (currentMinutes > endMinutes) {
    return {
      isOpen: false,
      message: `আজকের লিংক সাবমিশন বিকাল ৪:৫০ এ শেষ হয়েছে (BDT)`,
    };
  }

  return {
    isOpen: true,
    message: `লিংক সাবমিশন চালু রয়েছে (বিকাল ৪:৫০ পর্যন্ত BDT)`,
  };
}

/**
 * Checks whether current BDT time is within All Done window:
 * Default: 5:00 PM (17:00) to Midnight (24:00) BDT
 */
export function isWithinAllDoneWindow(
  startTime = '17:00',
  deadlineTime = '24:00'
): { isOpen: boolean; isLate: boolean; message: string } {
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  // Before 5:00 PM BDT
  if (currentMinutes < startMinutes) {
    return {
      isOpen: false,
      isLate: false,
      message: `All Done শুরু হবে বিকাল ৫:০০ টায় (BDT)`,
    };
  }

  // Between 5:00 PM and midnight 12:00 AM
  return {
    isOpen: true,
    isLate: false,
    message: `All Done এখন চালু আছে (রাত ১২:০০ টা পর্যন্ত BDT)`,
  };
}

/**
 * Check if the member is within the 2-minute edit/delete grace period
 */
export function canEditSubmission(submittedAtIso: string): boolean {
  try {
    const subTime = new Date(submittedAtIso).getTime();
    const nowTime = new Date().getTime();
    const diffSeconds = (nowTime - subTime) / 1000;
    return diffSeconds <= 120; // 2 minutes (120 seconds)
  } catch {
    return false;
  }
}

/**
 * Returns remaining seconds for 2-minute edit window
 */
export function getRemainingEditSeconds(submittedAtIso: string): number {
  try {
    const subTime = new Date(submittedAtIso).getTime();
    const nowTime = new Date().getTime();
    const diff = 120 - Math.floor((nowTime - subTime) / 1000);
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}

/**
 * Returns tomorrow's date in YYYY-MM-DD format based on Bangladesh Time
 */
export function getBangladeshTomorrowDateString(): string {
  const tomorrow = getBangladeshNow();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getBangladeshDateString(tomorrow);
}

/**
 * Checks if the member is eligible to schedule tomorrow's link.
 * Business Rule: Scheduling for tomorrow opens at 12:00 PM (noon) BDT on the previous day.
 */
export function canScheduleForTomorrow(): { isAllowed: boolean; message: string; targetDate: string } {
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const noonMinutes = 12 * 60; // 12:00 PM = 720 minutes
  const tomorrowDate = getBangladeshTomorrowDateString();

  if (currentMinutes < noonMinutes) {
    return {
      isAllowed: false,
      message: `পরবর্তী দিনের (${tomorrowDate}) লিংক শিডিউল শুরু হবে আজ দুপুর ১২:০০ টায় (BDT)`,
      targetDate: tomorrowDate,
    };
  }

  return {
    isAllowed: true,
    message: `পরবর্তী দিনের (${tomorrowDate}) জন্য লিংক শিডিউল চালু রয়েছে।`,
    targetDate: tomorrowDate,
  };
}

/**
 * Checks if current Bangladesh Time is within the late recovery window (00:00 to 10:00 BDT).
 * After 10:00 AM BDT, unresolved recovery transitions to Admin Contact Required.
 */
export function isWithinRecoveryWindow(cutoffTime = '10:00'): {
  isRecoveryOpen: boolean;
  isCutoffPassed: boolean;
  message: string;
} {
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);
  const cutoffMinutes = cutoffH * 60 + cutoffM;

  if (currentMinutes < cutoffMinutes) {
    return {
      isRecoveryOpen: true,
      isCutoffPassed: false,
      message: `রিকভারি উইন্ডো সকাল ${cutoffTime} টা পর্যন্ত চালু থাকবে (BDT)`,
    };
  }

  return {
    isRecoveryOpen: false,
    isCutoffPassed: true,
    message: `রিকভারি সময়সীমা (সকাল ${cutoffTime} টা BDT) উত্তীর্ণ হয়েছে। এডমিনের সাথে যোগাযোগ করুন।`,
  };
}
