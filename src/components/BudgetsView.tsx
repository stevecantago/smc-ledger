'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ShieldCheck, Plus, Edit2, AlertTriangle, AlertCircle, Download } from 'lucide-react';
import { Category } from '../types/database';
import { exportBudgetSummaryToCsv } from '../lib/exportCsv';
import { CategoryIcon, IconPickerGrid } from './CategoryIcon';

export const BudgetsView: React.FC = () => {
  const { categories, transactions, isAdmin, addCategory, updateCategoryLimit } = useHousehold();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // New Category Form
  const [name, setName] = useState('');
  const [iconSlug, setIconSlug] = useState('graduation-cap');
  const [budgetLimit, setBudgetLimit] = useState('');

  // Limit Edit Form
  const [newLimit, setNewLimit] = useState('');

  const now = new Date();
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const categoriesWithAlerts = categories.map(cat => {
    const catSpend = currentMonthTx
      .filter(t => t.type === 'expense' && t.category_id === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const limit = cat.monthly_budget_limit;
    const remaining = limit - catSpend;
    const percent = limit > 0 ? Math.round((catSpend / limit) * 100) : 0;
    const isOver = catSpend > limit;
    const isWarning = percent >= 85 && !isOver;

    return { ...cat, catSpend, remaining, percent, isOver, isWarning };
  });

  const overBudgetCategories = categoriesWithAlerts.filter(c => c.isOver);
  const warningCategories = categoriesWithAlerts.filter(c => c.isWarning);

  const handleExportCsv = () => {
    exportBudgetSummaryToCsv(categories, transactions);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory({
      name: name.trim(),
      icon_slug: iconSlug,
      monthly_budget_limit: parseFloat(budgetLimit) || 0,
    });
    setName('');
    setBudgetLimit('');
    setShowAddModal(false);
  };

  const handleUpdateLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    updateCategoryLimit(editingCategory.id, parseFloat(newLimit) || 0);
    setEditingCategory(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>Shared Household Envelope Budgets</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Prevent double-spending on shared obligations with real-time category spending limits and threshold alerts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow"
            title="Export Monthly Budget Summary Report to CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Report CSV</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Envelope</span>
            </button>
          )}
        </div>
      </div>

      {/* Budget Alerts Banner */}
      {(overBudgetCategories.length > 0 || warningCategories.length > 0) && (
        <div className="space-y-2">
          {overBudgetCategories.map(c => (
            <div key={c.id} className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong className="text-white">{c.name}</strong> is over budget by <strong>₱{Math.abs(c.remaining).toFixed(2)}</strong> ({c.percent}% utilized).
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40">
                Action Required
              </span>
            </div>
          ))}

          {warningCategories.map(c => (
            <div key={c.id} className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-white">{c.name}</strong> has reached <strong>{c.percent}%</strong> of its monthly limit (₱{c.remaining.toFixed(2)} left).
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                Warning (&gt;85%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categoriesWithAlerts.map(cat => (
          <div 
            key={cat.id} 
            className={`bg-slate-800/90 border rounded-xl p-5 space-y-4 shadow-lg transition-all ${
              cat.isOver 
                ? 'border-rose-500/60 ring-1 ring-rose-500/30' 
                : cat.isWarning 
                  ? 'border-amber-500/60 ring-1 ring-amber-500/30' 
                  : 'border-slate-700/80'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center">
                  <CategoryIcon slug={cat.icon_slug} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{cat.name}</h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[11px] text-slate-400">Monthly Envelope</span>
                    {cat.isOver ? (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.2 rounded border border-rose-500/40">
                        OVER BUDGET
                      </span>
                    ) : cat.isWarning ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/40">
                        &gt;85% SPENT
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setNewLimit(cat.monthly_budget_limit.toString());
                  }}
                  title="Edit Monthly Limit"
                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Meter */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Spent this month</span>
                <span className={`font-mono font-bold ${cat.isOver ? 'text-rose-400' : 'text-slate-200'}`}>
                  ₱{cat.catSpend.toFixed(2)} / ₱{cat.monthly_budget_limit.toFixed(2)}
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    cat.isOver ? 'bg-rose-500' : cat.isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${cat.percent}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] font-medium pt-1">
                <span className={cat.isOver ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {cat.isOver ? `Over budget by ₱${Math.abs(cat.remaining).toFixed(2)}` : `₱${cat.remaining.toFixed(2)} remaining`}
                </span>
                <span className="text-slate-400">{cat.percent}% used</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Category Modal with Visual Icon Picker Grid */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create Budget Envelope Category</h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. School Dues - Kid 1, Healthcare, Transport"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Envelope Budget Limit (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="10000.00"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              {/* Interactive Visual Icon Picker */}
              <IconPickerGrid 
                selectedSlug={iconSlug} 
                onSelectSlug={setIconSlug} 
              />

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-all shadow"
                >
                  Create Envelope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Limit Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <CategoryIcon slug={editingCategory.icon_slug} className="w-5 h-5" />
              <span>Edit Limit: {editingCategory.name}</span>
            </h3>

            <form onSubmit={handleUpdateLimitSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Budget Limit (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Save Budget Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
