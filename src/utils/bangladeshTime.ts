/**
 * Bangladesh Standard Time (BDT) Utility
 * Timezone: Asia/Dhaka (UTC+6)
 * Note: Never call Bangladesh time "BST". Always BDT.
 */

export const BDT_TIMEZONE = 'Asia/Dhaka';

/**
 * Returns current Date object represented in Bangladesh Time (Asia/Dhaka, UTC+6)
 * Uses exact UTC offset arithmetic to avoid locale-string parsing quirks across browsers.
 */
export function getBangladeshNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdtMs = utcMs + (6 * 3600000);
  return new Date(bdtMs);
}

/**
 * Returns today's date in YYYY-MM-DD format based on Bangladesh Time (Asia/Dhaka)
 */
export function getBangladeshDateString(inputDate?: Date | string): string {
  const date = inputDate ? (typeof inputDate === 'string' ? new Date(inputDate) : inputDate) : new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: BDT_TIMEZONE }).format(date);
  } catch {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bdt = new Date(utcMs + (6 * 3600000));
    const y = bdt.getFullYear();
    const m = String(bdt.getMonth() + 1).padStart(2, '0');
    const d = String(bdt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
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
 * Standard message when member finishes support obligations before 5:00 PM BDT
 */
export const ALL_DONE_EARLY_COMPLETION_MESSAGE =
  'আপনার প্রয়োজনীয় Support সম্পন্ন হয়েছে। তবে All Done এখনও শুরু হয়নি। বিকেল ৫টা পর্যন্ত অপেক্ষা করুন। এই সময়ের মধ্যে আরও Member Link Submit করতে পারে।';

/**
 * Checks whether current BDT time is within normal member link submission window:
 * Rule 1: Normal Member Link Submission Time: 10:00 AM -> 04:50 PM BDT
 * Rule 2: Admin Last 10 Minutes Window: 04:51 PM -> 04:59 PM BDT (Admin/VIP/Notice links)
 */
export function isWithinSubmissionWindow(
  startTime = '10:00',
  endTime = '16:50'
): { isOpen: boolean; isAdminWindow: boolean; windowType: 'CLOSED' | 'MEMBER' | 'ADMIN_SPECIAL'; message: string } {
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  // SLB-FIX-M5: second-granularity close so the UI matches the server's 16:50:00.000 cutoff
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM; // 10:00 AM = 600 min
  const endMinutes = endH * 60 + endM; // 04:50 PM = 1010 min
  const endSeconds = endH * 3600 + endM * 60; // 16:50:00 sharp

  const adminStartMinutes = 16 * 60 + 51; // 04:51 PM = 1011 min
  const adminEndMinutes = 16 * 60 + 59;   // 04:59 PM = 1019 min

  // Admin last 10 minutes reserved window (04:51 PM to 04:59 PM BDT)
  if (currentMinutes >= adminStartMinutes && currentMinutes <= adminEndMinutes) {
    return {
      isOpen: false, // Closed for normal members
      isAdminWindow: true,
      windowType: 'ADMIN_SPECIAL',
      message: 'এডমিন স্পেশাল লিংক সাবমিশন উইন্ডো (০৪:৫১ - ০৪:৫৯ PM BDT)',
    };
  }

  if (currentMinutes < startMinutes) {
    return {
      isOpen: false,
      isAdminWindow: false,
      windowType: 'CLOSED',
      message: `লিংক সাবমিশন শুরু হবে সকাল ১০:০০ টায় (BDT)`,
    };
  }

  if (currentSeconds >= endSeconds) {
    return {
      isOpen: false,
      isAdminWindow: false,
      windowType: 'CLOSED',
      message: `আজকের সাধারণ লিংক সাবমিশন বিকাল ৪:৫০ এ শেষ হয়েছে (BDT)`,
    };
  }

  return {
    isOpen: true,
    isAdminWindow: false,
    windowType: 'MEMBER',
    message: `লিংক সাবমিশন চালু রয়েছে (বিকাল ৪:৫০ পর্যন্ত BDT)`,
  };
}

/**
 * Checks whether current BDT time is within Admin special submission window (04:51 PM to 04:59 PM BDT)
 */
export function isWithinAdminSubmissionWindow(): boolean {
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= (16 * 60 + 51) && currentMinutes <= (16 * 60 + 59);
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
  const startMinutes = (startH || 0) * 60 + (startM || 0);

  let [deadH, deadM] = deadlineTime.split(':').map(Number);
  if (deadH === 24 || deadH === 0) deadH = 24;
  const deadlineMinutes = (deadH || 24) * 60 + (deadM || 0);

  // Before startTime (e.g. before 5:00 PM BDT)
  if (currentMinutes < startMinutes) {
    return {
      isOpen: false,
      isLate: false,
      message: `All Done শুরু হবে বিকাল ${startTime} টায় (BDT)`,
    };
  }

  // After deadlineTime
  if (currentMinutes >= deadlineMinutes) {
    return {
      isOpen: false,
      isLate: true,
      message: `All Done সময়সীমা শেষ হয়েছে (${deadlineTime} BDT)`,
    };
  }

  // Between startTime and deadline
  return {
    isOpen: true,
    isLate: false,
    message: `All Done এখন চালু আছে (${deadlineTime} পর্যন্ত BDT)`,
  };
}

/**
 * SLB-FIX-M6: honor the server-provided can_edit_until (no extra +120s).
 * Falls back to submitted_at + 2 minutes when the server value is absent.
 */
export function canEditSubmission(canEditUntilIso?: string | null, submittedAtIso?: string | null): boolean {
  try {
    const nowTime = new Date().getTime();
    if (canEditUntilIso) {
      return nowTime <= new Date(canEditUntilIso).getTime();
    }
    if (submittedAtIso) {
      return (nowTime - new Date(submittedAtIso).getTime()) / 1000 <= 120;
    }
    return false;
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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getBangladeshDateString(tomorrow);
}

/**
 * Checks if the member is eligible to setup a schedule.
 * Rule: Schedule setup is available at ANY TIME (morning, noon, evening, night).
 */
export function canScheduleForTomorrow(): { isAllowed: boolean; message: string; targetDate: string } {
  const tomorrowDate = getBangladeshTomorrowDateString();
  return {
    isAllowed: true,
    message: `ভবিষ্যৎ তারিখের (${tomorrowDate}) জন্য লিংক শিডিউল চালু রয়েছে।`,
    targetDate: tomorrowDate,
  };
}

/**
 * Validates scheduled execution time.
 * Rule: Scheduled Execution Time MUST be between 12:00 PM (12:00) and 04:00 PM (16:00) BDT.
 * Target execution before 12:00 PM (e.g. 10:00 AM - 11:59 AM) or after 04:00 PM is REJECTED.
 */
export function isValidScheduledExecutionTime(timeStr?: string): { isValid: boolean; message: string } {
  if (!timeStr) {
    return {
      isValid: false,
      message: 'অনুগ্রহ করে শিডিউল পোস্টের সময় নির্বাচন করুন (১২:০০ PM হতে ০৪:০০ PM BDT)।',
    };
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = (hours || 0) * 60 + (minutes || 0);

  const minAllowed = 12 * 60; // 12:00 PM = 720 minutes
  const maxAllowed = 16 * 60; // 04:00 PM = 960 minutes

  if (totalMinutes < minAllowed) {
    return {
      isValid: false,
      message: 'শিডিউল লিংক শুধুমাত্র দুপুর ১২:০০ PM বা তার পরে এক্সিকিউশনের জন্য নির্ধারিত করা যাবে। (সকাল ১০:০০ - ১১:৫৯ AM সাধারণ সদস্যদের লাইভ সাবমিশন উইন্ডো)',
    };
  }

  if (totalMinutes > maxAllowed) {
    return {
      isValid: false,
      message: 'শিডিউল লিংক বিকাল ০৪:০০ PM-এর পরে নির্ধারণ করা যাবে না (০৪:০০ PM কাটঅফ)।',
    };
  }

  return {
    isValid: true,
    message: 'বৈধ শিডিউল সময়সীমা।',
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
