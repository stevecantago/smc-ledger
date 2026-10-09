import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HouseholdProvider } from '../context/HouseholdContext';
import { initialMembers } from '../lib/supabase';
import { Navbar } from './Navbar';
import { DashboardView } from './DashboardView';
import { ProfileModal } from './ProfileModal';
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
    expect(sidebar).not.toContain('For visible wallets.');
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

  it('removes dashboard detail cards while retaining financial overview and logging', () => {
    const markup = renderToStaticMarkup(
      <HouseholdProvider>
        <DashboardView setActiveTab={noop} onOpenAddTxModal={noop} onPayCreditCard={noop} />
      </HouseholdProvider>,
    );
    expect(markup).not.toContain('Recurring Bills &amp; Transfers Schedule');
    expect(markup).not.toContain('Upcoming Credit Card Payments');
    expect(markup).not.toContain('Household Wallets &amp; Credit Lines Summary');
    expect(markup).not.toContain('Total Purchasing Power');
    expect(markup).toContain('Liquid balances less used card balances');
    expect(markup).toContain('Filtered income');
    expect(markup).toContain('Analysis Period:');
    for (const title of ['Daily Trends', 'Expense Breakdown', 'Spending by Member', 'Average Transaction Size']) expect(markup).toContain(title);
    expect(markup).toContain('Quick Log Transaction');
  });

  it('connects profile field labels and title to the shared native dialog', () => {
    const markup = renderToStaticMarkup(<HouseholdProvider><ProfileModal isOpen={true} onClose={noop} /></HouseholdProvider>);
    expect(markup).toContain('<dialog');
    const titleId = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(markup).toContain(`id="${titleId}"`);
    const labels = Array.from(markup.matchAll(/<label for="([^"]+)"/g), match => match[1]);
    expect(labels).toHaveLength(7);
    for (const id of labels) expect(markup).toContain(`id="${id}"`);
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain('autoComplete="new-password"');
  });

  it('uses a member profile photo without exposing duplicate alternative text', () => {
    const markup = renderToStaticMarkup(<ProfileAvatar member={{ ...initialMembers[0], avatar_url: 'data:image/png;base64,AAAA' }} />);
    expect(markup).toContain('src="data:image/png;base64,AAAA"');
    expect(markup).toContain('alt=""');
  });
});
