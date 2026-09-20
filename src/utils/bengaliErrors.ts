/**
 * Chapter 9: Standard Bengali Error Mapping for Support Verification and Link Operations
 */

export const SUPPORT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'অনুগ্রহ করে প্রথমে লগইন করুন।',
  UNAUTHORIZED: 'অনুগ্রহ করে প্রথমে লগইন করুন।',
  MEMBER_NOT_FOUND: 'আপনার মেম্বার প্রোফাইলটি খুঁজে পাওয়া যায়নি।',
  MEMBER_NOT_ACTIVE: 'আপনার অ্যাকাউন্টটি বর্তমানে সক্রিয় নেই।',
  MEMBER_INACTIVE: 'আপনার অ্যাকাউন্টটি বর্তমানে নিষ্ক্রিয় বা স্থগিত রয়েছে।',
  SUPPORT_NOT_ALLOWED: 'এই মুহূর্তে সাপোর্ট কার্যক্রম অনুমোদিত নয়।',
  TARGET_LINK_NOT_FOUND: 'টার্গেট লিংকটি খুঁজে পাওয়া যায়নি।',
  LINK_NOT_FOUND: 'টার্গেট লিংকটি খুঁজে পাওয়া যায়নি।',
  TARGET_LINK_REMOVED: 'এই লিংকটি বর্তমানে আর সক্রিয় নেই বা রিমুভ করা হয়েছে।',
  TARGET_LINK_INVALID: 'টার্গেট লিংকটি সঠিক নয়।',
  TARGET_LINK_WRONG_DATE: 'শুধুমাত্র আজকের নির্ধারিত তারিখের লিংকে সাপোর্ট দেওয়া যাবে।',
  TARGET_LINK_WRONG_COMMUNITY: 'ভিন্ন কমিউনিটির লিংকে সাপোর্ট দেওয়া সম্ভব নয়।',
  OWN_LINK_NOT_ALLOWED: 'নিজের লিংকে সাপোর্ট দেওয়া যাবে না।',
  SELF_SUPPORT_FORBIDDEN: 'নিজের লিংকে সাপোর্ট দেওয়া যাবে না।',
  ALREADY_SUPPORTED: 'এই লিংকে আপনি ইতিমধ্যে Support সম্পন্ন করেছেন।',
  SUPPORT_SESSION_CLOSED: 'আজকের সাপোর্ট সেশনের নির্ধারিত সময়সীমা সমাপ্ত হয়েছে।',
  SUPPORT_NOT_APPLICABLE: 'এই লিংকটিতে আপনার সাপোর্ট দেওয়ার বাধ্যবাধকতা নেই।',
  DATABASE_CONFLICT: 'সিস্টেমে একই সাথে একাধিক অনুরোধ এসেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
  NETWORK_ERROR: 'ইন্টারনেট সংযোগে ত্রুটি। পুনরায় চেষ্টা করুন।',
  INTERNAL_ERROR: 'সার্ভারে সাময়িক সমস্যা। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  ALL_DONE_NOT_OPEN: 'All Done এখনো শুরু হয়নি। ১৭:০০ BDT-এর পর Submit করতে পারবেন।',
  WINDOW_NOT_OPEN: 'All Done এখনো শুরু হয়নি। ১৭:০০ BDT-এর পর Submit করতে পারবেন।',
  ALL_DONE_TOO_EARLY: 'All Done এখনো শুরু হয়নি। ১৭:০০ BDT-এর পর Submit করতে পারবেন।',
  ALL_DONE_DEADLINE_PASSED: 'All Done দেওয়ার সময়সীমা শেষ হয়ে গেছে।',
  ALL_DONE_ALREADY_SUBMITTED: 'আজকের All Done ইতোমধ্যে দেওয়া হয়েছে।',
  DUPLICATE_ALL_DONE: 'আজকের All Done ইতোমধ্যে দেওয়া হয়েছে।',
  ALL_DONE_SUPPORT_INCOMPLETE: 'আপনার সবগুলো সাপোর্ট এখনো সম্পন্ন হয়নি।',
  SUPPORT_REQUIREMENTS_INCOMPLETE: 'All Done সম্ভব নয়! আপনার সবগুলো সাপোর্ট এখনো সম্পন্ন হয়নি।',
  INCOMPLETE_SUPPORT: 'All Done সম্ভব নয়! আপনার সবগুলো সাপোর্ট এখনো সম্পন্ন হয়নি।',
  ALL_DONE_NOT_ELIGIBLE: 'আপনি All Done দেওয়ার জন্য যোগ্য নন।',
};

export function getBengaliSupportErrorMessage(errorCodeOrMessage?: string): string {
  if (!errorCodeOrMessage) return 'Support Status আপডেট করা যায়নি। আবার চেষ্টা করুন।';

  for (const [code, banglaMsg] of Object.entries(SUPPORT_ERROR_MESSAGES)) {
    if (errorCodeOrMessage.includes(code)) {
      return banglaMsg;
    }
  }

  return errorCodeOrMessage;
}
