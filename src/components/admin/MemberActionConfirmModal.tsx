import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, XCircle, Loader2, X } from 'lucide-react';
import { MemberProfile, UserRole, MemberStatus } from '../../types';

export type ActionModalType = 'ROLE' | 'STATUS' | 'APPROVE' | 'REJECT';

export interface ActionModalState {
  isOpen: boolean;
  type: ActionModalType;
  target: MemberProfile;
  newRole?: UserRole;
  newStatus?: MemberStatus;
  title: string;
  message: string;
  warning?: string;
  confirmBtnText: string;
  isDanger?: boolean;
  requiresReason?: boolean;
}

interface MemberActionConfirmModalProps {
  modalState: ActionModalState | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isProcessing: boolean;
}

export const MemberActionConfirmModal: React.FC<MemberActionConfirmModalProps> = ({
  modalState,
  onClose,
  onConfirm,
  isProcessing,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (modalState?.isOpen) {
      setReason('');
      setValidationError(null);
    }
  }, [modalState]);

  if (!modalState || !modalState.isOpen) return null;

  const handleConfirmClick = async () => {
    if (modalState.requiresReason && !reason.trim()) {
      setValidationError('এই অ্যাকশনের জন্য কারণ (Reason) উল্লেখ করা বাধ্যতামূলক।');
      return;
    }
    setValidationError(null);
    await onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleUp">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                modalState.isDanger
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              }`}
            >
              {modalState.isDanger ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <h3 className="text-base font-bold text-white">{modalState.title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-slate-400">টার্গেট সদস্য:</div>
            <div className="text-white font-bold text-sm mt-0.5">
              {modalState.target.name}{' '}
              <span className="font-mono text-cyan-400 text-xs">
                ({modalState.target.member_number})
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Email: {modalState.target.email}
            </div>
          </div>

          <p className="text-slate-200 text-sm leading-relaxed">{modalState.message}</p>

          {modalState.warning && (
            <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-3 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>{modalState.warning}</span>
            </div>
          )}

          {/* Reason Input (Optional or Required based on action) */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              অ্যাকশনের কারণ (Reason)
              {modalState.requiresReason ? (
                <span className="text-red-400"> * (বাধ্যতামূলক)</span>
              ) : (
                <span className="text-slate-500 font-normal"> (ঐচ্ছিক)</span>
              )}
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. নিয়ম লঙ্ঘন, সাময়িক তদন্ত, বা রেফারেন্স নোট..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            {validationError && (
              <p className="text-red-400 text-[11px] mt-1">{validationError}</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg ${
              modalState.isDanger
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30'
            } disabled:opacity-50`}
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{modalState.confirmBtnText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
