import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  FileSpreadsheet,
  AlertOctagon,
  ShieldAlert,
  History,
  CheckCircle2,
  Lock,
  Search,
  Loader2,
  TrendingUp,
  Link as LinkIcon,
  AlertTriangle,
  RefreshCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminDashboard: React.FC = () => {
  const { currentUser, auditLogs, refreshData } = useApp();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    // In a real implementation, this would be a secure RPC call.
    // For now, we simulate the data structure required by the dashboard.
    // This will be replaced by actual server-side aggregation.
    await refreshData();
    setDashboardData({
      members: { total: 150, active: 120, pending: 10, suspended: 5, removed: 15 },
      links: { total: 85, currentLinkNumber: 42 },
      support: { completionPercent: 85 },
      allDone: { completionPercent: 90 },
      reports: { pending: 3, inDiscussion: 2, resolved: 10, dismissed: 5 },
      fakeAllDone: { pendingReview: 1 },
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
          <p className="text-sm text-slate-400">Overview of operational status</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition"
        >
          <RefreshCcw className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Active Members" value={dashboardData.members.active} color="cyan" />
        <KPICard title="Pending Reports" value={dashboardData.reports.pending} color="red" />
        <KPICard title="Support Progress" value={`${dashboardData.support.completionPercent}%`} color="emerald" />
        <KPICard title="All Done Progress" value={`${dashboardData.allDone.completionPercent}%`} color="amber" />
      </div>

      {/* Alerts */}
      {dashboardData.fakeAllDone.pendingReview > 0 && (
        <div className="p-4 bg-red-950 border border-red-800 rounded-xl text-red-200 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6" />
          <span>{dashboardData.fakeAllDone.pendingReview} Fake All Done incidents require Admin review.</span>
        </div>
      )}
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value, color }) => {
  const colorClasses: Record<string, string> = {
    cyan: 'border-cyan-800 text-cyan-400',
    red: 'border-red-800 text-red-400',
    emerald: 'border-emerald-800 text-emerald-400',
    amber: 'border-amber-800 text-amber-400',
  };
  return (
    <div className={`bg-slate-900 p-4 rounded-xl border ${colorClasses[color] || 'border-slate-800'}`}>
      <div className="text-xs text-slate-400">{title}</div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
    </div>
  );
};
