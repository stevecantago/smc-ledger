'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ShieldCheck, Plus, Edit2, AlertCircle, ShoppingCart, Zap, Utensils, Film, BookOpen, Receipt } from 'lucide-react';
import { Category } from '../types/database';

export const BudgetsView: React.FC = () => {
  const { categories, transactions, isAdmin, addCategory, updateCategoryLimit } = useHousehold();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // New Category Form
  const [name, setName] = useState('');
  const [iconSlug, setIconSlug] = useState('shopping-cart');
  const [budgetLimit, setBudgetLimit] = useState('');

  // Limit Edit Form
  const [newLimit, setNewLimit] = useState('');

  const now = new Date();
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

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

  const getIconComponent = (slug: string) => {
    switch (slug) {
      case 'shopping-cart': return <ShoppingCart className="w-5 h-5 text-sky-400" />;
      case 'zap': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'utensils': return <Utensils className="w-5 h-5 text-rose-400" />;
      case 'film': return <Film className="w-5 h-5 text-indigo-400" />;
      case 'book-open': return <BookOpen className="w-5 h-5 text-emerald-400" />;
      default: return <Receipt className="w-5 h-5 text-slate-400" />;
    }
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
            Prevent double-spending on shared obligations with real-time category spending limits.
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Category Envelope</span>
          </button>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            Read-only mode (Admin manages monthly envelope limits)
          </div>
        )}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map(cat => {
          const catSpend = currentMonthTx
            .filter(t => t.type === 'expense' && t.category_id === cat.id)
            .reduce((sum, t) => sum + t.amount, 0);

          const limit = cat.monthly_budget_limit;
          const remaining = limit - catSpend;
          const percent = limit > 0 ? Math.min(Math.round((catSpend / limit) * 100), 100) : 0;
          const isOver = catSpend > limit;

          return (
            <div key={cat.id} className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 space-y-4 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60">
                    {getIconComponent(cat.icon_slug)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{cat.name}</h3>
                    <p className="text-[11px] text-slate-400">Monthly Envelope</p>
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
                  <span className={`font-mono font-bold ${isOver ? 'text-rose-400' : 'text-slate-200'}`}>
                    ₱{catSpend.toFixed(2)} / ₱{limit.toFixed(2)}
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      isOver ? 'bg-rose-500' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-medium pt-1">
                  <span className={isOver ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {isOver ? `Over budget by ₱${Math.abs(remaining).toFixed(2)}` : `₱${remaining.toFixed(2)} remaining`}
                  </span>
                  <span className="text-slate-400">{percent}% used</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create Budget Category</h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Healthcare, Pets, Subscriptions"
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
                  placeholder="5000.00"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Icon Style</label>
                <select
                  value={iconSlug}
                  onChange={(e) => setIconSlug(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="shopping-cart">Shopping Cart (Groceries)</option>
                  <option value="zap">Utilities / Meralco / Electric</option>
                  <option value="utensils">Dining / Restaurants</option>
                  <option value="film">Movies & Entertainment</option>
                  <option value="book-open">Books & Education</option>
                </select>
              </div>

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
                  Create Category
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
            <h3 className="text-base font-bold text-white">Edit Limit: {editingCategory.name}</h3>

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
