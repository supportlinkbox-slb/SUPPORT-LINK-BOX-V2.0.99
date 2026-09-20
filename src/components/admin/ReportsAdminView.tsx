import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  Clock,
  XCircle,
  MessageSquare,
  Send,
  ExternalLink,
  Search,
  Filter,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReportStatus, ReportCategory } from '../../types';
import { formatToBDT } from '../../utils/bangladeshTime';

export const ReportsAdminView: React.FC = () => {
  const { reports, updateReportStatus, sendReportMessage, currentUser } = useApp();

  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[0].id : null
  );
  const [replyText, setReplyText] = useState('');
  const [adminNoteText, setAdminNoteText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const serialMatch = (r.report_serial_display || '').toLowerCase().includes(query);
        const linkSerialMatch = String(r.link_serial).includes(query);
        const reporterMatch = (r.reporter_name || '').toLowerCase().includes(query);
        const ownerMatch = (r.link_owner_name || '').toLowerCase().includes(query);
        const descMatch = (r.description || '').toLowerCase().includes(query);
        if (!serialMatch && !linkSerialMatch && !reporterMatch && !ownerMatch && !descMatch) return false;
      }
      return true;
    });
  }, [reports, statusFilter, categoryFilter, searchQuery]);

  const selectedReport = useMemo(() => {
    return reports.find((r) => r.id === selectedReportId) || (filteredReports.length > 0 ? filteredReports[0] : null);
  }, [reports, selectedReportId, filteredReports]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedReport) return;
    await sendReportMessage(selectedReport.id, replyText.trim());
    setReplyText('');
  };

  const handleStatusChange = async (newStatus: ReportStatus) => {
    if (!selectedReport) return;
    await updateReportStatus(selectedReport.id, newStatus, adminNoteText.trim() || undefined);
    setAdminNoteText('');
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'RESOLVED':
        return (
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            RESOLVED
          </span>
        );
      case 'IN_DISCUSSION':
        return (
          <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            IN DISCUSSION
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            DISMISSED
          </span>
        );
      default:
        return (
          <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            PENDING
          </span>
        );
    }
  };

  const formatCategory = (cat: string) => {
    switch (cat) {
      case 'LINK_NOT_WORKING':
      case 'link_not_working':
        return 'লিংক ওপেন হয় না';
      case 'COMMENTS_DISABLED':
      case 'comments_disabled':
        return 'কমেন্ট বন্ধ';
      case 'POST_NOT_PUBLIC':
      case 'post_not_public':
        return 'পোস্ট পাবলিক নেই';
      case 'REACTION_COMMENT_DISABLED':
      case 'react_comment_disabled':
        return 'রিয়েক্ট ও কমেন্ট বন্ধ';
      case 'ADULT_POST':
      case 'adult_post':
        return 'অ্যাডাল্ট পোস্ট';
      case 'POLITICAL_POST':
      case 'political_post':
        return 'রাজনৈতিক পোস্ট';
      default:
        return cat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <span>Problem Reports & Support Disputes (Chapter 15)</span>
          </h2>
          <p className="text-xs text-slate-400">
            লিংক সমস্যা, কমেন্ট ডিসঅ্যাবল বা নিয়মলঙ্ঘন সংক্রান্ত রিপোর্ট তদন্ত ও সমাধান করুন
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-mono px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            মোট রিপোর্ট: <strong className="text-cyan-400">{reports.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, link #, reporter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="ALL">সকল স্ট্যাটাস (All Statuses)</option>
          <option value="PENDING">পেন্ডিং (Pending)</option>
          <option value="IN_DISCUSSION">আলোচনাধীন (In Discussion)</option>
          <option value="RESOLVED">মীমাংসিত (Resolved)</option>
          <option value="DISMISSED">বাতিলকৃত (Dismissed)</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="ALL">সকল ক্যাটাগরি (All Categories)</option>
          <option value="LINK_NOT_WORKING">Link Not Working</option>
          <option value="COMMENTS_DISABLED">Comments Disabled</option>
          <option value="POST_NOT_PUBLIC">Post Not Public</option>
          <option value="REACTION_COMMENT_DISABLED">React & Comment Disabled</option>
          <option value="ADULT_POST">Adult Post</option>
          <option value="POLITICAL_POST">Political Post</option>
        </select>
      </div>

      {filteredReports.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm font-bold text-white">কোন রিপোর্ট পাওয়া যায়নি</div>
          <p className="text-xs text-slate-500">বর্তমান ফিল্টার শর্তে কোন রেকর্ড নেই।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Report List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredReports.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedReportId(r.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  selectedReport?.id === r.id
                    ? 'bg-slate-850 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-lg'
                    : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-cyan-400">
                      লিংক #{r.link_serial}
                    </span>
                    {r.report_serial_display && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {r.report_serial_display}
                      </span>
                    )}
                  </div>
                  {getStatusBadge(r.status)}
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  মালিক: {r.link_owner_name}
                </div>
                <div className="text-[11px] text-red-300 font-medium mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                  <span>{formatCategory(r.category)}</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                  <span>রিপোর্টার: {r.reporter_name}</span>
                  <span>{formatToBDT(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Active Report Conversation & Admin Actions */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-h-[580px]">
            {selectedReport ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="border-b border-slate-800 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">
                            লিংক #{selectedReport.link_serial} রিপোর্ট বিস্তারিত
                          </h3>
                          {selectedReport.report_serial_display && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                              {selectedReport.report_serial_display}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          রিপোর্টার: <span className="text-cyan-400 font-semibold">{selectedReport.reporter_name}</span> • লিঙ্ক মালিক: <span className="text-amber-400 font-semibold">{selectedReport.link_owner_name}</span>
                        </p>
                      </div>

                      {/* Status Changer Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStatusChange('RESOLVED')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 text-xs font-semibold transition"
                        >
                          সমাধান (Resolve)
                        </button>
                        <button
                          onClick={() => handleStatusChange('DISMISSED')}
                          className="px-3 py-1.5 rounded-xl bg-slate-850 text-slate-400 border border-slate-700 hover:bg-slate-800 text-xs font-semibold transition"
                        >
                          বাতিল (Dismiss)
                        </button>
                      </div>
                    </div>

                    {/* Report Box */}
                    <div className="mt-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-400">ক্যাটাগরি:</span>
                          <span className="text-red-300 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-900/40">
                            {formatCategory(selectedReport.category)}
                          </span>
                        </div>
                        {getStatusBadge(selectedReport.status)}
                      </div>

                      <div>
                        <span className="font-semibold text-slate-400 block mb-0.5">বিবরণ:</span>
                        <p className="text-slate-300 leading-relaxed">{selectedReport.description}</p>
                      </div>

                      {selectedReport.screenshot_url && (
                        <div className="pt-1">
                          <a
                            href={selectedReport.screenshot_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 underline text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>প্রমাণ / স্ক্রিনশট দেখুন</span>
                          </a>
                        </div>
                      )}

                      {selectedReport.admin_notes && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-amber-300">
                          <strong>Admin Note:</strong> {selectedReport.admin_notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages Discussion Stream */}
                  <div className="py-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                    {(!selectedReport.messages || selectedReport.messages.length === 0) ? (
                      <div className="text-center text-slate-500 py-6 text-xs">
                        এখনো কোন আলোচনা বার্তা পাঠানো হয়নি।
                      </div>
                    ) : (
                      selectedReport.messages.map((msg) => {
                        const isSelf = msg.sender_id === currentUser?.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-md p-3 rounded-2xl text-xs shadow-sm ${
                                isSelf
                                  ? 'bg-cyan-600 text-white rounded-br-none'
                                  : 'bg-slate-850 border border-slate-800 text-slate-200 rounded-bl-none'
                              }`}
                            >
                              <div className="text-[10px] font-bold opacity-80 mb-0.5 flex items-center gap-1">
                                <span>{msg.sender_name}</span>
                                <span className="opacity-60 text-[9px] uppercase">({msg.sender_role})</span>
                              </div>
                              <div className="leading-relaxed">{msg.message}</div>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-0.5 font-mono">
                              {formatToBDT(msg.created_at)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer Reply Form & Admin Resolution Note */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="এডমিন নোট (ঐচ্ছিক - রেজোলিউশনের সাথে যুক্ত হবে)..."
                      value={adminNoteText}
                      onChange={(e) => setAdminNoteText(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                  <form onSubmit={handleSendReply} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="রিপোর্টে সরাসরি উত্তর লিখুন..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>পাঠান</span>
                    </button>
                  </form>
                </div>
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
