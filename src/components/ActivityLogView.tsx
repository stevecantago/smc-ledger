'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { History, Download, Upload, Search, Filter, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { ActivityLogAction } from '../types/database';

export const ActivityLogView: React.FC = () => {
  const { 
    activityLogs, currentMember, isAdmin, exportFullHouseholdBackup, restoreFullHouseholdBackup, resetDemoData
  } = useHousehold();

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredLogs = activityLogs.filter(log => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [log.description, log.member_name, log.action].some(value => value?.toLowerCase().includes(query));
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });
  const actionOptions = Array.from(new Set(activityLogs.map(log => log.action))).sort();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (!window.confirm('Restoring from backup file will update your household accounts, loans, and settings. Proceed with restoration?')) return;
        
        const res = await restoreFullHouseholdBackup(content);
        if (res.success) {
          setMessage({ type: 'success', text: 'Household data restored successfully from backup file!' });
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to restore household backup.' });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = () => {
    if (!window.confirm('Reset demo data? This clears saved household data from this browser only.')) return;

    const result = resetDemoData();
    if (result.success) {
      setMessage({ type: 'success', text: 'Demo data reset in this browser.' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Unable to reset demo data.' });
    }
  };

  const getActionBadge = (action: ActivityLogAction) => {
    if (action.includes('create')) {
      return <span className="inline-flex rounded-full border border-emerald-200 bg-brand-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#356326]">Create</span>;
    }
    if (action.includes('update') || action.includes('pay') || action.includes('fund')) {
      return <span className="inline-flex rounded-full border border-orange-200 bg-[#FFF0E7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-orange">Update</span>;
    }
    if (action.includes('delete')) {
      return <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-800">Delete</span>;
    }
    if (action.includes('backup')) {
      return <span className="inline-flex rounded-full border border-sky-200 bg-brand-sky px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16445A]">Backup</span>;
    }
    return <span className="inline-flex rounded-full border border-brand-line bg-brand-canvas px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-ink">{action.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="famledger-view space-y-6 pb-28 md:pb-6">
      {/* Header & Backup Tool Controls */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand-line bg-brand-paper p-5 shadow-[var(--fam-shadow)] md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <History className="w-5 h-5 text-brand-orange" />
            <span>System Logs & Data Restoration Center</span>
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            Real-time administrative audit log and 1-click JSON data backup & restoration manager.
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
          <button
            onClick={exportFullHouseholdBackup}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-canvas md:w-auto"
            title="Download complete JSON backup file of household accounts, loans, and ledger"
          >
            <Download className="w-4 h-4" />
            <span>Export Backup (JSON)</span>
          </button>

          <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-orange px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#AB4311] md:w-auto">
            <Upload className="w-4 h-4" />
            <span>Restore Backup (JSON)</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          {isAdmin && (
            <button
              type="button"
              onClick={handleResetDemoData}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 md:w-auto"
              title="Clear saved household demo data from this browser"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Demo Data</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div role="status" className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${
          message.type === 'success' 
            ? 'border-emerald-200 bg-brand-mint text-[#24451C]'
            : 'border-rose-200 bg-rose-50 text-rose-900'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" /> : <AlertCircle className="h-5 w-5 shrink-0 text-rose-700" />}
          <span className="font-semibold">{message.text}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-brand-line bg-brand-paper p-4 shadow-[var(--fam-shadow)] sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-brand-muted" />
          <input
            type="text"
            aria-label="Search activity log"
            placeholder="Search activity, member, or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-brand-muted">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Filter activity by action</span>
            <select value={actionFilter} onChange={event => setActionFilter(event.target.value)} className="min-h-11 rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
              <option value="all">All actions</option>
              {actionOptions.map(action => <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <p className="text-sm text-brand-muted sm:whitespace-nowrap"><span className="font-semibold text-brand-ink">{filteredLogs.length}</span> {filteredLogs.length === 1 ? 'entry' : 'entries'}</p>
        </div>
      </div>

      {/* Activity Log List */}
      <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-paper shadow-[var(--fam-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">Household activity log entries</caption>
            <thead className="bg-brand-canvas text-xs font-semibold uppercase tracking-wide text-brand-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Activity</th>
                <th scope="col" className="px-4 py-3">Member</th>
                <th scope="col" className="px-4 py-3">Date &amp; time</th>
                <th scope="col" className="px-4 py-3">Record ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
          {filteredLogs.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-brand-muted">No activity log entries match your search criteria.</td></tr>
          ) : (
            filteredLogs.map(log => (
              <tr key={log.id} className="align-top transition-colors hover:bg-brand-canvas">
                <td className="whitespace-nowrap px-4 py-3">{getActionBadge(log.action)}</td>
                <th scope="row" className="max-w-[34rem] px-4 py-3 font-semibold text-brand-ink">{log.description}</th>
                <td className="whitespace-nowrap px-4 py-3 text-brand-muted">{log.member_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-muted">{new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="max-w-40 px-4 py-3"><span className="block truncate font-mono text-xs text-brand-muted" title={log.id}>{log.id}</span></td>
              </tr>
            ))
          )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
