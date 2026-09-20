import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldBan, User, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminInviteList: React.FC = () => {
  const { currentUser } = useApp();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invite_tokens')
        .select(`
          id,
          status,
          created_at,
          expires_at,
          used_at,
          revoked_at,
          members!invite_tokens_member_id_fkey(member_number, name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setInvites(data || []);
    } catch (err: any) {
      setErrorMsg('ইনভাইট লিস্ট লোড করতে সমস্যা হয়েছে।');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER') {
      fetchInvites();
    }
  }, [currentUser]);

  const handleRevoke = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই ইনভাইটেশনটি বাতিল করতে চান?')) return;
    
    try {
      const { error } = await supabase
        .from('invite_tokens')
        .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setInvites(invites.map(inv => inv.id === id ? { ...inv, status: 'REVOKED' } : inv));
    } catch (err: any) {
      console.error(err);
      alert('ইনভাইট বাতিল করতে সমস্যা হয়েছে।');
    }
  };

  if (loading) return <div className="text-center p-6 text-slate-400 text-xs">লোড হচ্ছে...</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-indigo-400" />
        <span>Recent Invites</span>
      </h3>
      
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-3 px-4 font-medium uppercase tracking-wider">Member ID</th>
              <th className="py-3 px-4 font-medium uppercase tracking-wider">Email</th>
              <th className="py-3 px-4 font-medium uppercase tracking-wider">Status</th>
              <th className="py-3 px-4 font-medium uppercase tracking-wider">Created</th>
              <th className="py-3 px-4 font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {invites.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">কোনো ইনভাইট পাওয়া যায়নি।</td>
              </tr>
            ) : (
              invites.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4 text-slate-200">{inv.members?.member_number}</td>
                  <td className="py-3 px-4 text-slate-400">{inv.members?.email}</td>
                  <td className="py-3 px-4">
                    {inv.status === 'ACTIVE' && <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3"/> Pending</span>}
                    {inv.status === 'USED' && <span className="inline-flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3"/> Used</span>}
                    {inv.status === 'EXPIRED' && <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3"/> Expired</span>}
                    {inv.status === 'REVOKED' && <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full"><ShieldBan className="w-3 h-3"/> Revoked</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    {inv.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        className="text-[10px] bg-slate-800 hover:bg-red-500 hover:text-white text-slate-300 px-3 py-1.5 rounded-lg transition"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
