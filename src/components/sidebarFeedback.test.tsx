import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HouseholdProvider } from '../context/HouseholdContext';
import { initialMembers } from '../lib/supabase';
import { Navbar } from './Navbar';
import { DashboardView } from './DashboardView';
import { ProfileAvatar } from './ui/ProfileAvatar';
import { allNavigationItems } from './layout/navigation';

const noop = () => undefined;

function renderNavigation(collapsed: boolean) {
  return renderToStaticMarkup(
    <HouseholdProvider>
      <Navbar activeTab="dashboard" setActiveTab={noop} onOpenAddTxModal={noop} sidebarCollapsed={collapsed} onToggleSidebar={noop} />
    </HouseholdProvider>,
  );
}

describe('approved sidebar feedback', () => {
  it('keeps balance and transaction actions out of the header, with branding in the sidebar', () => {
    const markup = renderNavigation(false);
    const header = markup.match(/<header[\s\S]*?<\/header>/)?.[0];
    const sidebar = markup.match(/<aside[\s\S]*?<\/aside>/)?.[0];
    expect(header).toBeDefined();
    expect(header).not.toContain('Liquid balances');
    expect(header).not.toContain('Log transaction');
    expect(sidebar).toContain('FamLedger');
    expect(sidebar).toContain('Collapse sidebar');
    expect(sidebar).toContain('aria-expanded="true"');
  });

  it('preserves named destinations in the icon-only rail and exposes expansion', () => {
    const sidebar = renderNavigation(true).match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
    for (const item of allNavigationItems) {
      expect(sidebar).toContain(`aria-label="${item.label.replaceAll('&', '&amp;')}"`);
      expect(sidebar).toContain(`title="${item.label.replaceAll('&', '&amp;')}"`);
    }
    expect(sidebar).toContain('Expand sidebar');
    expect(sidebar).toContain('aria-expanded="false"');
    expect(sidebar).not.toContain('For visible wallets.');
  });

  it('removes dashboard obligations while retaining summaries and logging', () => {
    const markup = renderToStaticMarkup(
      <HouseholdProvider>
        <DashboardView setActiveTab={noop} onOpenAddTxModal={noop} onPayCreditCard={noop} />
      </HouseholdProvider>,
    );
    expect(markup).not.toContain('Recurring Bills &amp; Transfers Schedule');
    expect(markup).not.toContain('Upcoming Credit Card Payments');
    expect(markup).toContain('Household Wallets &amp; Credit Lines Summary');
    expect(markup).toContain('Income in loaded ledger');
    expect(markup).toContain('Quick Log Transaction');
  });

  it('uses a member profile photo without exposing duplicate alternative text', () => {
    const markup = renderToStaticMarkup(<ProfileAvatar member={{ ...initialMembers[0], avatar_url: 'data:image/png;base64,AAAA' }} />);
    expect(markup).toContain('src="data:image/png;base64,AAAA"');
    expect(markup).toContain('alt=""');
  });
});
