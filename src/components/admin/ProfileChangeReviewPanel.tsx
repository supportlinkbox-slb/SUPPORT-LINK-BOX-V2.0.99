import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, User, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext'; // SLB-FIX-L31

interface ChangeRequest {
  id: string;
  member_id: string;
  requested_name: string | null;
  requested_photo_url: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  memberName?: string;
  memberNumber?: string;
  memberEmail?: string;
  memberPhoto?: string;
}

export const ProfileChangeReviewPanel: React.FC = () => {
  const { refreshData } = useApp(); // SLB-FIX-L31
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { data: rows, error } = await supabase
        .from('profile_change_requests')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const list = (rows || []) as ChangeRequest[];
      if (list.length > 0) {
        const ids = [...new Set(list.map((r) => r.member_id))];
        const { data: members } = await supabase
          .from('members')
          .select('id, name, member_number, email, profile_photo_url')
          .in('id', ids);
        const map: Record<string, any> = {};
        (members || []).forEach((m: any) => { map[m.id] = m; });
        list.forEach((r) => {
          const m = map[r.member_id];
          if (m) {
            r.memberName = m.name; r.memberNumber = m.member_number;
            r.memberEmail = m.email; r.memberPhoto = m.profile_photo_url;
          }
        });
      }
      setRequests(list);
    } catch (err: any) {
      setMsg({ type: 'error', text: 'আবেদন লোড করা যায়নি।' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleReview = async (id: string, approve: boolean) => {
    setActing(id);
    setMsg(null);
    try {
      const { data, error } = await supabase.rpc('review_profile_change', {
        p_request_id: id,
        p_approve: approve,
        p_note: (notes[id] || '').trim() || null,
      });
      if (error) throw error;
      if (data && (data as any).success === false) {
        setMsg({ type: 'error', text: 'সিদ্ধান্ত নেওয়া যায়নি।' });
      } else {
        setMsg({ type: 'success', text: approve ? 'অনুমোদন দেওয়া হয়েছে।' : 'বাতিল করা হয়েছে।' });
        setRequests((prev) => prev.filter((r) => r.id !== id));
        // SLB-FIX-L31: refresh member data so the member sees the new name/photo
        await refreshData();
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: 'সিদ্ধান্ত নেওয়া যায়নি। আবার চেষ্টা করো।' });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" />
          প্রোফাইল পরিবর্তনের আবেদন
          {requests.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
              {requests.length}টি অপেক্ষমাণ
            </span>
          )}
        </h3>
        <button onClick={fetchPending} disabled={loading}
          className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${msg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}`}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 text-sm py-8">লোড হচ্ছে...</div>
      ) : requests.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">কোনো অপেক্ষমাণ আবেদন নেই।</div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-bold text-white">{r.memberName || '—'} <span className="text-cyan-400 font-mono text-xs">{r.memberNumber || ''}</span></div>
                  <div className="text-[11px] text-slate-500">{r.memberEmail || ''}</div>
                </div>
                <div className="text-[11px] text-slate-500 shrink-0">{new Date(r.created_at).toLocaleString('bn-BD')}</div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-500 mb-1">বর্তমান</div>
                  <div className="flex items-center gap-2">
                    {r.memberPhoto && <img src={r.memberPhoto} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-700" />}
                    <span className="text-xs text-slate-300 font-bold">{r.memberName}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
                  <div className="text-[11px] text-cyan-400 mb-1">চেয়েছে</div>
                  <div className="flex items-center gap-2">
                    {r.requested_photo_url && <img src={r.requested_photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-cyan-700" />}
                    <span className="text-xs text-white font-bold">{r.requested_name || <span className="text-slate-500">(নাম একই)</span>}</span>
                  </div>
                </div>
              </div>

              {r.reason && (
                <div className="text-xs text-slate-400 mb-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="font-bold text-slate-300">কারণ: </span>{r.reason}
                </div>
              )}

              <input
                type="text" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                placeholder="নোট (ঐচ্ছিক)"
                className="w-full mb-3 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-cyan-500"
              />

              <div className="flex gap-2">
                <button onClick={() => handleReview(r.id, true)} disabled={acting === r.id}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-black transition flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> অনুমোদন
                </button>
                <button onClick={() => handleReview(r.id, false)} disabled={acting === r.id}
                  className="flex-1 py-2.5 rounded-xl bg-red-950 hover:bg-red-900 disabled:opacity-50 text-red-300 border border-red-800 text-xs font-black transition flex items-center justify-center gap-1.5">
                  <XCircle className="w-4 h-4" /> বাতিল
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
