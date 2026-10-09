import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BarChart, DailyTrends, ExpenseBreakdown } from './AnalysisCharts';

const groups = [{ id: 'utilities', label: 'Very long household utilities category name', amount: 1234567.89, count: 2, average: 617283.95 }];

describe('dashboard chart alternatives', () => {
  it('exposes exact daily values and a keyboard-operable date chart', () => {
    const markup = renderToStaticMarkup(<DailyTrends points={[{ date: '2026-10-09', income: 100, expenses: 25.5 }]} />);
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('left and right arrow keys');
    expect(markup).toContain('Daily values');
    expect(markup).toContain('2026-10-09');
    expect(markup).toContain('₱25.50');
    expect(markup).toContain('<circle');
  });
  it('preserves full category names and large totals outside the donut', () => {
    const markup = renderToStaticMarkup(<ExpenseBreakdown groups={groups} total={1234567.89} />);
    expect(markup).toContain(groups[0].label);
    expect(markup).toContain('₱1,234,567.89');
    expect(markup).toContain('Average ₱617,283.95');
    expect(markup).toContain('<summary');
  });
  it('provides full labels and exact values for truncated bar-chart labels', () => {
    const markup = renderToStaticMarkup(<BarChart groups={groups} average />);
    expect(markup).toContain('Category averages');
    expect(markup).toContain(groups[0].label);
    expect(markup).toContain('₱617,283.95');
    expect(markup).toContain('tabindex="0"');
  });
  it('handles empty selected periods without displaying invented data', () => {
    expect(renderToStaticMarkup(<DailyTrends points={[]} />)).toContain('No income or expense transactions');
    expect(renderToStaticMarkup(<ExpenseBreakdown groups={[]} total={0} />)).toContain('No expense transactions');
    expect(renderToStaticMarkup(<BarChart groups={[]} />)).toContain('No expense transactions');
  });
});
