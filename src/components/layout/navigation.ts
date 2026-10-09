import { Wallet, Home, Landmark, Target, History, Clock, ArrowLeftRight, Settings } from 'lucide-react';

export const primaryNavigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'transactions', label: 'Ledger', icon: ArrowLeftRight },
  { id: 'wallets', label: 'Wallets', icon: Wallet },
  { id: 'goals', label: 'Goals', icon: Target },
] as const;

export const moreNavigationItems = [
  { id: 'loans', label: 'Loans & Amortizations', icon: Landmark },
  { id: 'schedules', label: 'Schedules', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'activity', label: 'System Logs', icon: History },
] as const;

export const desktopPrimaryNavigationItems = [
  primaryNavigationItems[0],
  primaryNavigationItems[1],
  primaryNavigationItems[2],
  moreNavigationItems[1],
  primaryNavigationItems[3],
  moreNavigationItems[0],
] as const;
export const desktopBottomNavigationItems = [moreNavigationItems[2], moreNavigationItems[3]];
export const allNavigationItems = [...primaryNavigationItems, ...moreNavigationItems];
