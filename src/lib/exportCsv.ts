import { Transaction, Category, Wallet, HouseholdMember } from '../types/database';

export function exportTransactionsToCsv(
  transactions: Transaction[], 
  wallets: Wallet[], 
  categories: Category[], 
  members: HouseholdMember[]
) {
  const csvContent = buildTransactionsCsv(transactions, wallets, categories, members);
  downloadBlob(csvContent, `FamLedger_Transactions_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

export function buildTransactionsCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[],
  members: HouseholdMember[],
): string {
  const headers = ['Transaction ID', 'Date', 'Type', 'Payer', 'Source Account', 'Destination Account', 'Category', 'Amount (PHP)', 'Service Fee Amount (PHP)', 'Note', 'Receipt URL'];
  
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
      (t.service_fee_amount || 0).toFixed(2),
      `"${(t.note || '').replace(/"/g, '""')}"`,
      `"${t.receipt_url || ''}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
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
