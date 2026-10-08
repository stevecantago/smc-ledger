'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ShieldCheck, Plus, Edit2, Trash2, AlertTriangle, AlertCircle, Download } from 'lucide-react';
import { Category } from '../types/database';
import { exportBudgetSummaryToCsv } from '../lib/exportCsv';
import { CategoryIcon, IconPickerGrid } from './CategoryIcon';

export const BudgetsView: React.FC = () => {
  const { categories, transactions, isAdmin, addCategory, updateCategory, deleteCategory } = useHousehold();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // New Category Form
  const [name, setName] = useState('');
  const [iconSlug, setIconSlug] = useState('graduation-cap');
  const [budgetLimit, setBudgetLimit] = useState('');

  // Edit Category Form
  const [editName, setEditName] = useState('');
  const [editIconSlug, setEditIconSlug] = useState('');
  const [editLimit, setEditLimit] = useState('');

  const now = new Date();
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const expenseCategories = categories.filter(category => category.category_type === 'expense');
  const categoriesWithAlerts = expenseCategories.map(cat => {
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
    exportBudgetSummaryToCsv(expenseCategories, transactions);
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

  const handleUpdateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    updateCategory(editingCategory.id, {
      name: editName.trim(),
      icon_slug: editIconSlug,
      monthly_budget_limit: parseFloat(editLimit) || 0,
    });
    setEditingCategory(null);
  };

  const handleDeleteCategory = (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete envelope category "${cat.name}"?`)) return;
    const res = deleteCategory(cat.id);
    if (!res.success) alert(res.error);
  };

  return (
    <div className="famledger-view space-y-6 pb-28 md:pb-6">
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

      {/* Envelope category table */}
      <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-paper shadow-[var(--fam-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left" aria-label="Monthly envelope category budgets">
            <thead className="bg-brand-canvas text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3 text-right">Monthly limit</th>
                <th scope="col" className="px-4 py-3 text-right">Spent this month</th>
                <th scope="col" className="px-4 py-3 text-right">Remaining</th>
                <th scope="col" className="px-4 py-3">Usage</th>
                {isAdmin && <th scope="col" className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {categoriesWithAlerts.map(cat => {
                const statusText = cat.isOver ? 'Over budget' : cat.isWarning ? 'Near limit' : 'On track';
                const statusClass = cat.isOver ? 'text-[#A43838] bg-[#FBEEEE]' : cat.isWarning ? 'text-[#89520E] bg-[#FAF1E3]' : 'text-[#356326] bg-[#EFF5E8]';
                const usageWidth = Math.min(Math.max(cat.percent, 0), 100);
                return (
                  <tr key={cat.id} className="bg-white align-middle hover:bg-[#F7F8FA]">
                    <th scope="row" className="px-4 py-3.5 font-semibold text-brand-ink">
                      <span className="flex min-w-44 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-sky">
                          <CategoryIcon slug={cat.icon_slug} className="h-4 w-4" />
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </span>
                    </th>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-brand-ink">₱{cat.monthly_budget_limit.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-brand-ink">₱{cat.catSpend.toFixed(2)}</td>
                    <td className={`whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold tabular-nums ${cat.isOver ? 'text-[#A43838]' : 'text-[#356326]'}`}>
                      {cat.isOver ? `−₱${Math.abs(cat.remaining).toFixed(2)}` : `₱${cat.remaining.toFixed(2)}`}
                    </td>
                    <td className="min-w-40 px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-canvas" aria-hidden="true">
                          <div className={`h-full rounded-full ${cat.isOver ? 'bg-brand-orange' : cat.isWarning ? 'bg-[#D48A26]' : 'bg-[#6F8F49]'}`} style={{ width: `${usageWidth}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-brand-muted">{cat.percent}%</span>
                        <span className="sr-only">{statusText}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditName(cat.name);
                              setEditIconSlug(cat.icon_slug);
                              setEditLimit(cat.monthly_budget_limit.toString());
                            }}
                            title="Edit Envelope Category"
                            aria-label={`Edit ${cat.name}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-sky hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                          >
                            <Edit2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            title="Delete Envelope Category"
                            aria-label={`Delete ${cat.name}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-[#FBEEEE] hover:text-[#A43838] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {categoriesWithAlerts.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-sm text-brand-muted">
                    No envelope categories yet. Create one to start tracking monthly limits.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <CategoryIcon slug={editIconSlug} className="w-5 h-5" />
              <span>Edit Category Envelope: {editingCategory.name}</span>
            </h3>

            <form onSubmit={handleUpdateCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Budget Limit (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <IconPickerGrid 
                selectedSlug={editIconSlug} 
                onSelectSlug={setEditIconSlug} 
              />

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
                  Save Category Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
