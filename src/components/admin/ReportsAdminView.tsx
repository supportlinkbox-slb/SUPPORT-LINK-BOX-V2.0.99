import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, Clock, XCircle, MessageSquare, Send, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReportStatus } from '../../types';
import { formatToBDT } from '../../utils/bangladeshTime';

export const ReportsAdminView: React.FC = () => {
  const { reports, updateReportStatus, sendReportMessage, currentUser } = useApp();

  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[0].id : null
  );
  const [replyText, setReplyText] = useState('');

  const selectedReport = reports.find((r) => r.id === selectedReportId);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedReportId) return;
    sendReportMessage(selectedReportId, replyText.trim());
    setReplyText('');
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">RESOLVED</span>;
      case 'IN_DISCUSSION':
        return <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">IN DISCUSSION</span>;
      case 'DISMISSED':
        return <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded">DISMISSED</span>;
      default:
        return <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">PENDING</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <span>Problem Reports & Support Disputes</span>
          </h2>
          <p className="text-xs text-slate-400">
            লিংক সমস্যা, কমেন্ট বন্ধ বা অনুপযুক্ত পোস্ট সংক্রান্ত রিপোর্ট তদন্ত করুন
          </p>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          মোট রিপোর্ট: {reports.length} টি
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm font-bold text-white">কোন পেন্ডিং রিপোর্ট নেই</div>
          <p className="text-xs text-slate-500">সব লিংক সুন্দরভাবে কাজ করছে।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Report List */}
          <div className="lg:col-span-5 space-y-2.5">
            {reports.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedReportId(r.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  selectedReportId === r.id
                    ? 'bg-slate-850 border-cyan-500/60 ring-1 ring-cyan-500/40'
                    : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono font-bold text-xs text-cyan-400">
                    লিংক #{r.link_serial}
                  </span>
                  {getStatusBadge(r.status)}
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  মালিক: {r.link_owner_name}
                </div>
                <div className="text-[11px] text-amber-300 mt-0.5">
                  সমস্যা: {r.category}
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                  <span>রিপোর্টার: {r.reporter_name}</span>
                  <span>{formatToBDT(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Active Report Conversation & Admin Actions */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-h-[480px]">
            {selectedReport ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        রিপোর্ট বিবরণী: লিংক #{selectedReport.link_serial}
                      </h3>
                      <p className="text-xs text-slate-400">
                        রিপোর্টার: <span className="text-cyan-400">{selectedReport.reporter_name}</span> • লিঙ্ক মালিক: <span className="text-amber-400">{selectedReport.link_owner_name}</span>
                      </p>
                    </div>

                    {/* Status Changer Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, 'RESOLVED')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold hover:bg-emerald-900"
                      >
                        সমাধান (Resolved)
                      </button>
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, 'DISMISSED')}
                        className="px-2.5 py-1 rounded-lg bg-slate-850 text-slate-400 border border-slate-700 text-xs font-semibold hover:bg-slate-800"
                      >
                        বাতিল (Dismiss)
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-200">
                    <span className="font-semibold text-slate-400 block mb-0.5">সমস্যার ক্যাটাগরি:</span>
                    <span className="text-red-300 font-bold">{selectedReport.category}</span>
                    <p className="mt-1 text-slate-300">{selectedReport.description}</p>
                    {selectedReport.screenshot_url && (
                      <a
                        href={selectedReport.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 underline mt-2 text-[11px]"
                      >
                        <span>স্ক্রিনশট দেখুন</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Messages Discussion Stream */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                  {selectedReport.messages?.map((msg) => {
                    const isSelf = msg.sender_id === currentUser?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-3 rounded-2xl text-xs ${
                            isSelf
                              ? 'bg-cyan-600 text-white rounded-br-none'
                              : 'bg-slate-850 border border-slate-800 text-slate-200 rounded-bl-none'
                          }`}
                        >
                          <div className="text-[10px] font-bold opacity-75 mb-0.5">
                            {msg.sender_name} ({msg.sender_role})
                          </div>
                          <div>{msg.message}</div>
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5">
                          {formatToBDT(msg.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="রিপোর্টে উত্তর লিখুন..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>পাঠান</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center text-slate-500 my-auto text-xs">
                তালিকা থেকে একটি রিপোর্ট নির্বাচন করুন
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
