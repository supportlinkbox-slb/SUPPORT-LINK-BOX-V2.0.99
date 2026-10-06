#!/usr/bin/env python3
"""
apply-frontend-fixes.py — Support Link Box frontend audit fixes (C14 + UI batch).

WHAT: Applies minimal surgical patches for audit findings:
  C14, H16, M4, M5, M6, M7, M16, M19, M23, L5, L11, L13, L14, L16, L18,
  L20, L26, L31, M24, M28, M31, M33, L19, L21
SKIPPED (verified, see notes at end): L3 (not dead), L19/alt_id_disclosures (absent).

HOW TO RUN (Termux, inside the repo):
  cd ~/SUPPORT-LINK-BOX-V2.0.99 && python3 apply-frontend-fixes.py
  # then: git add -A && git commit -m "fix: frontend audit batch (C14 + 24 UI findings)" && git push

SAFETY:
  - Idempotent-ish: every patch checks for its marker comment first and SKIPs if present.
  - Fails LOUDLY (non-zero exit, no partial writes for that patch) if an expected
    old_string is not found exactly as written.
  - Prints an OK/SKIP summary at the end.
"""
import os
import re
import sys
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--repo", default=os.path.expanduser("~/SUPPORT-LINK-BOX-V2.0.99"),
                    help="Path to the SUPPORT-LINK-BOX-V2.0.99 repo checkout")
args = parser.parse_args()
REPO = args.repo

results = []  # (status, path, marker)


def _full(path):
    return os.path.join(REPO, path)


def patch(path, marker, old, new, count=1):
    """Exact old_string -> new_string replacement. Raises loudly on mismatch."""
    fp = _full(path)
    with open(fp, encoding="utf-8") as f:
        content = f.read()
    # Idempotent: skip if the marker is present, the new text is already there,
    # or (for deletions, where new == "") the old text is already gone.
    if marker in content:
        results.append(("SKIP", path, marker))
        return
    if new and new in content:
        results.append(("SKIP", path, marker))
        return
    if not new and old not in content:
        results.append(("SKIP", path, marker))
        return
    found = content.count(old)
    if found != count:
        raise SystemExit(
            "PATCH FAILED [{}]: expected {} occurrence(s) of old_string in {}, found {}.".format(
                marker, count, path, found))
    content = content.replace(old, new)
    with open(fp, "w", encoding="utf-8") as f:
        f.write(content)
    results.append(("OK", path, marker))


def patch_regex_remove_dead_branch(path, marker):
    """M4/L6: remove the dead inviteData password-set stage from LoginPage.

    Uses a strict regex (no Bengali transcription) with assertions that the kept
    part is the token input and the removed part is the dead password stage.
    """
    fp = _full(path)
    with open(fp, encoding="utf-8") as f:
        content = f.read()
    if marker in content:
        results.append(("SKIP", path, marker))
        return
    pat = re.compile(
        r"(\n                  \{"      # newline + indent + literal {
        r"!inviteData \? \("          # !inviteData ? (
        r")\n"                        # end group 1
        r"(.*?)"                       # group 2: kept part (token input)
        r"(\n                  \) : \()"  # group 3: newline + indent + ) : (
        r"\n"
        r"(.*?)"                       # group 4: dead part (password stage)
        r"(\n                  \)\})",  # group 5: newline + indent + )}
        re.DOTALL,
    )
    m = pat.search(content)
    if not m:
        raise SystemExit("PATCH FAILED [{}]: dead-branch pattern not found in {}".format(marker, path))
    kept, dead = m.group(2), m.group(4)
    if "Invite Token" not in kept:
        raise SystemExit("PATCH FAILED [{}]: kept branch is not the token input!".format(marker))
    if "inviteData.member_number" not in dead:
        raise SystemExit("PATCH FAILED [{}]: removed branch is not the dead password stage!".format(marker))
    replacement = ("\n                  {/* " + marker + ": dead inviteData password stage removed "
                   "(setInviteData was only ever called with null) */}\n"
                   "                  {\n" + kept + "\n                  }")
    content = content[:m.start()] + replacement + content[m.end():]
    with open(fp, "w", encoding="utf-8") as f:
        f.write(content)
    results.append(("OK", path, marker))


def rename_token(path, marker, old_tok, new_tok, expected):
    """Whole-file token rename with occurrence-count assertion."""
    fp = _full(path)
    with open(fp, encoding="utf-8") as f:
        content = f.read()
    if marker in content:
        results.append(("SKIP", path, marker))
        return
    found = content.count(old_tok)
    if found != expected:
        raise SystemExit(
            "PATCH FAILED [{}]: expected {} occurrence(s) of {!r} in {}, found {}.".format(
                marker, expected, old_tok, path, found))
    content = content.replace(old_tok, new_tok)
    # marker goes right after the first replacement site is impractical; append file-end marker comment
    if path.endswith(".tsx") or path.endswith(".ts"):
        content = content.rstrip("\n") + "\n// " + marker + ": " + old_tok + " -> " + new_tok + " unification\n"
    with open(fp, "w", encoding="utf-8") as f:
        f.write(content)
    results.append(("OK", path, marker))


# ---------------------------------------------------------------- C14
# Blacklist pre-check in authApi.signUp (best-effort; never breaks the normal path)
patch(
    "src/lib/supabase.ts",
    "SLB-FIX-C14",
    """      if (!params.password || params.password.length < 6) {
        return { success: false, error: 'আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।' };
      }

      // 1. Get atomic member number using RPC""",
    """      if (!params.password || params.password.length < 6) {
        return { success: false, error: 'আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।' };
      }

      // SLB-FIX-C14: blacklist pre-check before auth.signUp. Best-effort via the
      // anon-callable is_blacklisted RPC; if the check itself errors (RPC missing),
      // continue with signup so the normal path never breaks. Server/edge paths
      // enforce the blacklist again authoritatively.
      try {
        const { data: blBlocked, error: blErr } = await supabase.rpc('is_blacklisted', {
          p_email: normalizedEmail,
          p_fb_link: params.facebookUrl?.trim() || null,
        });
        if (!blErr && blBlocked === true) {
          return { success: false, error: 'এই ইমেইল/Facebook ID কালো তালিকাভুক্ত — রেজিস্ট্রেশন স্থায়ীভাবে বন্ধ।' };
        }
      } catch (blEx) {
        console.warn('SLB-FIX-C14 blacklist pre-check unavailable, continuing signup:', blEx);
      }

      // 1. Get atomic member number using RPC""",
)

# ---------------------------------------------------------------- H16 (a)
# AllDoneSection: fastest banner renders server-configured values, ranks 1-5
patch(
    "src/components/alldone/AllDoneSection.tsx",
    "SLB-FIX-H16",
    """    allDoneRecords,
    todayDate,
  } = useApp();""",
    """    allDoneRecords,
    todayDate,
    systemConfig, // SLB-FIX-H16
  } = useApp();""",
)
patch(
    "src/components/alldone/AllDoneSection.tsx",
    "SLB-FIX-H16-banner",
    """            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between text-amber-300">
                <span>🥇 1st Fastest</span>
                <span>+50 Pts</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>🥈 2nd Fastest</span>
                <span>+30 Pts</span>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>🥉 3rd Fastest</span>
                <span>+20 Pts</span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span>✨ 4th-10th Rank</span>
                <span>+10 Pts</span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-1">
                <span>Standard Completion</span>
                <span>+5 Pts</span>
              </div>
            </div>""",
    """            {/* SLB-FIX-H16-banner: values from systemConfig (server-configured); server awards ranks 1-5 only */}
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between text-amber-300">
                <span>🥇 1st Fastest</span>
                <span>+{systemConfig.points_fastest_top1 ?? 10} Pts</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>🥈 2nd Fastest</span>
                <span>+{systemConfig.points_fastest_top2 ?? 8} Pts</span>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>🥉 3rd Fastest</span>
                <span>+{systemConfig.points_fastest_top3 ?? 6} Pts</span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span>4th Fastest</span>
                <span>+{systemConfig.points_fastest_top4 ?? 4} Pts</span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span>5th Fastest</span>
                <span>+{systemConfig.points_fastest_top5 ?? 2} Pts</span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-1">
                <span>Standard Completion</span>
                <span>+{systemConfig.points_all_done ?? 5} Pts</span>
              </div>
            </div>""",
)

# ---------------------------------------------------------------- H16 (b)
# PlaylistSupportSession: "+5" labels read systemConfig.points_all_done
patch(
    "src/components/member/PlaylistSupportSession.tsx",
    "SLB-FIX-H16",
    """    submitAllDone,
    refreshData,
  } = useApp();""",
    """    submitAllDone,
    refreshData,
    systemConfig, // SLB-FIX-H16
  } = useApp();""",
)
patch(
    "src/components/member/PlaylistSupportSession.tsx",
    "SLB-FIX-H16-label1",
    """<span>{isAllDoneSubmitting ? 'সাবমিট হচ্ছে...' : 'All Done সাবমিট করুন (+5)'}</span>""",
    """<span>{isAllDoneSubmitting ? 'সাবমিট হচ্ছে...' : `All Done সাবমিট করুন (+${systemConfig.points_all_done ?? 5})`}</span>""",
)
patch(
    "src/components/member/PlaylistSupportSession.tsx",
    "SLB-FIX-H16-label2",
    """<span>{isAllDoneSubmitting ? 'সাবমিট ও ভেরিফাই হচ্ছে...' : 'ALL DONE নিশ্চিত করুন (+5 Points)'}</span>""",
    """<span>{isAllDoneSubmitting ? 'সাবমিট ও ভেরিফাই হচ্ছে...' : `ALL DONE নিশ্চিত করুন (+${systemConfig.points_all_done ?? 5} Points)`}</span>""",
)

# ---------------------------------------------------------------- M4 / L6
# LoginPage: remove the dead INVITE_TOKEN password-set stage
patch_regex_remove_dead_branch("src/components/auth/LoginPage.tsx", "SLB-FIX-M4")
patch(
    "src/components/auth/LoginPage.tsx",
    "SLB-FIX-M4-state",
    """  const [inviteData, setInviteData] = useState<{ member_number?: string; facebook_name?: string } | null>(null);
""",
    "",
)
patch(
    "src/components/auth/LoginPage.tsx",
    "SLB-FIX-M4-reset",
    """    setInviteData(null);
""",
    "",
)
patch(
    "src/components/auth/LoginPage.tsx",
    "SLB-FIX-M4-btn",
    """                ) : mode === 'INVITE_TOKEN' ? (
                  !inviteData ? 'টোকেন ভেরিফাই করুন' : 'পাসওয়ার্ড সেট করুন'
                ) : (""",
    """                ) : mode === 'INVITE_TOKEN' ? (
                  'টোকেন ভেরিফাই করুন'
                ) : (""",
)

# ---------------------------------------------------------------- M5
# Submission window UI closes at 16:50:00 sharp (matches server cutoff)
patch(
    "src/utils/bangladeshTime.ts",
    "SLB-FIX-M5",
    """  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM; // 10:00 AM = 600 min
  const endMinutes = endH * 60 + endM; // 04:50 PM = 1010 min""",
    """  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  // SLB-FIX-M5: second-granularity close so the UI matches the server's 16:50:00.000 cutoff
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM; // 10:00 AM = 600 min
  const endMinutes = endH * 60 + endM; // 04:50 PM = 1010 min
  const endSeconds = endH * 3600 + endM * 60; // 16:50:00 sharp""",
)
patch(
    "src/utils/bangladeshTime.ts",
    "SLB-FIX-M5-close",
    """  if (currentMinutes > endMinutes) {
    return {
      isOpen: false,
      isAdminWindow: false,
      windowType: 'CLOSED',
      message: `আজকের সাধারণ লিংক সাবমিশন বিকাল ৪:৫০ এ শেষ হয়েছে (BDT)`,
    };
  }""",
    """  if (currentSeconds >= endSeconds) {
    return {
      isOpen: false,
      isAdminWindow: false,
      windowType: 'CLOSED',
      message: `আজকের সাধারণ লিংক সাবমিশন বিকাল ৪:৫০ এ শেষ হয়েছে (BDT)`,
    };
  }""",
)

# ---------------------------------------------------------------- M6
# canEditSubmission: honor server can_edit_until (no extra +120s); 2-min fallback
patch(
    "src/utils/bangladeshTime.ts",
    "SLB-FIX-M6",
    """/**
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
}""",
    """/**
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
}""",
)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-M6-callsites",
    """    if (!isAdmin && !canEditSubmission(link.can_edit_until)) {""",
    """    if (!isAdmin && !canEditSubmission(link.can_edit_until, link.submitted_at)) {""",
    count=2,
)
patch(
    "src/components/member/DailyLinksView.tsx",
    "SLB-FIX-M6-callersite",
    """const canEdit = isAdmin || (isOwnLink && canEditSubmission(link.can_edit_until || link.submitted_at));""",
    """const canEdit = isAdmin || (isOwnLink && canEditSubmission(link.can_edit_until, link.submitted_at)); // SLB-FIX-M6""",
)

# ---------------------------------------------------------------- M7
# Client FB-link regex aligned to the server regex (submit RPC)
patch(
    "src/utils/facebookLinks.ts",
    "SLB-FIX-M7",
    """  // Validates facebook.com, fb.watch, fb.com, m.facebook.com
  const fbRegex = /^(https?:\\/\\/)?((www|m|mobile|web)\\.)?(facebook\\.com|fb\\.watch|fb\\.me|fb\\.com)\\/.+$/i;""",
    """  // SLB-FIX-M7: aligned to the server regex (submit RPC):
  // https?://(www.|web.|m.)?(facebook.com|fb.watch)/ — scheme required, fb.me/fb.com rejected
  const fbRegex = /^https?:\\/\\/(www\\.|web\\.|m\\.)?(facebook\\.com|fb\\.watch)\\/.+$/i;""",
)

# ---------------------------------------------------------------- M16
# getLeaderboardRankings: omit p_date so the RPC's own BDT default applies
patch(
    "src/lib/supabase.ts",
    "SLB-FIX-M16",
    """      if (!isSupabaseConfigured) return { success: true, data: [] };
      const { data, error } = await supabase.rpc('get_daily_leaderboard_secure', {
        p_period: period,
        p_date: date || (new Date().toISOString().slice(0, 10)),
      });""",
    """      if (!isSupabaseConfigured) return { success: true, data: [] };
      // SLB-FIX-M16: omit p_date when not given so the RPC's own BDT default applies
      // (a UTC date here showed the previous day during 00:00-06:00 BDT).
      const rpcParams: { p_period: string; p_date?: string } = { p_period: period };
      if (date) rpcParams.p_date = date;
      const { data, error } = await supabase.rpc('get_daily_leaderboard_secure', rpcParams);""",
)
patch(
    "src/lib/supabase.ts",
    "SLB-FIX-M16-select",
    """          .select('id, name, member_number, profile_photo_url, role, status, points, weekly_points, monthly_points, daily_points, total_links_submitted, total_supports_given, total_all_done')""",
    """          .select('id, name, member_number, profile_photo_url, role, status, points, weekly_points, monthly_points, daily_points, total_links_submitted, total_supports_given, total_all_done, current_streak')""",
)

# ---------------------------------------------------------------- M19
# All Done submit: in-flight guard against double-tap double RPC
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-M19-ref",
    """  const isRegisteringRef = useRef<boolean>(false);""",
    """  const isRegisteringRef = useRef<boolean>(false);
  const isSubmittingAllDoneRef = useRef<boolean>(false); // SLB-FIX-M19: in-flight All Done guard""",
)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-M19-guard",
    """    if (isSupabaseConfigured) {
      const res = await allDoneApi.submitAllDone({
        alternative_id_used: Boolean(alternativeDetails?.account_name),
        alternative_id_details: alternativeDetails,
      });
      if (!res.success) {""",
    """    if (isSupabaseConfigured) {
      // SLB-FIX-M19: in-flight guard — a double-tap must not fire two RPCs.
      // (Raw 23505 from the unique backstop is mapped to Bengali in bengaliErrors.ts.)
      if (isSubmittingAllDoneRef.current) {
        return { success: false, error: 'All Done ইতিমধ্যে সাবমিট হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।' };
      }
      isSubmittingAllDoneRef.current = true;
      let res: Awaited<ReturnType<typeof allDoneApi.submitAllDone>>;
      try {
        res = await allDoneApi.submitAllDone({
          alternative_id_used: Boolean(alternativeDetails?.account_name),
          alternative_id_details: alternativeDetails,
        });
      } finally {
        isSubmittingAllDoneRef.current = false;
      }
      if (!res.success) {""",
)

# ---------------------------------------------------------------- M23
# Leaderboard client sort matches the server RPC exactly: period points DESC, total_all_done DESC
patch(
    "src/components/member/LeaderboardView.tsx",
    "SLB-FIX-M23",
    """    if (period === 'DAILY') {
      return list.sort((a, b) => {
        const ptsDiff = (b.daily_points ?? 0) - (a.daily_points ?? 0);
        if (ptsDiff !== 0) return ptsDiff;
        const linksDiff = (b.total_links_submitted || 0) - (a.total_links_submitted || 0);
        if (linksDiff !== 0) return linksDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    } else if (period === 'WEEKLY' || period === 'HISTORICAL') {
      return list.sort((a, b) => {
        const ptsDiff = (b.weekly_points || 0) - (a.weekly_points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        const linksDiff = (b.total_links_submitted || 0) - (a.total_links_submitted || 0);
        if (linksDiff !== 0) return linksDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    } else if (period === 'MONTHLY') {
      return list.sort((a, b) => {
        const ptsDiff = (b.monthly_points ?? b.points) - (a.monthly_points ?? a.points);
        if (ptsDiff !== 0) return ptsDiff;
        const linksDiff = (b.total_links_submitted || 0) - (a.total_links_submitted || 0);
        if (linksDiff !== 0) return linksDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    } else {
      // ALL_TIME
      return list.sort((a, b) => {
        const ptsDiff = (b.points || 0) - (a.points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        const linksDiff = (b.total_links_submitted || 0) - (a.total_links_submitted || 0);
        if (linksDiff !== 0) return linksDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    }""",
    """    // SLB-FIX-M23: sort matches the server RPC exactly — period points DESC, then total_all_done DESC
    if (period === 'DAILY') {
      return list.sort((a, b) => {
        const ptsDiff = (b.daily_points ?? 0) - (a.daily_points ?? 0);
        if (ptsDiff !== 0) return ptsDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    } else if (period === 'WEEKLY' || period === 'HISTORICAL') {
      return list.sort((a, b) => {
        const ptsDiff = (b.weekly_points || 0) - (a.weekly_points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    } else if (period === 'MONTHLY') {
      return list.sort((a, b) => {
        const ptsDiff = (b.monthly_points ?? b.points) - (a.monthly_points ?? a.points);
        if (ptsDiff !== 0) return ptsDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    } else {
      // ALL_TIME
      return list.sort((a, b) => {
        const ptsDiff = (b.points || 0) - (a.points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        return (b.total_all_done || 0) - (a.total_all_done || 0);
      });
    }""",
)

# ---------------------------------------------------------------- L5
# AdminInviteMember: match the real edge-function error codes
patch(
    "src/components/admin/AdminInviteMember.tsx",
    "SLB-FIX-L5",
    """      if (err.message === 'DUPLICATE_FACEBOOK') {
        setErrorMsg('এই ফেসবুক আইডির অধীনে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।');
      } else if (err.message === 'DUPLICATE_EMAIL') {
        setErrorMsg('এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হয়েছে।');
      } else {
        setErrorMsg(err.message || 'অজানা ত্রুটি।');
      }""",
    """      // SLB-FIX-L5: match the real edge-function codes (DUPLICATE_FACEBOOK is never thrown)
      if (err.message === 'DUPLICATE_FACEBOOK_IDENTITY') {
        setErrorMsg('এই ফেসবুক আইডির অধীনে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।');
      } else if (err.message === 'DUPLICATE_EMAIL') {
        setErrorMsg('এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হয়েছে।');
      } else if (err.message === 'BLACKLISTED') {
        setErrorMsg('এই ইমেইল/Facebook ID কালো তালিকাভুক্ত — ইনভাইট দেওয়া যাবে না।');
      } else {
        setErrorMsg(err.message || 'অজানা ত্রুটি।');
      }""",
)

# ---------------------------------------------------------------- L11
# recordSupport: normalize to the RPC contract {success, error_code}
patch(
    "src/lib/supabase.ts",
    "SLB-FIX-L11",
    """      // If response indicated ALREADY_SUPPORTED in data object
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

      return { success: true, data: result };""",
    """      // SLB-FIX-L11: normalize to the RPC contract {success, error_code} — every
      // already-supported shape maps to status ALREADY_SUPPORTED with 0 points.
      const alreadySupported =
        (data && data.error_code === 'ALREADY_SUPPORTED') ||
        data?.already_supported === true ||
        data?.status === 'ALREADY_SUPPORTED';
      if (alreadySupported) {
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
        status: data?.status || 'RECORDED',
        linkId,
        supportRecordId: data?.support_id || data?.support_record_id,
        pointsAwarded: data?.points_awarded ?? (data?.success ? 1 : 0),
        supportedAt: data?.supported_at,
        code: data?.error_code || data?.code,
      };

      return { success: true, data: result };""",
)

# ---------------------------------------------------------------- L13
# Offline/demo supportLink fallback: read systemConfig.points_per_support, not hardcoded 1
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-L13",
    """    const pointTx: PointTransaction = {
      id: `pt-${Date.now()}-supp`,
      member_id: currentUser.id,
      activity_type: 'SUPPORT_COMPLETE',
      points: 1,""",
    """    const pointTx: PointTransaction = {
      id: `pt-${Date.now()}-supp`,
      member_id: currentUser.id,
      activity_type: 'SUPPORT_COMPLETE',
      points: systemConfig.points_per_support ?? 1, // SLB-FIX-L13: was hardcoded 1 (offline/demo path)""",
)

# ---------------------------------------------------------------- L14
# Rename SpecialSupportDutyBanner -> PenaltyDutyBanner (file + component + imports)
def _rename_banner():
    marker = "SLB-FIX-L14"
    old_rel = "src/components/member/SpecialSupportDutyBanner.tsx"
    new_rel = "src/components/member/PenaltyDutyBanner.tsx"
    app_fp = _full("src/App.tsx")
    with open(app_fp, encoding="utf-8") as f:
        app_content = f.read()
    if marker in app_content or os.path.exists(_full(new_rel)):
        results.append(("SKIP", old_rel, marker))
        return
    if not os.path.exists(_full(old_rel)):
        raise SystemExit("PATCH FAILED [{}]: source file missing".format(marker))
    os.rename(_full(old_rel), _full(new_rel))
    results.append(("OK", old_rel + " -> " + new_rel, marker))

_rename_banner()
patch(
    "src/components/member/PenaltyDutyBanner.tsx",
    "SLB-FIX-L14-iface",
    """interface SpecialSupportDutyBannerProps {""",
    """interface PenaltyDutyBannerProps { // SLB-FIX-L14""",
)
patch(
    "src/components/member/PenaltyDutyBanner.tsx",
    "SLB-FIX-L14-comp",
    """export const SpecialSupportDutyBanner: React.FC<SpecialSupportDutyBannerProps> = ({ onGoToSupport }) => {""",
    """export const PenaltyDutyBanner: React.FC<PenaltyDutyBannerProps> = ({ onGoToSupport }) => {""",
)
patch(
    "src/App.tsx",
    "SLB-FIX-L14-import",
    """import { SpecialSupportDutyBanner } from './components/member/SpecialSupportDutyBanner';""",
    """import { PenaltyDutyBanner } from './components/member/PenaltyDutyBanner'; // SLB-FIX-L14""",
)
patch(
    "src/App.tsx",
    "SLB-FIX-L14-usage",
    """        <SpecialSupportDutyBanner onGoToSupport={() => setCurrentTab('support')} />""",
    """        <PenaltyDutyBanner onGoToSupport={() => setCurrentTab('support')} />""",
)

# ---------------------------------------------------------------- L16
# Leaderboard streak badge: streak_days (phantom) -> current_streak (real column)
patch(
    "src/types/index.ts",
    "SLB-FIX-L16-type",
    """  fast_support_days?: number;
  link_submit_days?: number;""",
    """  fast_support_days?: number;
  link_submit_days?: number;
  current_streak?: number; // SLB-FIX-L16: streak badge source (streak_days exists in no schema)""",
)
patch(
    "src/components/member/LeaderboardView.tsx",
    "SLB-FIX-L16-badge",
    """                        {member.streak_days ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 flex items-center gap-0.5">
                              <Flame className="w-3 h-3 text-amber-500" />
                              {member.streak_days}d streak
                            </span>
                          </>
                        ) : null}""",
    """                        {member.current_streak ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 flex items-center gap-0.5">
                              <Flame className="w-3 h-3 text-amber-500" />
                              {member.current_streak}d streak
                            </span>
                          </>
                        ) : null}""",
)

# ---------------------------------------------------------------- L18
# HomeDashboardView All Done card: 17:00-00:00 copy
patch(
    "src/components/member/HomeDashboardView.tsx",
    "SLB-FIX-L18",
    """<span className="text-slate-300 font-mono">বিকাল ৫:০০ - রাত ১১:৫৯</span>""",
    """<span className="text-slate-300 font-mono">বিকাল ৫:০০ - রাত ১২:০০</span>{/* SLB-FIX-L18: R5 window is 17:00-00:00 */}""",
)

# ---------------------------------------------------------------- L20 (+ M19)
# bengaliErrors: INCIDENT_NOT_FOUND + raw Postgres codes (incl. 23505)
patch(
    "src/utils/bengaliErrors.ts",
    "SLB-FIX-L20",
    """  ALL_DONE_NOT_ELIGIBLE: 'আপনি All Done দেওয়ার জন্য যোগ্য নন।',
};""",
    """  ALL_DONE_NOT_ELIGIBLE: 'আপনি All Done দেওয়ার জন্য যোগ্য নন।',
  INCIDENT_NOT_FOUND: 'তথ্যটি খুঁজে পাওয়া যায়নি। রিফ্রেশ করে আবার চেষ্টা করুন।',
  // SLB-FIX-L20 / SLB-FIX-M19: raw Postgres codes surfaced from RPC failures
  '23505': 'এই তথ্যটি ইতিমধ্যে জমা দেওয়া হয়েছে।',
  'duplicate key value': 'এই তথ্যটি ইতিমধ্যে জমা দেওয়া হয়েছে।',
  '23503': 'সম্পর্কিত তথ্য খুঁজে পাওয়া যায়নি।',
  '23514': 'ডেটা যাচাইকরণ ব্যর্থ হয়েছে।',
  '42501': 'এই কাজের অনুমতি আপনার নেই।',
  'permission denied': 'এই কাজের অনুমতি আপনার নেই।',
};""",
)

# ---------------------------------------------------------------- L26
# RejectMemberModal: disable confirm until a reason (or custom text) is present
patch(
    "src/components/admin/RejectMemberModal.tsx",
    "SLB-FIX-L26",
    """  if (!member) return null;

  const handleReject = async () => {""",
    """  if (!member) return null;

  // SLB-FIX-L26: confirm stays disabled until a reason code or custom text is present
  const canConfirmReject = useCustom ? customReason.trim().length > 0 : !!selectedReason;

  const handleReject = async () => {""",
)
patch(
    "src/components/admin/RejectMemberModal.tsx",
    "SLB-FIX-L26-btn",
    """                <button onClick={handleReject} disabled={isProcessing}""",
    """                <button onClick={handleReject} disabled={isProcessing || !canConfirmReject}""",
)

# ---------------------------------------------------------------- L31
# ProfileChangeReviewPanel: refresh member data after admin decision
patch(
    "src/components/admin/ProfileChangeReviewPanel.tsx",
    "SLB-FIX-L31-import",
    """import { supabase } from '../../lib/supabase';""",
    """import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext'; // SLB-FIX-L31""",
)
patch(
    "src/components/admin/ProfileChangeReviewPanel.tsx",
    "SLB-FIX-L31-hook",
    """export const ProfileChangeReviewPanel: React.FC = () => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);""",
    """export const ProfileChangeReviewPanel: React.FC = () => {
  const { refreshData } = useApp(); // SLB-FIX-L31
  const [requests, setRequests] = useState<ChangeRequest[]>([]);""",
)
patch(
    "src/components/admin/ProfileChangeReviewPanel.tsx",
    "SLB-FIX-L31-refresh",
    """      } else {
        setMsg({ type: 'success', text: approve ? 'অনুমোদন দেওয়া হয়েছে।' : 'বাতিল করা হয়েছে।' });
        setRequests((prev) => prev.filter((r) => r.id !== id));
      }""",
    """      } else {
        setMsg({ type: 'success', text: approve ? 'অনুমোদন দেওয়া হয়েছে।' : 'বাতিল করা হয়েছে।' });
        setRequests((prev) => prev.filter((r) => r.id !== id));
        // SLB-FIX-L31: refresh member data so the member sees the new name/photo
        await refreshData();
      }""",
)

# ---------------------------------------------------------------- M24
# Schedule status vocabulary: server writes 'published' / 'cancelled'
patch(
    "src/types/index.ts",
    "SLB-FIX-M24-type",
    """export type ScheduleStatus =
  | 'pending'
  | 'processing'
  | 'executed'
  | 'canceled'
  | 'failed'
  | 'skipped';""",
    """export type ScheduleStatus =
  | 'pending'
  | 'processing'
  | 'executed'
  | 'published' // SLB-FIX-M24: server writes 'published' on execution
  | 'canceled'
  | 'cancelled' // SLB-FIX-M24: server writes 'cancelled' (double-l) on cancel
  | 'failed'
  | 'skipped';""",
)
patch(
    "src/components/member/ScheduleModal.tsx",
    "SLB-FIX-M24-badge",
    """                            s.status === 'executed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'""",
    """                            s.status === 'executed' || s.status === 'published' // SLB-FIX-M24
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'""",
)

# ---------------------------------------------------------------- M28
# ScheduleModal: admin date edit disabled too (edit RPC takes no date)
patch(
    "src/components/member/ScheduleModal.tsx",
    "SLB-FIX-M28",
    """                <input
                  type="date"
                  value={targetDate}
                  disabled={!isAdmin && Boolean(editingScheduleId)}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />""",
    """                <input
                  type="date"
                  value={targetDate}
                  disabled={Boolean(editingScheduleId)}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                {editingScheduleId ? (
                  <p className="text-[10px] text-slate-500 mt-1">SLB-FIX-M28: এডিটে তারিখ পরিবর্তন সংরক্ষণ হয় না (edit RPC-তে date প্যারামিটার নেই)।</p>
                ) : null}""",
)

# ---------------------------------------------------------------- M31
# KICKOUT_NOTICE -> KICKOUT_WARNING to match the chapter-14 RPC guards
patch(
    "src/types/index.ts",
    "SLB-FIX-M31-type",
    """export type NoticeType =
  | 'SIMPLE_WARNING'
  | 'ALERT_WARNING'
  | 'KICKOUT_WARNING'
  | 'KICKOUT_NOTICE'
  | 'GENERAL_ANNOUNCEMENT';""",
    """// SLB-FIX-M31: single kickout value 'KICKOUT_WARNING' (matches chapter-14 RPC guards)
export type NoticeType =
  | 'SIMPLE_WARNING'
  | 'ALERT_WARNING'
  | 'KICKOUT_WARNING'
  | 'GENERAL_ANNOUNCEMENT';""",
)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-M31-guard1",
    """    if (params.type === 'KICKOUT_NOTICE' && targetMember?.status !== 'REMOVED' && targetMember?.status !== 'BANNED') {""",
    """    if (params.type === 'KICKOUT_WARNING' && targetMember?.status !== 'REMOVED' && targetMember?.status !== 'BANNED') { // SLB-FIX-M31""",
)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-M31-guard2",
    """      if (params.type === 'KICKOUT_NOTICE' && member.status !== 'REMOVED' && member.status !== 'BANNED') {""",
    """      if (params.type === 'KICKOUT_WARNING' && member.status !== 'REMOVED' && member.status !== 'BANNED') { // SLB-FIX-M31""",
)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-M31-map",
    """      type: params.type === 'ALERT_WARNING' || params.type === 'KICKOUT_NOTICE' ? 'WARNING' : 'NOTICE',""",
    """      type: params.type === 'ALERT_WARNING' || params.type === 'KICKOUT_WARNING' ? 'WARNING' : 'NOTICE', // SLB-FIX-M31""",
    count=2,
)
patch(
    "src/components/admin/AdminNoticeGeneratorModal.tsx",
    "SLB-FIX-M31-option",
    """                <option value="KICKOUT_NOTICE">বহিষ্কার নোটিশ (KICKOUT)</option>""",
    """                <option value="KICKOUT_WARNING">বহিষ্কার নোটিশ (KICKOUT)</option>""",
)
rename_token("src/components/announcements/NoticeSection.tsx", "SLB-FIX-M31", "KICKOUT_NOTICE", "KICKOUT_WARNING", 10)

# ---------------------------------------------------------------- M33
# revokeNotice: remove the dead direct-UPDATE fallback; surface the RPC error
patch(
    "src/lib/supabase.ts",
    "SLB-FIX-M33",
    """      const { data, error } = await supabase.rpc('revoke_notice_secure', {
        p_notice_id: noticeId,
      });
      if (error) {
        // Fallback to direct update if RPC not yet deployed
        const { error: updErr } = await supabase
          .from('notices')
          .update({ status: 'REVOKED' })
          .eq('id', noticeId);
        if (updErr) return { success: false, error: formatSupabaseError(updErr) };
      }
      return { success: true, data };""",
    """      const { data, error } = await supabase.rpc('revoke_notice_secure', {
        p_notice_id: noticeId,
      });
      // SLB-FIX-M33: no direct-UPDATE fallback (no UPDATE policy exists) — surface the RPC error
      if (error) return { success: false, error: formatSupabaseError(error) };
      return { success: true, data };""",
)

# ---------------------------------------------------------------- L19
# DailyAllDoneBox: drop unused addAuditLog; AllDoneRecord: drop never-set UNDER_REVIEW
patch(
    "src/components/alldone/DailyAllDoneBox.tsx",
    "SLB-FIX-L19",
    """  const { allDoneRecords, todayDate, currentUser, confirmFakeAllDone, addAuditLog } = useApp();""",
    """  const { allDoneRecords, todayDate, currentUser, confirmFakeAllDone } = useApp(); // SLB-FIX-L19: addAuditLog was unused""",
)
patch(
    "src/types/index.ts",
    "SLB-FIX-L19-status",
    """  status: 'VERIFIED' | 'REVOKED' | 'UNDER_REVIEW';""",
    """  status: 'VERIFIED' | 'REVOKED'; // SLB-FIX-L19: UNDER_REVIEW never set anywhere""",
)

# ---------------------------------------------------------------- L21
# Local/demo schedule-execution fallback: mirror server semantics (no hardcoded +7)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-L21",
    """      // Points
      setMembers((prev) =>
        prev.map((m) =>
          m.id === owner.id
            ? {
                ...m,
                points: m.points + 7,
                weekly_points: m.weekly_points + 7,
                total_links_submitted: m.total_links_submitted + 1,
              }
            : m
        )
      );""",
    """      // SLB-FIX-L21: local/demo path mirrors server semantics — the server awards
      // points_daily_link_submit (default 5), not a hardcoded 7, and writes status 'published'.
      const localLinkPoints = systemConfig.points_daily_link_submit ?? 5;
      setMembers((prev) =>
        prev.map((m) =>
          m.id === owner.id
            ? {
                ...m,
                points: m.points + localLinkPoints,
                weekly_points: m.weekly_points + localLinkPoints,
                total_links_submitted: m.total_links_submitted + 1,
              }
            : m
        )
      );""",
)
patch(
    "src/context/AppContext.tsx",
    "SLB-FIX-L21-status",
    """            ? { ...s, status: 'executed', is_published: true, published_link_id: newLink.id, executed_at: nowIso }""",
    """            ? { ...s, status: 'published', is_published: true, published_link_id: newLink.id, executed_at: nowIso } // SLB-FIX-L21""",
)

# ---------------------------------------------------------------- SUBMIT_NOT_ALLOWED
# Server error code SUBMIT_NOT_ALLOWED (members.can_submit_links=false) -> Bengali.
# Submit errors are mapped in formatSupabaseError (supabase.ts), which is what
# dailyLinksApi.submitDailyLink returns through.
patch(
    "src/lib/supabase.ts",
    "SLB-FIX-SUBMIT-NOT-ALLOWED",
    """  if (msg.includes('LINK_ALREADY_SUBMITTED')) {
    return 'আপনি ইতিমধ্যে আজকের লিংক জমা দিয়েছেন। দিনে সর্বোচ্চ ১ টি লিংক অনুমোদনযোগ্য।';
  }""",
    """  if (msg.includes('LINK_ALREADY_SUBMITTED')) {
    return 'আপনি ইতিমধ্যে আজকের লিংক জমা দিয়েছেন। দিনে সর্বোচ্চ ১ টি লিংক অনুমোদনযোগ্য।';
  }
  // SLB-FIX-SUBMIT-NOT-ALLOWED: server raises this when members.can_submit_links=false
  if (msg.includes('SUBMIT_NOT_ALLOWED')) {
    return 'আপনার লিংক সাবমিশন অনুমতি বন্ধ আছে।';
  }""",
)

# ---------------------------------------------------------------- summary
print("=" * 64)
print("apply-frontend-fixes.py — patch summary")
print("=" * 64)
ok = [r for r in results if r[0] == "OK"]
sk = [r for r in results if r[0] == "SKIP"]
for st, path, marker in results:
    print("[{}] {} :: {}".format(st, marker, path))
print("-" * 64)
print("OK: {}   SKIP (already applied): {}".format(len(ok), len(sk)))
print()
print("SKIPPED findings (verified, not patched):")
print("  - L3  (initSession app_metadata.status check): NOT dead — repo trigger")
print("        trg_sync_member_status_to_auth (FULL_MASTER_CHAPTER_1_TO_22.sql:748)")
print("        syncs members.status into auth.users app_metadata. Check kept.")
print("  - L19/alt_id_disclosures: zero occurrences in src/ — nothing to remove.")
print("=" * 64)
