-- Normalize legacy credit-card balances written by the old expense flow.
-- For credit cards, current_balance now represents positive used statement balance.
update public.wallets
set current_balance = abs(current_balance)
where wallet_type = 'credit_card'
  and current_balance < 0;
