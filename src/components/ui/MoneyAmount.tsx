import React from 'react';

export function formatMoney(amount: number) {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MoneyAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(amount)}</span>;
}
