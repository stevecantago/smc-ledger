import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HouseholdProvider } from '../context/HouseholdContext';
import { initialMembers, initialWallets } from '../lib/supabase';
import { Wallet } from '../types/database';
import { WalletsView } from './WalletsView';

const originalWallets = [...initialWallets];
const card: Wallet = {
  id: 'fee-test-card', household_id: 'fee-test-household', owner_id: initialMembers[0].id,
  name: 'Test Card', wallet_type: 'credit_card', is_shared: true,
  current_balance: 7000, credit_limit: 10000, service_fee_balance: 1000,
  created_at: '2026-10-03T00:00:00.000Z',
};

// Server rendering uses the real provider and component without running hydration
// effects, browser storage, or remote requests. Only the in-memory seed is replaced.
function renderCard(overrides: Partial<Wallet> = {}) {
  initialWallets.splice(0, initialWallets.length, { ...card, ...overrides });
  const html = renderToStaticMarkup(<HouseholdProvider><WalletsView /></HouseholdProvider>);
  return { html, text: html.replace(/<[^>]*>/g, '') };
}

describe('credit-account summary', () => {
  beforeEach(() => initialWallets.splice(0, initialWallets.length, ...originalWallets));
  afterEach(() => initialWallets.splice(0, initialWallets.length, ...originalWallets));

  it('shows fees and total due with two decimals and includes fees in utilization', () => {
    const { html, text } = renderCard();

    expect(text).toContain('Service Fees:₱1,000.00');
    expect(text).toContain('Total Due:₱8,000.00');
    expect(text).toContain('Credit Limit:₱10,000.00');
    expect(text).toContain('Used Balance:₱7,000.00');
    expect(text).toContain('Available Credit:₱2,000.00');
    expect(text).toContain('80% Used');
    expect(html).toContain('style="width:80%"');
  });

  it('shows zero fees for a legacy card with a missing fee balance', () => {
    const { text } = renderCard({ service_fee_balance: undefined });

    expect(text).toContain('Service Fees:₱0.00');
    expect(text).toContain('Total Due:₱7,000.00');
    expect(text).toContain('Available Credit:₱3,000.00');
    expect(text).toContain('70% Used');
  });

  it('caps the utilization display when total due exceeds the credit limit', () => {
    const { html, text } = renderCard({ service_fee_balance: 4000 });

    expect(text).toContain('Total Due:₱11,000.00');
    expect(text).toContain('Available Credit:₱0.00');
    expect(text).toContain('100% Used');
    expect(html).toContain('style="width:100%"');
  });
});
