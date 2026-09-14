import { MemberProfile, UserRole, MemberStatus } from '../types';

/**
 * Chapter 04 — Central Role, Power & Access Control Model
 * Note: Frontend checks are UI helpers only. All actions are strictly
 * authoritative and verified by PostgreSQL RPCs and RLS in Supabase.
 */

export const isDeveloper = (user: MemberProfile | null | undefined): boolean => {
  return Boolean(user && user.role === 'DEVELOPER' && user.status === 'ACTIVE');
};

export const isAdmin = (user: MemberProfile | null | undefined): boolean => {
  return Boolean(
    user && (user.role === 'ADMIN' || user.role === 'DEVELOPER') && user.status === 'ACTIVE'
  );
};

export const isMember = (user: MemberProfile | null | undefined): boolean => {
  return Boolean(user && user.role === 'MEMBER' && user.status === 'ACTIVE');
};

export const canAccessAdmin = (user: MemberProfile | null | undefined): boolean => {
  return isAdmin(user);
};

export const canAccessDeveloper = (user: MemberProfile | null | undefined): boolean => {
  return isDeveloper(user);
};

export const canManageMembers = (user: MemberProfile | null | undefined): boolean => {
  return isAdmin(user);
};

export const canManageRoles = (user: MemberProfile | null | undefined): boolean => {
  return isAdmin(user);
};

/**
 * Evaluates whether an actor can change the role of a target member
 */
export const canChangeRole = (
  actor: MemberProfile | null | undefined,
  target: MemberProfile | null | undefined,
  newRole: UserRole
): { allowed: boolean; reason?: string } => {
  if (!actor || actor.status !== 'ACTIVE') {
    return { allowed: false, reason: 'লগইন ও সক্রিয় একাউন্ট প্রয়োজন।' };
  }

  if (actor.role !== 'DEVELOPER' && actor.role !== 'ADMIN') {
    return { allowed: false, reason: 'এই কাজটি করার অনুমতি আপনার নেই।' };
  }

  if (!target) {
    return { allowed: false, reason: 'সদস্যটি পাওয়া যায়নি।' };
  }

  // Developer Protection: Normal Admin cannot modify Developer
  if (target.role === 'DEVELOPER' && actor.role !== 'DEVELOPER') {
    return { allowed: false, reason: 'Developer account পরিবর্তন করা যাবে না।' };
  }

  // Admin cannot promote anyone to Developer
  if (newRole === 'DEVELOPER' && actor.role !== 'DEVELOPER') {
    return { allowed: false, reason: 'শুধুমাত্র সিস্টেম পলিসি অনুযায়ী Developer নির্ধারণ করা সম্ভব।' };
  }

  // Cross-community restriction (unless actor is Developer)
  if (
    actor.role !== 'DEVELOPER' &&
    target.community_id &&
    actor.community_id &&
    target.community_id !== actor.community_id
  ) {
    return { allowed: false, reason: 'এই সদস্যকে পরিচালনা করার অনুমতি আপনার নেই।' };
  }

  // Valid role check
  if (!['DEVELOPER', 'ADMIN', 'MEMBER'].includes(newRole)) {
    return { allowed: false, reason: 'অনুমোদিত Role নির্বাচন করুন।' };
  }

  if (target.role === newRole) {
    return { allowed: false, reason: 'সদস্যটি ইতিমধ্যে এই রোলে আছেন।' };
  }

  return { allowed: true };
};

/**
 * Evaluates whether an actor can change the status of a target member
 */
export const canChangeStatus = (
  actor: MemberProfile | null | undefined,
  target: MemberProfile | null | undefined,
  newStatus: MemberStatus
): { allowed: boolean; reason?: string } => {
  if (!actor || actor.status !== 'ACTIVE') {
    return { allowed: false, reason: 'লগইন ও সক্রিয় একাউন্ট প্রয়োজন।' };
  }

  if (actor.role !== 'DEVELOPER' && actor.role !== 'ADMIN') {
    return { allowed: false, reason: 'এই কাজটি করার অনুমতি আপনার নেই।' };
  }

  if (!target) {
    return { allowed: false, reason: 'সদস্যটি পাওয়া যায়নি।' };
  }

  // Developer Protection: Developer accounts cannot be frozen or suspended
  if (target.role === 'DEVELOPER') {
    return { allowed: false, reason: 'Developer account সাসপেন্ড বা ফ্রিজ করা যাবে না।' };
  }

  // Cross-community restriction (unless actor is Developer)
  if (
    actor.role !== 'DEVELOPER' &&
    target.community_id &&
    actor.community_id &&
    target.community_id !== actor.community_id
  ) {
    return { allowed: false, reason: 'এই সদস্যকে পরিচালনা করার অনুমতি আপনার নেই।' };
  }

  // Self-demotion/self-suspension check
  if (actor.id === target.id && (newStatus === 'SUSPENDED' || newStatus === 'FROZEN')) {
    return { allowed: false, reason: 'নিজের অ্যাকাউন্ট সাসপেন্ড বা ফ্রিজ করা সম্ভব নয়।' };
  }

  return { allowed: true };
};
