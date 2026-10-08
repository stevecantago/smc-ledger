import { ShieldCheck, Wallet, Home, Users, Landmark, Target, History, Clock, ArrowLeftRight, Settings } from 'lucide-react';

export const primaryNavigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'transactions', label: 'Ledger', icon: ArrowLeftRight },
  { id: 'wallets', label: 'Wallets', icon: Wallet },
  { id: 'goals', label: 'Goals', icon: Target },
] as const;

export const moreNavigationItems = [
  { id: 'budgets', label: 'Envelopes', icon: ShieldCheck },
  { id: 'loans', label: 'Loans', icon: Landmark },
  { id: 'schedules', label: 'Schedules', icon: Clock },
  { id: 'members', label: 'Roster', icon: Users },
  { id: 'activity', label: 'Activity Log', icon: History },
  { id: 'settings', label: 'Setting', icon: Settings },
] as const;

export const allNavigationItems = [...primaryNavigationItems, ...moreNavigationItems];
