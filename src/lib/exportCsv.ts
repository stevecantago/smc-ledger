import { Transaction, Category, Wallet, HouseholdMember } from '../types/database';

export function exportTransactionsToCsv(
  transactions: Transaction[], 
  wallets: Wallet[], 
  categories: Category[], 
  members: HouseholdMember[]
) {
  const headers = ['Transaction ID', 'Date', 'Type', 'Payer', 'Source Account', 'Destination Account', 'Category', 'Amount (PHP)', 'Note', 'Receipt URL'];
  
  const rows = transactions.map(t => {
    const payer = members.find(m => m.id === t.payer_id)?.display_name || t.payer_id;
    const source = wallets.find(w => w.id === t.wallet_id)?.name || t.wallet_id;
    const dest = t.destination_wallet_id ? (wallets.find(w => w.id === t.destination_wallet_id)?.name || t.destination_wallet_id) : '';
    const cat = categories.find(c => c.id === t.category_id)?.name || '';

    return [
      `"${t.id}"`,
      `"${t.transaction_date}"`,
      `"${t.type.toUpperCase()}"`,
      `"${payer}"`,
      `"${source}"`,
      `"${dest}"`,
      `"${cat}"`,
      t.amount.toFixed(2),
      `"${(t.note || '').replace(/"/g, '""')}"`,
      `"${t.receipt_url || ''}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadBlob(csvContent, `SMCLedger_Transactions_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

export function exportBudgetSummaryToCsv(
  categories: Category[],
  transactions: Transaction[]
) {
  const now = new Date();
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const headers = ['Category Name', 'Icon', 'Monthly Budget Limit (PHP)', 'Spent This Month (PHP)', 'Remaining Balance (PHP)', 'Utilization Status'];

  const rows = categories.map(c => {
    const spent = currentMonthTx
      .filter(t => t.type === 'expense' && t.category_id === c.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const remaining = c.monthly_budget_limit - spent;
    const percent = c.monthly_budget_limit > 0 ? (spent / c.monthly_budget_limit) * 100 : 0;
    const status = percent > 100 ? 'OVER BUDGET' : percent > 85 ? 'WARNING (>85%)' : 'ON TRACK';

    return [
      `"${c.name}"`,
      `"${c.icon_slug}"`,
      c.monthly_budget_limit.toFixed(2),
      spent.toFixed(2),
      remaining.toFixed(2),
      `"${status}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadBlob(csvContent, `SMCLedger_Budget_Summary_${now.getFullYear()}_${now.getMonth() + 1}.csv`, 'text/csv;charset=utf-8;');
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
