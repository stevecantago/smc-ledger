import { SavingsGoal, Wallet } from '../types/database';

export function getSavingsGoalProgress(goal: SavingsGoal, wallets: Wallet[]) {
  const linkedWallet = goal.wallet_id
    ? wallets.find(wallet => wallet.id === goal.wallet_id) || null
    : null;
  const currentAmount = linkedWallet ? linkedWallet.current_balance : goal.current_amount;
  const percent = goal.target_amount > 0
    ? Math.min(Math.round((currentAmount / goal.target_amount) * 100), 100)
    : 0;

  return {
    linkedWallet,
    currentAmount,
    percent,
    remainingAmount: Math.max(0, goal.target_amount - currentAmount),
  };
}
