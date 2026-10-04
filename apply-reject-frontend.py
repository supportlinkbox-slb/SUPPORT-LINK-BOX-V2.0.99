#!/usr/bin/env python3
# Frontend patch: reject dialog with predefined reasons + blacklist button
# Run from repo root: python3 apply-reject-frontend.py
import re, os

# ── 1. New RejectMemberModal component ──
modal_code = '''import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, X, Ban } from 'lucide-react';
import { MemberProfile } from '../../types';

export const REJECT_REASONS = [
  { code: 'NAME_MISMATCH', bn: 'ফেসবুক আইডির নাম এবং রেজিস্ট্রেশনের নাম মিলছে না', en: 'Facebook name mismatch' },
  { code: 'PHOTO_MISMATCH', bn: 'ফেসবুক প্রোফাইল ছবি এবং রেজিস্ট্রেশনের ছবি মিলছে না', en: 'Profile photo mismatch' },
  { code: 'INVALID_FB_LINK', bn: 'ফেসবুক প্রোফাইল লিংক সঠিক নয়', en: 'Invalid Facebook link' },
];

interface RejectMemberModalProps {
  member: MemberProfile | null;
  onClose: () => void;
  onReject: (memberId: string, reasonCode: string | null, customReason: string) => Promise<void>;
  onBlacklist: (memberId: string, email: string, fbLink: string, reason: string) => Promise<void>;
  isProcessing: boolean;
}

export const RejectMemberModal: React.FC<RejectMemberModalProps> = ({
  member, onClose, onReject, onBlacklist, isProcessing,
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setSelectedReason(null); setCustomReason(''); setUseCustom(false);
      setShowBlacklist(false); setBlacklistReason(''); setError(null);
    }
  }, [member]);

  if (!member) return null;

  const handleReject = async () => {
    if (!useCustom && !selectedReason) { setError('একটি কারণ সিলেক্ট করুন বা কাস্টম কারণ লিখুন।'); return; }
    if (useCustom && !customReason.trim()) { setError('কাস্টম কারণ লিখুন।'); return; }
    setError(null);
    await onReject(member.id, useCustom ? null : selectedReason, customReason.trim());
  };

  const handleBlacklist = async () => {
    if (!blacklistReason.trim()) { setError('ব্ল্যাকলিস্টের কারণ লিখুন।'); return; }
    setError(null);
    await onBlacklist(member.id, member.email, member.facebook_url || '', blacklistReason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">রেজিস্ট্রেশন বাতিল</h3>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-white font-bold text-sm">{member.name} <span className="font-mono text-cyan-400 text-xs">({member.member_number})</span></div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{member.email}</div>
          </div>

          {!showBlacklist ? (
            <>
              <p className="text-slate-300 font-semibold">বাতিলের কারণ সিলেক্ট করুন:</p>
              <div className="space-y-2">
                {REJECT_REASONS.map((r) => (
                  <label key={r.code} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${selectedReason === r.code && !useCustom ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'}`}>
                    <input type="radio" name="reject-reason" checked={selectedReason === r.code && !useCustom}
                      onChange={() => { setSelectedReason(r.code); setUseCustom(false); setError(null); }}
                      className="mt-0.5 accent-red-500" />
                    <span className="text-slate-200 text-sm">{r.bn}</span>
                  </label>
                ))}
                <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${useCustom ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'}`}>
                  <input type="radio" name="reject-reason" checked={useCustom}
                    onChange={() => { setUseCustom(true); setError(null); }}
                    className="mt-0.5 accent-red-500" />
                  <span className="text-slate-200 text-sm">অন্য কারণ (নিচে লিখুন)</span>
                </label>
              </div>
              {useCustom && (
                <textarea rows={3} value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="কাস্টম কারণ লিখুন... (member-এর email-এ যাবে)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm" />
              )}
              <p className="text-slate-500 text-[11px]">📧 Member-এর email-এ automatic বাংলা+English email যাবে।</p>
              {error && <p className="text-red-400 text-[11px]">{error}</p>}
            </>
          ) : (
            <>
              <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3 text-red-300 text-xs">
                ⚠️ <b>সতর্কতা:</b> ব্ল্যাকলিস্ট করলে এই email + Facebook লিংক দিয়ে <b>কখনো</b> রেজিস্ট্রেশন করা যাবে না। Auth account delete হয়ে যাবে।
              </div>
              <label className="block text-slate-300 font-semibold">ব্ল্যাকলিস্টের কারণ *</label>
              <textarea rows={3} value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="কেন ব্ল্যাকলিস্ট করছেন..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm" />
              {error && <p className="text-red-400 text-[11px]">{error}</p>}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
          {!showBlacklist ? (
            <>
              <button onClick={() => setShowBlacklist(true)} disabled={isProcessing}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-semibold flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> ব্ল্যাকলিস্ট
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">বাতিল</button>
                <button onClick={handleReject} disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Reject করুন
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setShowBlacklist(false)} disabled={isProcessing} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">← ফেরত</button>
              <button onClick={handleBlacklist} disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} <Ban className="w-3.5 h-3.5" /> Confirm Blacklist
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
'''

os.makedirs('src/components/admin', exist_ok=True)
with open('src/components/admin/RejectMemberModal.tsx', 'w') as f:
    f.write(modal_code)
print("RejectMemberModal.tsx: created")

# ── 2. Update supabase.ts: rejectMember → Edge Function, add blacklistMember ──
path = 'src/lib/supabase.ts'
with open(path) as f:
    c = f.read()

old_reject = """  async rejectMember(targetId: string, reason?: string): Promise<ApiResponse<any>> {
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
  },"""

new_reject = """  async rejectMember(targetId: string, reasonCode?: string | null, customReason?: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-reject-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ member_id: targetId, reason_code: reasonCode || null, custom_reason: customReason || '' }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, error: json.error || 'Reject failed' };
      return { success: true, data: json };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async blacklistMember(targetId: string, email: string, fbLink: string, reason: string): Promise<ApiResponse<any>> {
    try {
      if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-blacklist-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ member_id: targetId, email, fb_link: fbLink, reason }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, error: json.error || 'Blacklist failed' };
      return { success: true, data: json };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },"""

if old_reject in c:
    c = c.replace(old_reject, new_reject, 1)
    print("supabase.ts: rejectMember updated + blacklistMember added")
else:
    print("supabase.ts: pattern not found, skipping")

# Check SUPABASE_URL / SUPABASE_ANON_KEY constants exist
if 'SUPABASE_URL' not in c or 'SUPABASE_ANON_KEY' not in c:
    print("WARNING: SUPABASE_URL/ANON_KEY constants may have different names — check manually")
else:
    print("supabase.ts: URL/KEY constants found")

with open(path, 'w') as f:
    f.write(c)

# ── 3. Update AppContext: rejectMember signature + add blacklistMember ──
path = 'src/context/AppContext.tsx'
with open(path) as f:
    c = f.read()

# 3a. Type declaration
old_type = "  rejectMember: (targetId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;"
new_type = """  rejectMember: (targetId: string, reasonCode?: string | null, customReason?: string) => Promise<{ success: boolean; error?: string }>;
  blacklistMember: (targetId: string, email: string, fbLink: string, reason: string) => Promise<{ success: boolean; error?: string }>;"""
if old_type in c:
    c = c.replace(old_type, new_type, 1)
    print("AppContext: type updated")
else:
    print("AppContext: type pattern not found")

# 3b. Implementation
old_impl = """  const rejectMember = async (targetId: string, reason?: string) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.rejectMember(targetId, reason);"""
new_impl = """  const rejectMember = async (targetId: string, reasonCode?: string | null, customReason?: string) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.rejectMember(targetId, reasonCode, customReason);"""
if old_impl in c:
    c = c.replace(old_impl, new_impl, 1)
    print("AppContext: rejectMember impl updated")
else:
    print("AppContext: impl pattern not found")

# 3c. Add blacklistMember function + export
blacklist_fn = """
  const blacklistMember = async (targetId: string, email: string, fbLink: string, reason: string) => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'DEVELOPER')) {
      return { success: false, error: 'Admin permission required' };
    }
    if (isSupabaseConfigured) {
      const res = await membersApi.blacklistMember(targetId, email, fbLink, reason);
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }
    return { success: false, error: 'Supabase not configured' };
  };
"""
if "    rejectMember,\n" in c:
    c = c.replace("    rejectMember,\n", blacklist_fn + "\n    rejectMember,\n    blacklistMember,\n", 1)
    print("AppContext: blacklistMember added")
else:
    print("AppContext: export pattern not found")

with open(path, 'w') as f:
    f.write(c)

# ── 4. Wire into AdminDashboard ──
path = 'src/components/admin/AdminDashboard.tsx'
with open(path) as f:
    c = f.read()

# 4a. Import
old_import = "import { MemberActionConfirmModal } from './MemberActionConfirmModal';"
if old_import in c:
    c = c.replace(old_import, old_import + "\nimport { RejectMemberModal } from './RejectMemberModal';", 1)
    print("Dashboard: import added")
else:
    # try alternative
    m = re.search(r"from '\./MemberActionConfirmModal'", c)
    if m:
        c = c[:m.end()] + ";\nimport { RejectMemberModal } from './RejectMemberModal';" + c[m.end():]
        print("Dashboard: import added (alt)")
    else:
        print("Dashboard: import pattern not found")

# 4b. Add state — after confirmModalState declaration
m = re.search(r"const \[confirmModalState, setConfirmModalState\][^;]+;", c)
if m:
    c = c[:m.end()] + "\n  const [rejectModalMember, setRejectModalMember] = useState<MemberProfile | null>(null);" + c[m.end():]
    print("Dashboard: state added")
else:
    print("Dashboard: state pattern not found")

# 4c. Replace openRejectConfirm body
old_fn = """  const openRejectConfirm = (target: MemberProfile) => {
    setConfirmModalState({
      isOpen: true,
      type: 'REJECT',
      target,
      title: 'রেজিস্ট্রেশন বাতিল (Reject Registration)',
      message: `আপনি কি ${target.name} (${target.member_number})-এর রেজিস্ট্রেশন আবেদন বাতিল করতে চান?`,
      warning: 'আবেদন বাতিল করা হলে এই ব্যবহারকারী সিস্টেমে লগইন করতে পারবেন না।',
      confirmBtnText: 'বাতিল করুন (Reject)',
      isDanger: true,
      requiresReason: true,
    });
  };"""
new_fn = """  const openRejectConfirm = (target: MemberProfile) => {
    setRejectModalMember(target);
  };

  const handleRejectMember = async (memberId: string, reasonCode: string | null, customReason: string) => {
    setIsProcessingAction(true);
    try {
      const res = await rejectMember(memberId, reasonCode, customReason);
      if (!res.success) throw new Error(res.error || 'Reject failed');
      setRejectModalMember(null);
      setIsDetailsOpen(false);
      await refreshData();
    } catch (err: any) {
      alert('Reject ব্যর্থ: ' + (err.message || 'অজানা ত্রুটি'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleBlacklistMember = async (memberId: string, email: string, fbLink: string, reason: string) => {
    setIsProcessingAction(true);
    try {
      const res = await blacklistMember(memberId, email, fbLink, reason);
      if (!res.success) throw new Error(res.error || 'Blacklist failed');
      setRejectModalMember(null);
      setIsDetailsOpen(false);
      await refreshData();
      alert('ব্ল্যাকলিস্ট সম্পন্ন ✅');
    } catch (err: any) {
      alert('Blacklist ব্যর্থ: ' + (err.message || 'অজানা ত্রুটি'));
    } finally {
      setIsProcessingAction(false);
    }
  };"""
if old_fn in c:
    c = c.replace(old_fn, new_fn, 1)
    print("Dashboard: openRejectConfirm replaced")
else:
    print("Dashboard: openRejectConfirm pattern not found")

# 4d. Render modal — before closing of component, find MemberActionConfirmModal usage
m = re.search(r"<MemberActionConfirmModal[^/]*\/>", c, re.DOTALL)
if m:
    modal_jsx = """
      <RejectMemberModal
        member={rejectModalMember}
        onClose={() => setRejectModalMember(null)}
        onReject={handleRejectMember}
        onBlacklist={handleBlacklistMember}
        isProcessing={isProcessingAction}
      />"""
    c = c[:m.end()] + modal_jsx + c[m.end():]
    print("Dashboard: modal rendered")
else:
    print("Dashboard: MemberActionConfirmModal JSX not found")

# 4e. Get blacklistMember from context — find rejectMember destructuring
m = re.search(r"(\s+)rejectMember,", c)
if m and "blacklistMember" not in c[m.start()-200:m.start()]:
    # Find the destructuring block containing rejectMember
    dm = re.search(r"const \{([^}]*rejectMember[^}]*)\} = useApp\(\);", c, re.DOTALL)
    if dm:
        inner = dm.group(1)
        if "blacklistMember" not in inner:
            new_inner = inner.replace("rejectMember,", "rejectMember,\n    blacklistMember,")
            c = c[:dm.start(1)] + new_inner + c[dm.end(1):]
            print("Dashboard: context destructuring updated")
        else:
            print("Dashboard: already has blacklistMember")
    else:
        # try alternative pattern
        dm2 = re.search(r"\brejectMember\b", c)
        print("Dashboard: destructuring pattern unclear, manual check needed")
else:
    print("Dashboard: destructuring check skipped")

with open(path, 'w') as f:
    f.write(c)

# Fix fallback branch variable name
with open('src/context/AppContext.tsx') as f:
    cc = f.read()
cc = cc.replace(
    "Reason: ${reason || 'No reason provided'}",
    "Reason: ${customReason || reasonCode || 'No reason provided'}"
)
with open('src/context/AppContext.tsx', 'w') as f:
    f.write(cc)
print("AppContext: fallback fixed")

# Fix modal JSX placement (move outside confirmModalState conditional)
with open('src/components/admin/AdminDashboard.tsx') as f:
    cc = f.read()
bad_jsx = '''      {confirmModalState && (
        <MemberActionConfirmModal
          modalState={confirmModalState}
          onClose={() => setConfirmModalState(null)}
          onConfirm={handleExecuteModalConfirm}
          isProcessing={isProcessingAction}
        />
      <RejectMemberModal'''
good_jsx = '''      {confirmModalState && (
        <MemberActionConfirmModal
          modalState={confirmModalState}
          onClose={() => setConfirmModalState(null)}
          onConfirm={handleExecuteModalConfirm}
          isProcessing={isProcessingAction}
        />
      )}

      <RejectMemberModal'''
if bad_jsx in cc:
    cc = cc.replace(bad_jsx, good_jsx, 1)
    # Remove the extra closing paren
    cc = cc.replace(
        '''        isProcessing={isProcessingAction}
      />
      )}''',
        '''        isProcessing={isProcessingAction}
      />''', 1)
    with open('src/components/admin/AdminDashboard.tsx', 'w') as f:
        f.write(cc)
    print("Dashboard: JSX placement fixed")

print("\\nAll done! Run: python3 apply-reject-frontend.py")
