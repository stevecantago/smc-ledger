'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  History, Download, Upload, ShieldCheck, Search, Filter, CheckCircle2, 
  AlertCircle, FileText, Database, RefreshCw, UserCheck, Trash2, PlusCircle 
} from 'lucide-react';
import { ActivityLogAction } from '../types/database';

export const ActivityLogView: React.FC = () => {
  const { 
    activityLogs, currentMember, isAdmin, exportFullHouseholdBackup, restoreFullHouseholdBackup 
  } = useHousehold();

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = !searchTerm || (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (!window.confirm('Restoring from backup file will update your household accounts, loans, and settings. Proceed with restoration?')) return;
        
        const res = restoreFullHouseholdBackup(content);
        if (res.success) {
          setMessage({ type: 'success', text: 'Household data restored successfully from backup file!' });
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to restore household backup.' });
        }
      }
    };
    reader.readAsText(file);
  };

  const getActionBadge = (action: ActivityLogAction) => {
    if (action.includes('create')) {
      return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold">CREATE</span>;
    }
    if (action.includes('update') || action.includes('pay') || action.includes('fund')) {
      return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold">UPDATE</span>;
    }
    if (action.includes('delete')) {
      return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold">DELETE</span>;
    }
    if (action.includes('backup')) {
      return <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold">BACKUP</span>;
    }
    return <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold">{action}</span>;
  };

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      {/* Header & Backup Tool Controls */}
      <div className="bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-sky-400" />
            <span>Activity Log & Data Restoration Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time administrative audit log and 1-click JSON data backup & restoration manager.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <button
            onClick={exportFullHouseholdBackup}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all shadow shrink-0"
            title="Download complete JSON backup file of household accounts, loans, and ledger"
          >
            <Download className="w-4 h-4" />
            <span>Export Backup (JSON)</span>
          </button>

          <label className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all shadow shrink-0">
            <Upload className="w-4 h-4" />
            <span>Restore Backup (JSON)</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 border shadow-lg ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />}
          <span className="font-semibold">{message.text}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search activity description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end text-xs">
          <span className="text-slate-400">Total Entries:</span>
          <span className="font-mono font-bold text-sky-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">
            {filteredLogs.length}
          </span>
        </div>
      </div>

      {/* Activity Log List */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-700/60">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic text-xs">
              No activity log entries match your search criteria.
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="p-4 hover:bg-slate-700/30 transition-colors flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 shrink-0 mt-0.5">
                    <History className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {getActionBadge(log.action)}
                      <span className="font-bold text-white">{log.description}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                      <span>By: <strong className="text-slate-300">{log.member_name}</strong></span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  {log.id}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
