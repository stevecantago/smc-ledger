'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Target, Plus, Calendar, DollarSign, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { SavingsGoal } from '../types/database';

export const SavingsGoalsView: React.FC = () => {
  const { 
    savingsGoals, wallets, currentMember, isAdmin, 
    addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, fundSavingsGoal 
  } = useHousehold();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [fundingGoal, setFundingGoal] = useState<SavingsGoal | null>(null);

  // Add Form
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Edit Form
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDate, setEditDate] = useState('');

  // Fund Form
  const [fundAmount, setFundAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState('');

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addSavingsGoal({
      name: name.trim(),
      target_amount: parseFloat(targetAmount) || 0,
      target_date: targetDate || undefined,
    });

    setName('');
    setTargetAmount('');
    setTargetDate('');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;

    updateSavingsGoal(editingGoal.id, {
      name: editName.trim(),
      target_amount: parseFloat(editTarget) || 0,
      target_date: editDate || null,
    });

    setEditingGoal(null);
  };

  const handleDeleteGoal = (goal: SavingsGoal) => {
    if (!window.confirm(`Are you sure you want to delete savings goal "${goal.name}"?`)) return;
    const res = deleteSavingsGoal(goal.id);
    if (!res.success) alert(res.error);
  };

  const handleFundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!fundingGoal) return;

    const amt = parseFloat(fundAmount);
    if (!amt || amt <= 0) {
      setErrorMsg('Please enter a valid contribution amount.');
      return;
    }

    const res = fundSavingsGoal(fundingGoal.id, amt, selectedWalletId);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to fund savings goal.');
      return;
    }

    setFundAmount('');
    setFundingGoal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <span>Shared Savings Goals & Sinking Funds</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track multi-member contributions towards school tuition sinking funds, vacations, and emergency reserves.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Savings Goal</span>
          </button>
        )}
      </div>

      {/* Goal Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {savingsGoals.map(goal => {
          const percent = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
          const remaining = goal.target_amount - goal.current_amount;

          return (
            <div key={goal.id} className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{goal.name}</h3>
                      {goal.target_date && (
                        <p className="text-[11px] text-slate-400 flex items-center mt-0.5">
                          <Calendar className="w-3 h-3 mr-1 text-slate-500" /> Target: {goal.target_date}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 px-2 py-1 rounded border border-indigo-500/30">
                      {percent}%
                    </span>

                    {isAdmin && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingGoal(goal);
                            setEditName(goal.name);
                            setEditTarget(goal.target_amount.toString());
                            setEditDate(goal.target_date || '');
                          }}
                          title="Edit Savings Goal"
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal)}
                          title="Delete Savings Goal"
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-emerald-400 font-bold">₱{goal.current_amount.toLocaleString()}</span>
                    <span className="text-slate-400">Target: ₱{goal.target_amount.toLocaleString()}</span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden p-0.5">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 text-right">
                    {remaining > 0 ? `₱${remaining.toLocaleString()} left to reach goal` : 'Goal Completed! 🎉'}
                  </p>
                </div>
              </div>

              {/* Fund Action Button */}
              <button
                onClick={() => {
                  setErrorMsg('');
                  setFundingGoal(goal);
                  if (visibleWallets.length > 0) setSelectedWalletId(visibleWallets[0].id);
                }}
                className="w-full mt-2 bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold text-xs py-2 rounded-lg transition-all shadow flex items-center justify-center space-x-1"
              >
                <DollarSign className="w-4 h-4" />
                <span>Contribute / Fund Goal</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Savings Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create Shared Savings Goal</h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kid 1 Semester Tuition Fund, Summer Trip"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Amount (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="50000.00"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Date (Optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
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
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Savings Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Savings Goal: {editingGoal.name}</h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Amount (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Date (Optional)</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Save Goal Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute / Fund Goal Modal */}
      {fundingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Contribute to: {fundingGoal.name}</h3>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleFundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contribution Amount (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="5000.00"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Account</label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {visibleWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} (₱{w.current_balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setFundingGoal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow"
                >
                  Confirm Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
