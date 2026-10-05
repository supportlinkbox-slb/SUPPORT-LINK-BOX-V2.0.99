import React, { useState } from 'react';
import { X, Upload, Link as LinkIcon, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          else reject(new Error('compress failed'));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('image load failed'));
    };
    reader.onerror = () => reject(new Error('file read failed'));
  });
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentPhotoUrl: string;
}

export const ProfileChangeRequestModal: React.FC<Props> = ({ isOpen, onClose, currentName, currentPhotoUrl }) => {
  const [newName, setNewName] = useState('');
  const [photoMode, setPhotoMode] = useState<'UPLOAD' | 'LINK'>('UPLOAD');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLink, setPhotoLink] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const nameVal = newName.trim();
    if (!nameVal && !photoFile && !photoLink.trim()) {
      setMsg({ type: 'error', text: 'নাম বা ছবি — অন্তত একটি পরিবর্তন দিন।' });
      return;
    }
    if (nameVal && nameVal.length < 2) {
      setMsg({ type: 'error', text: 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।' });
      return;
    }

    setLoading(true);
    try {
      let photoUrl = photoLink.trim();

      if (photoMode === 'UPLOAD' && photoFile) {
        try {
          const compressed = await compressImage(photoFile);
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
          const { error: upErr } = await supabase.storage.from('avatars').upload(fileName, compressed, { upsert: true });
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
          if (publicUrl) photoUrl = publicUrl;
        } catch (upErr: any) {
          setMsg({ type: 'error', text: 'ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।' });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.rpc('request_profile_change', {
        p_requested_name: nameVal || null,
        p_requested_photo_url: photoUrl || null,
        p_reason: reason.trim() || null,
      });

      if (error) throw error;
      if (data && (data as any).success === false) {
        const code = (data as any).error;
        if (code === 'ALREADY_PENDING') setMsg({ type: 'error', text: 'তোমার একটি আবেদন ইতিমধ্যে অপেক্ষমাণ আছে।' });
        else if (code === 'NOTHING_TO_CHANGE') setMsg({ type: 'error', text: 'পরিবর্তনের কিছু দাওনি।' });
        else setMsg({ type: 'error', text: 'আবেদন পাঠানো যায়নি।' });
        setLoading(false);
        return;
      }

      setMsg({ type: 'success', text: 'আবেদন পাঠানো হয়েছে! অ্যাডমিন অনুমোদন দিলে প্রোফাইল আপডেট হবে।' });
      setNewName(''); setPhotoFile(null); setPhotoLink(''); setReason('');
      setTimeout(onClose, 1800);
    } catch (err: any) {
      setMsg({ type: 'error', text: 'আবেদন পাঠানো যায়নি। আবার চেষ্টা করো।' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">প্রোফাইল পরিবর্তনের আবেদন</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-400 mb-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
          বর্তমান নাম: <span className="text-white font-bold">{currentName}</span>
          <p className="mt-1">অ্যাডমিন অনুমোদন দিলে তবেই পরিবর্তন হবে।</p>
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${msg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">নতুন নাম (ঐচ্ছিক)</label>
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="নতুন নাম লিখো"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">নতুন ছবি (ঐচ্ছিক)</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setPhotoMode('UPLOAD')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${photoMode === 'UPLOAD' ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-slate-950 text-slate-400 border-slate-700'}`}>
                <Upload className="w-3.5 h-3.5 inline mr-1" /> আপলোড
              </button>
              <button type="button" onClick={() => setPhotoMode('LINK')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${photoMode === 'LINK' ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-slate-950 text-slate-400 border-slate-700'}`}>
                <LinkIcon className="w-3.5 h-3.5 inline mr-1" /> লিংক
              </button>
            </div>
            {photoMode === 'UPLOAD' ? (
              <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-cyan-950 file:text-cyan-300 file:text-xs file:font-bold hover:file:bg-cyan-900" />
            ) : (
              <input type="url" value={photoLink} onChange={(e) => setPhotoLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" />
            )}
            {currentPhotoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={currentPhotoUrl} alt="বর্তমান" className="w-10 h-10 rounded-lg object-cover border border-slate-700" />
                <span className="text-[11px] text-slate-500">বর্তমান ছবি</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">কারণ (ঐচ্ছিক)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="কেন বদলাতে চাও?"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500 resize-none" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-black transition flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> {loading ? 'পাঠানো হচ্ছে...' : 'আবেদন পাঠাও'}
          </button>
        </form>
      </div>
    </div>
  );
};
