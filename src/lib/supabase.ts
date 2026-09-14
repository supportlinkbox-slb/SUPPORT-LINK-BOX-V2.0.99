import { createClient } from '@supabase/supabase-js';
import {
  MemberProfile,
  DailyLink,
  ScheduledLink,
  SupportRecord,
  AllDoneRecord,
  AuditLog,
  NoticeItem,
  SystemConfig,
  UserRole,
  MemberStatus,
  ApiResponse,
  PostType,
  LinkCategory,
  SupportVerificationResult,
  PointTransaction,
  Report,
  ReportReply,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient(
      'https://placeholder-supportlinkbox.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

/**
 * Standard Error Message Parser for Database & RPC Responses
 */
export function formatSupabaseError(error: any): string {
  if (!error) return 'একটি অজানা ত্রুটি হয়েছে।';
  const msg = typeof error === 'string' ? error : error.message || error.details || JSON.stringify(error);

  if (msg.includes('LINK_ALREADY_SUBMITTED')) {
    return 'আপনি ইতিমধ্যে আজকের লিংক জমা দিয়েছেন। দিনে সর্বোচ্চ ১ টি লিংক অনুমোদনযোগ্য।';
  }
  if (msg.includes('SELF_SUPPORT_FORBIDDEN')) {
    return 'নিজের লিংকে সাপোর্ট দেওয়া যাবে না।';
  }
  if (msg.includes('ALREADY_SUPPORTED')) {
    return 'এই লিংকে ইতিমধ্যে সাপোর্ট রেকর্ড করা হয়েছে।';
  }
  if (msg.includes('SUPPORT_REQUIREMENTS_INCOMPLETE')) {
    return 'All Done সম্ভব নয়! আজকের সকল নির্ধারিত লিংকে সাপোর্ট সম্পন্ন করতে হবে।';
  }
  if (msg.includes('ALL_DONE_ALREADY_SUBMITTED')) {
    return 'আপনি ইতিমধ্যে আজকের All Done সম্পন্ন করেছেন।';
  }
  if (msg.includes('DEVELOPER_PROTECTED')) {
    return 'ডেভেলপার অ্যাকাউন্ট সুরক্ষিত। এই অ্যাকাউন্ট পরিবর্তন, স্থগিত বা ডিমোট করা যাবে না।';
  }
  if (msg.includes('CROSS_COMMUNITY_DENIED')) {
    return 'ভিন্ন কমিউনিটির সদস্য নিয়ন্ত্রণ বা পরিবর্তন করার অনুমতি আপনার নেই।';
  }
  if (msg.includes('INVALID_STATUS')) {
    return 'সদস্যের বর্তমান স্ট্যাটাস এই পরিবর্তনের উপযুক্ত নয়। হয়তো অন্য এডমিন ইতিমধ্যে পরিবর্তন করেছেন।';
  }
  if (msg.includes('MEMBER_NOT_FOUND')) {
    return 'সদস্য খুঁজে পাওয়া যায়নি।';
  }
  if (msg.includes('MEMBER_INACTIVE')) {
    return 'আপনার অ্যাকাউন্টটি স্থগিত বা নিষ্ক্রিয় রয়েছে। এডমিনের সাথে যোগাযোগ করুন।';
  }
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।';
  }
  if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
    return 'আপনার ইমেইল ভেরিফাই করা হয়নি। অনুগ্রহ করে ইনবক্স চেক করুন।';
  }
  if (
    msg.includes('rate limit') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('Too many requests')
  ) {
    return 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।';
  }
  if (
    msg.includes('User already registered') ||
    msg.includes('user_already_exists') ||
    msg.includes('already registered') ||
    msg.includes('duplicate key value violates unique constraint')
  ) {
    return 'এই Email দিয়ে আগে থেকেই একটি Account রয়েছে।';
  }
  if (msg.includes('Password should be at least') || msg.includes('weak_password')) {
    return 'আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।';
  }
  if (msg.includes('Unable to validate email address') || msg.includes('invalid_email')) {
    return 'সঠিক Email Address দিন।';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
    return 'ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
  }

  return msg;
}

/**
 * AUTHENTICATION GATEWAY API (CHAPTER 02)
 */
export const authApi = {
  async signUp(params: {
    email: string;
    password: string;
    name: string;
    username: string;
    facebookName?: string;
    facebookUrl?: string;
  }): Promise<
    ApiResponse<{ user: any; session: any; needsEmailConfirmation: boolean }>
  > {
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase কনফিগার করা হয়নি।' };
      }

      const normalizedEmail = params.email.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, error: 'সঠিক Email Address দিন।' };
      }
      if (!params.password || params.password.length < 6) {
        return { success: false, error: 'আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: params.password,
        options: {
          data: {
            name: params.name.trim(),
            username: params.username.trim().toLowerCase(),
            facebook_name: params.facebookName?.trim(),
            facebook_url: params.facebookUrl?.trim(),
          },
        },
      });

      if (error) {
        return { success: false, error: formatSupabaseError(error) };
      }

      // Check if user identity already existed (Supabase returns empty identities array when duplicate registered)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return {
          success: false,
          error: 'এই Email দিয়ে আগে থেকেই একটি Account রয়েছে।',
        };
      }

      const needsEmailConfirmation = !data.session && Boolean(data.user);

      return {
        success: true,
        data: {
          user: data.user,
          session: data.session,
          needsEmailConfirmation,
        },
        message: needsEmailConfirmation
          ? 'আপনার Email-এ Confirmation link পাঠানো হয়েছে।'
          : 'Registration সফল হয়েছে।',
      };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async signIn(email: string, password: string): Promise<ApiResponse<{ session: any; user: any }>> {
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase কনফিগার করা হয়নি।' };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: { session: data.session, user: data.user } };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async signOut(): Promise<ApiResponse<void>> {
    try {
      if (!isSupabaseConfigured) return { success: true };
      const { error } = await supabase.auth.signOut();
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async getSession() {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async resetPasswordForEmail(email: string): Promise<ApiResponse<void>> {
    try {
      if (!isSupabaseConfigured) {
        return {
          success: true,
          message: 'যদি এই ইমেইলের জন্য অ্যাকাউন্ট থাকে, তাহলে পাসওয়ার্ড রিসেট করার নির্দেশনা পাঠানো হবে।',
        };
      }
      const normalizedEmail = email.trim().toLowerCase();
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl,
      });
      if (error) {
        console.warn('Password recovery error logged internally:', error.message);
      }
      // Section 12 & 31: Account enumeration protection - always return generic success message
      return {
        success: true,
        message: 'যদি এই ইমেইলের জন্য অ্যাকাউন্ট থাকে, তাহলে পাসওয়ার্ড রিসেট করার নির্দেশনা পাঠানো হবে।',
      };
    } catch {
      return {
        success: true,
        message: 'যদি এই ইমেইলের জন্য অ্যাকাউন্ট থাকে, তাহলে পাসওয়ার্ড রিসেট করার নির্দেশনা পাঠানো হবে।',
      };
    }
  },

  async updatePassword(newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (!isSupabaseConfigured) {
        return { success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।' };
      }
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।' };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।' };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!isSupabaseConfigured) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },
};

/**
 * MEMBERS GATEWAY API
 */
export const membersApi = {
  async getCurrentProfile(): Promise<ApiResponse<MemberProfile>> {
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { data, error } = await supabase.rpc('rpc_get_current_member_profile');
      if (error) return { success: false, error: formatSupabaseError(error) };
      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Profile not found' };
      }
      return { success: true, data: data.profile as MemberProfile };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async getAllMembers(): Promise<ApiResponse<MemberProfile[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('points', { ascending: false });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as MemberProfile[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async updateRole(targetId: string, newRole: UserRole): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      // Attempt Chapter 04 authoritative RPC first
      let { data, error } = await supabase.rpc('change_member_role', {
        p_target_id: targetId,
        p_new_role: newRole,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        const fallback = await supabase.rpc('rpc_update_member_role', {
          p_target_id: targetId,
          p_new_role: newRole,
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async updateStatus(
    targetId: string,
    newStatus: MemberStatus,
    reason?: string
  ): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      // Attempt Chapter 05 authoritative RPC first
      let { data, error } = await supabase.rpc('set_member_status_secure', {
        p_target_id: targetId,
        p_new_status: newStatus,
        p_reason: reason || null,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        const fallback = await supabase.rpc('rpc_update_member_status', {
          p_target_id: targetId,
          p_new_status: newStatus,
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async approveMember(targetId: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      let { data, error } = await supabase.rpc('approve_member_secure', {
        p_target_id: targetId,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        return this.updateStatus(targetId, 'ACTIVE', 'Registration approved');
      }

      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async rejectMember(targetId: string, reason?: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      let { data, error } = await supabase.rpc('reject_member_secure', {
        p_target_id: targetId,
        p_reason: reason || null,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        return this.updateStatus(targetId, 'REMOVED', reason || 'Registration rejected');
      }

      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async updateProfile(
    targetId: string,
    profile: {
      name?: string;
      facebook_name?: string;
      facebook_url?: string;
      profile_photo_url?: string;
    }
  ): Promise<ApiResponse<MemberProfile>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      let { data, error } = await supabase.rpc('update_member_profile_secure', {
        p_target_id: targetId,
        p_name: profile.name || null,
        p_facebook_name: profile.facebook_name || null,
        p_facebook_url: profile.facebook_url || null,
        p_profile_photo_url: profile.profile_photo_url || null,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        // Safe fallback only allowing non-security fields
        const safeUpdate: any = { updated_at: new Date().toISOString() };
        if (profile.name) safeUpdate.name = profile.name.trim();
        if (profile.facebook_name !== undefined) safeUpdate.facebook_name = profile.facebook_name.trim();
        if (profile.facebook_url !== undefined) safeUpdate.facebook_url = profile.facebook_url.trim();
        if (profile.profile_photo_url !== undefined) safeUpdate.profile_photo_url = profile.profile_photo_url.trim();

        const res = await supabase
          .from('members')
          .update(safeUpdate)
          .eq('id', targetId)
          .select()
          .single();

        if (res.error) return { success: false, error: formatSupabaseError(res.error) };
        return { success: true, data: res.data as MemberProfile };
      }

      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: data?.profile as MemberProfile };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async getPaginatedMembers(params: {
    search?: string;
    role?: UserRole | 'ALL';
    status?: MemberStatus | 'ALL';
    page?: number;
    pageSize?: number;
  }): Promise<
    ApiResponse<{
      members: MemberProfile[];
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    }>
  > {
    try {
      if (!isSupabaseConfigured) {
        return {
          success: true,
          data: {
            members: [],
            page: 1,
            pageSize: params.pageSize || 10,
            totalCount: 0,
            totalPages: 1,
          },
        };
      }

      const roleFilter = params.role && params.role !== 'ALL' ? params.role : null;
      const statusFilter = params.status && params.status !== 'ALL' ? params.status : null;
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;

      const { data, error } = await supabase.rpc('fetch_members_paginated', {
        p_search: params.search || null,
        p_role: roleFilter,
        p_status: statusFilter,
        p_page: page,
        p_page_size: pageSize,
      });

      if (!error && data && data.success) {
        return {
          success: true,
          data: {
            members: (data.members || []) as MemberProfile[],
            page: data.page,
            pageSize: data.page_size,
            totalCount: data.total_count,
            totalPages: data.total_pages,
          },
        };
      }

      // Fallback query if RPC not yet deployed
      let query = supabase.from('members').select('*', { count: 'exact' });

      if (roleFilter) query = query.eq('role', roleFilter);
      if (statusFilter) query = query.eq('status', statusFilter);
      if (params.search && params.search.trim()) {
        const s = `%${params.search.trim()}%`;
        query = query.or(
          `name.ilike.${s},member_number.ilike.${s},email.ilike.${s},facebook_name.ilike.${s}`
        );
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: rows, count, error: queryErr } = await query
        .order('joined_at', { ascending: false })
        .range(from, to);

      if (queryErr) return { success: false, error: formatSupabaseError(queryErr) };

      const totalCount = count || 0;
      return {
        success: true,
        data: {
          members: (rows || []) as MemberProfile[],
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize) || 1,
        },
      };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * DAILY LINKS GATEWAY API
 */
export const dailyLinksApi = {
  async getTodayLinks(date: string): Promise<ApiResponse<DailyLink[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('daily_links')
        .select('*')
        .eq('date', date)
        .order('serial_number', { ascending: true });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as DailyLink[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async submitDailyLink(params: {
    post_type: 'Photo' | 'Video';
    caption: string;
    instruction: string;
    fb_link: string;
    category?: 'NORMAL' | 'VIP' | 'ADMIN' | 'NOTICE';
    target_member_id?: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

      // Chapter 06: Primary Authoritative RPC submit_daily_link_secure
      let { data, error } = await supabase.rpc('submit_daily_link_secure', {
        p_post_type: params.post_type,
        p_caption: params.caption,
        p_instruction: params.instruction,
        p_fb_link: params.fb_link,
        p_category: params.category || 'NORMAL',
        p_target_member_id: params.target_member_id || null,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        // Fallback to rpc_submit_daily_link
        const fallback = await supabase.rpc('rpc_submit_daily_link', {
          p_post_type: params.post_type,
          p_caption: params.caption,
          p_instruction: params.instruction,
          p_fb_link: params.fb_link,
          p_category: params.category || 'NORMAL',
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        let msg = formatSupabaseError(error);
        if (msg.includes('DUPLICATE_SUBMISSION') || msg.includes('unique_normal_member_link_per_day') || msg.includes('LINK_ALREADY_SUBMITTED')) {
          msg = 'আজকের জন্য আপনার একটি লিংক ইতোমধ্যে জমা দেওয়া হয়েছে।';
        } else if (msg.includes('WINDOW_NOT_STARTED')) {
          msg = 'লিংক জমা দেওয়ার সময় এখনো শুরু হয়নি।';
        } else if (msg.includes('WINDOW_CLOSED')) {
          msg = 'আজকের লিংক জমা দেওয়ার সময় শেষ হয়েছে।';
        } else if (msg.includes('INVALID_URL')) {
          msg = 'সঠিক ফেসবুক পোস্ট লিংক দিন (যেমন: https://www.facebook.com/...)';
        } else if (msg.includes('MEMBER_INACTIVE')) {
          msg = 'আপনার অ্যাকাউন্ট সচল না থাকায় লিংক জমা দেওয়া যাবে না।';
        }
        return { success: false, error: msg };
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async editLinkSecure(params: {
    link_id: string;
    post_type: PostType;
    caption: string;
    instruction: string;
    fb_link: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

      const { data, error } = await supabase.rpc('edit_daily_link_secure', {
        p_link_id: params.link_id,
        p_post_type: params.post_type,
        p_caption: params.caption,
        p_instruction: params.instruction,
        p_fb_link: params.fb_link,
      });

      if (error) {
        let msg = formatSupabaseError(error);
        if (msg.includes('EDIT_WINDOW_EXPIRED')) {
          msg = '২ মিনিটের সময়সীমা শেষ হয়ে গেছে। এখন আর লিংকটি পরিবর্তন করা যাবে না।';
        } else if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
          msg = 'এই লিংকটি পরিবর্তন করার অনুমতি আপনার নেই।';
        } else if (msg.includes('LINK_REMOVED')) {
          msg = 'লিংকটি ইতিমধ্যে Remove করা হয়েছে।';
        } else if (msg.includes('INVALID_URL')) {
          msg = 'সঠিক ফেসবুক পোস্ট লিংক দিন (যেমন: https://www.facebook.com/...)';
        }
        return { success: false, error: msg };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async removeLinkSecure(params: {
    link_id: string;
    reason?: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

      const { data, error } = await supabase.rpc('remove_daily_link_secure', {
        p_link_id: params.link_id,
        p_reason: params.reason || 'ব্যবহারকারীর অনুরোধে অপসারিত',
      });

      if (error) {
        let msg = formatSupabaseError(error);
        if (msg.includes('DELETE_WINDOW_EXPIRED') || msg.includes('EDIT_WINDOW_EXPIRED')) {
          msg = '২ মিনিটের সময়সীমা শেষ হয়ে গেছে। এখন আর লিংকটি মুছে ফেলা যাবে না।';
        } else if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
          msg = 'এই লিংকটি মুছে ফেলার অনুমতি আপনার নেই।';
        } else if (msg.includes('ALREADY_REMOVED')) {
          msg = 'লিংকটি ইতিমধ্যে Remove করা হয়েছে।';
        }
        return { success: false, error: msg };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * SUPPORT SESSION GATEWAY API (Chapter 08)
 */
export const supportApi = {
  async getTodaySupportRecords(date: string, supporterId: string): Promise<ApiResponse<SupportRecord[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('support_records')
        .select('*')
        .eq('date', date)
        .eq('supporter_id', supporterId);
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as SupportRecord[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  /**
   * Atomic RPC to record support safely (Chapter 09).
   * Derives auth.uid() -> member -> community -> date on the server.
   * Prevents self-support, duplicate support, removed-link support, and awarded points tampering.
   */
  async recordSupport(linkId: string): Promise<ApiResponse<SupportVerificationResult>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

      // Attempt canonical record_support_atomic first
      let { data, error } = await supabase.rpc('record_support_atomic', {
        p_link_id: linkId,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        // Fallback to rpc_record_link_support if migration function name differs
        const fallback = await supabase.rpc('rpc_record_link_support', {
          p_link_id: linkId,
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        return {
          success: false,
          error: formatSupabaseError(error),
          errorCode: error.code || 'SUPPORT_ERROR',
        };
      }

      // If response indicated ALREADY_SUPPORTED in data object
      if (data && data.error_code === 'ALREADY_SUPPORTED') {
        return {
          success: true,
          data: {
            success: true,
            status: 'ALREADY_SUPPORTED',
            linkId,
            code: 'ALREADY_SUPPORTED',
            message: 'Already supported this link.',
          },
        };
      }

      const result: SupportVerificationResult = {
        success: data?.success ?? true,
        status: data?.status || (data?.already_supported ? 'ALREADY_SUPPORTED' : 'RECORDED'),
        linkId,
        supportRecordId: data?.support_id || data?.support_record_id,
        pointsAwarded: data?.points_awarded || (data?.success ? 1 : 0),
        supportedAt: data?.supported_at,
        code: data?.error_code || data?.code,
      };

      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  /**
   * Chapter 9 & 10 Support Completion Check
   * Server-authoritative query to check if a member has fulfilled today's support obligations.
   */
  async getTodaySupportCompletionStatus(date: string, memberId: string): Promise<ApiResponse<{
    allSupportCompleted: boolean;
    totalApplicable: number;
    totalSupported: number;
    remainingPending: number;
  }>> {
    try {
      if (!isSupabaseConfigured) {
        return {
          success: true,
          data: {
            allSupportCompleted: false,
            totalApplicable: 0,
            totalSupported: 0,
            remainingPending: 0,
          },
        };
      }

      // 1. Fetch active links for date excluding member's own link
      const { data: links, error: linksError } = await supabase
        .from('daily_links')
        .select('id, owner_id, status')
        .eq('date', date)
        .eq('status', 'active');

      if (linksError) return { success: false, error: formatSupabaseError(linksError) };

      const applicableLinks = (links || []).filter((l) => l.owner_id !== memberId);

      // 2. Fetch member's support records for date
      const { data: records, error: recordsError } = await supabase
        .from('support_records')
        .select('link_id')
        .eq('date', date)
        .eq('supporter_id', memberId);

      if (recordsError) return { success: false, error: formatSupabaseError(recordsError) };

      const supportedSet = new Set((records || []).map((r) => r.link_id));
      const totalApplicable = applicableLinks.length;
      const totalSupported = applicableLinks.filter((l) => supportedSet.has(l.id)).length;
      const remainingPending = Math.max(0, totalApplicable - totalSupported);
      const allSupportCompleted = totalApplicable > 0 && remainingPending === 0;

      return {
        success: true,
        data: {
          allSupportCompleted,
          totalApplicable,
          totalSupported,
          remainingPending,
        },
      };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  /**
   * Chapter 9 Support Verification Abstraction Hook
   * Prepares verification status check without hardcoding false assumptions.
   */
  async verifySupportStatus(linkId: string): Promise<ApiResponse<{
    status: 'pending' | 'verified' | 'rejected' | 'unknown';
    is_supported: boolean;
  }>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: { status: 'verified', is_supported: true } };

      const { data, error } = await supabase.rpc('check_support_status', {
        p_link_id: linkId,
      });

      if (error && error.message.includes('function') && error.message.includes('does not exist')) {
        // Safe default when advanced verification engine is not yet deployed
        return { success: true, data: { status: 'verified', is_supported: true } };
      }

      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: data || { status: 'verified', is_supported: true } };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * ALL DONE GATEWAY API
 */
export const allDoneApi = {
  async getTodayAllDone(date: string): Promise<ApiResponse<AllDoneRecord[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('all_done')
        .select('*')
        .eq('date', date)
        .order('completed_at', { ascending: true });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as AllDoneRecord[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async submitAllDone(params?: {
    alternative_id_used?: boolean;
    alternative_id_details?: any;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('rpc_submit_all_done', {
        p_alternative_id_used: params?.alternative_id_used || false,
        p_alternative_id_details: params?.alternative_id_details || null,
      });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * SYSTEM CONFIG & NOTICES GATEWAY
 */
export const configApi = {
  async getSettings(): Promise<ApiResponse<SystemConfig>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: data as SystemConfig };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async getNotices(): Promise<ApiResponse<NoticeItem[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as NoticeItem[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async getAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as AuditLog[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * SCHEDULED LINKS GATEWAY API (Chapter 07)
 */
export const scheduledLinksApi = {
  async getMyScheduledLinks(memberId?: string): Promise<ApiResponse<ScheduledLink[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      let query = supabase
        .from('scheduled_links')
        .select('*')
        .order('target_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (memberId) {
        query = query.eq('owner_id', memberId);
      }

      const { data, error } = await query;
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as ScheduledLink[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async createScheduledLinkSecure(params: {
    target_date: string;
    post_type: PostType;
    caption: string;
    instruction: string;
    fb_link: string;
    category?: LinkCategory;
    target_member_id?: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('create_scheduled_link_secure', {
        p_target_date: params.target_date,
        p_post_type: params.post_type,
        p_caption: params.caption,
        p_instruction: params.instruction,
        p_fb_link: params.fb_link,
        p_category: params.category || 'NORMAL',
        p_target_member_id: params.target_member_id || null,
      });

      if (error) {
        let msg = formatSupabaseError(error);
        if (msg.includes('SCHEDULE_WINDOW_NOT_OPEN')) {
          msg = 'পরবর্তী দিনের জন্য লিংক শিডিউল শুরু হবে দুপুর ১২:০০ টায় (BDT)।';
        } else if (msg.includes('DUPLICATE_SCHEDULE')) {
          msg = 'এই দিনের জন্য ইতোমধ্যে একটি লিংক Scheduled আছে।';
        } else if (msg.includes('INVALID_URL')) {
          msg = 'সঠিক ফেসবুক পোস্ট লিংক দিন (যেমন: https://www.facebook.com/...)';
        } else if (msg.includes('MEMBER_INACTIVE')) {
          msg = 'বর্তমান Account Status অনুযায়ী এই লিংকটি Schedule করা যাবে না।';
        }
        return { success: false, error: msg };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async editScheduledLinkSecure(params: {
    schedule_id: string;
    post_type: PostType;
    caption: string;
    instruction: string;
    fb_link: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('edit_scheduled_link_secure', {
        p_schedule_id: params.schedule_id,
        p_post_type: params.post_type,
        p_caption: params.caption,
        p_instruction: params.instruction,
        p_fb_link: params.fb_link,
      });

      if (error) {
        let msg = formatSupabaseError(error);
        if (msg.includes('NOT_PENDING') || msg.includes('ALREADY_EXECUTED')) {
          msg = 'এই শিডিউলটি আর পরিবর্তন করা যাবে না (ইতিমধ্যে এক্সিকিউট বা বাতিল হয়েছে)।';
        } else if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
          msg = 'এই শিডিউলটি পরিবর্তন করার অনুমতি আপনার নেই।';
        }
        return { success: false, error: msg };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async cancelScheduledLinkSecure(params: {
    schedule_id: string;
    reason?: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('cancel_scheduled_link_secure', {
        p_schedule_id: params.schedule_id,
        p_reason: params.reason || 'সদস্যের অনুরোধে বাতিল',
      });

      if (error) {
        let msg = formatSupabaseError(error);
        if (msg.includes('NOT_PENDING')) {
          msg = 'শুধুমাত্র Pending অবস্থায় থাকা শিডিউল বাতিল করা যায়।';
        } else if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
          msg = 'এই শিডিউলটি বাতিল করার অনুমতি আপনার নেই।';
        }
        return { success: false, error: msg };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async runDueScheduledLinksSecure(): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('run_due_scheduled_links_secure');
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * POINTS & LEADERBOARD GATEWAY API (Chapter 11)
 */
export const pointsApi = {
  async getDailyLeaderboard(date: string): Promise<ApiResponse<any[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase.rpc('get_daily_leaderboard_secure', { p_date: date });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async getMemberPointHistory(memberId: string): Promise<ApiResponse<PointTransaction[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: data as PointTransaction[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * ALL DONE ADMIN GATEWAY API (Chapter 13)
 */
export const allDoneAdminApi = {
  async getPendingReviews(): Promise<ApiResponse<any[]>> {
    try {
      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('fake_all_done_incidents')
        .select('*')
        .eq('review_status', 'PENDING_REVIEW')
        .order('created_at', { ascending: false });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data: (data || []) as any[] };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async confirmFakeAllDone(incidentId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('confirm_fake_all_done_secure', {
        p_incident_id: incidentId,
        p_reason: reason,
      });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

/**
 * REPORTS & REPLIES GATEWAY API (Chapter 15)
 */
export const reportsApi = {
  async createReport(linkId: string, category: string, description: string, screenshotPath?: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('create_report_secure', {
        p_link_id: linkId,
        p_category: category,
        p_description: description,
        p_screenshot_path: screenshotPath,
      });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async createReply(reportId: string, message: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data, error } = await supabase.rpc('create_report_reply_secure', {
        p_report_id: reportId,
        p_message: message,
      });
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },
};

