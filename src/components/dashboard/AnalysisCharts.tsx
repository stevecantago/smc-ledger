'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { AnalysisGroup, DailyPoint } from '../../lib/dashboardAnalysis';
import { formatMoney } from '../ui/MoneyAmount';

const EXPENSE = '#EF4444';
const INCOME = '#059669';
const CATEGORY_COLORS = ['#3AB0C8', '#F87171', '#45C9BE', '#FACC69', '#F5B544', '#9ACDBA', '#8B8BD1'];
const shortDate = (date: string) => `${date.slice(5, 7)}/${date.slice(8, 10)}`;
const compactMoney = (value: number) => `₱${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;

export function ChartCard({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-brand-line bg-white p-4 sm:p-6">
    <h2 className="text-base font-bold text-brand-ink">{title}</h2>
    <p className="mt-1 text-xs leading-relaxed text-brand-muted">{note}</p>
    <div className="mt-5">{children}</div>
  </section>;
}

export function ChartEmpty({ text = 'No expense transactions in this period.' }: { text?: string }) {
  return <div className="flex min-h-52 items-center justify-center rounded-xl bg-brand-canvas p-6 text-center text-sm text-brand-muted">{text}</div>;
}

export function DailyTrends({ points }: { points: DailyPoint[] }) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const hasPoints = points.length > 0;
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const measure = () => setChartWidth(Math.max(600, Math.round(chart.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(chart);
    return () => observer.disconnect();
  }, [hasPoints]);
  if (!points.length) return <ChartEmpty text="No income or expense transactions in this period." />;
  const maximum = points.reduce((maximum, point) => Math.max(maximum, point.income, point.expenses), 1);
  const firstTime = Date.parse(points[0].date);
  const span = Math.max(86400000, Date.parse(points[points.length - 1].date) - firstTime);
  const x = (point: DailyPoint) => points.length === 1 ? chartWidth / 2 : 70 + (Date.parse(point.date) - firstTime) / span * (chartWidth - 110);
  const y = (value: number) => 250 - value / maximum * 200;
  const activeIndex = points.findIndex(point => point.date === activeDate);
  const active = activeIndex >= 0 ? points[activeIndex] : null;
  const labels = Array.from(new Set(Array.from({ length: Math.min(7, points.length) }, (_, index) => Math.round(index * (points.length - 1) / Math.max(1, Math.min(7, points.length) - 1)))));
  return <>
    <div className="mb-2 flex flex-wrap justify-center gap-5 text-sm font-semibold"><span className="text-red-700">— Expense</span><span className="text-emerald-700">— Income</span></div>
    <div className="overflow-x-auto rounded-lg">
      <svg ref={chartRef} viewBox={`0 0 ${chartWidth} 290`} className="h-72 w-full min-w-[600px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" tabIndex={0} role="group" aria-label="Daily income and expenses. Use left and right arrow keys to inspect dates."
        onFocus={() => setActiveDate(points[0].date)} onBlur={() => setActiveDate(null)}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          setActiveDate(points[Math.max(0, Math.min(points.length - 1, Math.max(0, activeIndex) + (event.key === 'ArrowRight' ? 1 : -1)))].date);
        }}
        onMouseLeave={() => setActiveDate(null)}
        onMouseMove={event => {
          const box = event.currentTarget.getBoundingClientRect();
          const cursor = (event.clientX - box.left) / box.width * chartWidth;
          const nearest = points.reduce((best, point) => Math.abs(x(point) - cursor) < Math.abs(x(best) - cursor) ? point : best, points[0]);
          setActiveDate(nearest.date);
        }}>
        <title>Daily income and expenses in Philippine pesos</title>
        {[0, 1, 2, 3, 4].map(step => <g key={step}><line x1="70" x2={chartWidth - 40} y1={y(maximum * step / 4)} y2={y(maximum * step / 4)} stroke="#E6E8EB" strokeDasharray="3 4" /><text x="58" y={y(maximum * step / 4) + 4} textAnchor="end" fontSize="12" fill="#5E6877">{compactMoney(maximum * step / 4)}</text></g>)}
        {labels.map(index => <text key={index} x={x(points[index])} y="276" textAnchor="middle" fontSize="12" fill="#5E6877">{shortDate(points[index].date)}</text>)}
        <polyline points={points.map(point => `${x(point)},${y(point.income)}`).join(' ')} fill="none" stroke={INCOME} strokeWidth="2.5" />
        <polyline points={points.map(point => `${x(point)},${y(point.expenses)}`).join(' ')} fill="none" stroke={EXPENSE} strokeWidth="2.5" />
        {points.length === 1 && <g><circle cx={x(points[0])} cy={y(points[0].income)} r="4" fill={INCOME} /><circle cx={x(points[0])} cy={y(points[0].expenses)} r="4" fill={EXPENSE} /></g>}
        {active && <g><line x1={x(active)} x2={x(active)} y1="40" y2="250" stroke="#94A3B8" /><circle cx={x(active)} cy={y(active.income)} r="5" fill={INCOME} stroke="white" strokeWidth="2" /><circle cx={x(active)} cy={y(active.expenses)} r="5" fill={EXPENSE} stroke="white" strokeWidth="2" /></g>}
      </svg>
    </div>
    <p className="mt-2 min-h-6 text-center text-xs tabular-nums text-brand-muted" aria-live="polite">{active ? `${active.date} · Expense ${formatMoney(active.expenses)} · Income ${formatMoney(active.income)}` : 'Hover over the chart or focus it and use the arrow keys to inspect a day.'}</p>
    <details className="mt-3 text-sm"><summary className="cursor-pointer rounded py-2 font-semibold text-brand-ink focus-visible:ring-2 focus-visible:ring-brand-orange">Daily values</summary><div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm tabular-nums"><caption className="sr-only">Daily income and expense totals</caption><thead><tr><th className="p-2">Date</th><th className="p-2">Income</th><th className="p-2">Expenses</th></tr></thead><tbody>{points.map(point => <tr key={point.date} className="border-t border-brand-line"><td className="p-2">{point.date}</td><td className="p-2">{formatMoney(point.income)}</td><td className="p-2">{formatMoney(point.expenses)}</td></tr>)}</tbody></table></div></details>
  </>;
}

export function ExpenseBreakdown({ groups, total }: { groups: AnalysisGroup[]; total: number }) {
  if (!groups.length || total <= 0) return <ChartEmpty />;
  let offset = 0;
  return <>
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Expense breakdown. Total ${formatMoney(total)}. Category values are listed below.`} className="h-full w-full -rotate-90">
        <title>Expense share by category</title>
        {groups.map((group, index) => {
          const fraction = group.amount / total * 100;
          const start = offset; offset += fraction;
          return <circle key={group.id} cx="100" cy="100" r="76" fill="none" stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} strokeWidth="34" pathLength="100" strokeDasharray={`${fraction} ${100 - fraction}`} strokeDashoffset={-start}><title>{group.label}: {formatMoney(group.amount)}</title></circle>;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"><span className="text-xs text-brand-muted">TOTAL</span><span className="mt-1 max-w-full break-words text-sm font-bold tabular-nums text-brand-ink">{formatMoney(total)}</span></div>
    </div>
    <div className="mt-4 max-h-64 overflow-y-auto pr-1">{groups.map((group, index) => <details key={group.id} className="border-b border-brand-line text-sm last:border-0">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 rounded px-2 py-2 focus-visible:ring-2 focus-visible:ring-brand-orange"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /><span aria-hidden="true" className="text-brand-muted">⌄</span><span className="min-w-[5rem] flex-1 break-words font-medium">{group.label}</span><span className="max-w-full break-words text-right text-xs tabular-nums"><strong>{formatMoney(group.amount)}</strong><span className="ml-2 text-brand-muted">{(group.amount / total * 100).toFixed(1)}%</span></span></summary>
      <p className="px-5 pb-3 text-xs text-brand-muted">{group.count} expense {group.count === 1 ? 'transaction' : 'transactions'} · Average {formatMoney(group.average)}, including transaction fees.</p>
    </details>)}</div>
  </>;
}

export function BarChart({ groups, average = false }: { groups: AnalysisGroup[]; average?: boolean }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (!groups.length) return <ChartEmpty />;
  const sorted = average ? [...groups].sort((a, b) => b.average - a.average) : groups;
  const maximum = sorted.reduce((maximum, group) => Math.max(maximum, average ? group.average : group.amount), 1);
  const width = Math.max(560, sorted.length * 100 + 100);
  const plot = width - 100;
  const step = plot / sorted.length;
  const color = average ? '#F77C35' : EXPENSE;
  const active = sorted.find(group => group.id === activeId);
  return <>
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} 300`} role="group" aria-label={average ? 'Average expense transaction size by category. Exact values follow.' : 'Expense totals by member. Exact values follow.'} className="h-[300px] w-full" style={{ minWidth: `${width}px` }}>
      <title>{average ? 'Average expense transaction size' : 'Spending by member'}</title>
      {[0, 1, 2, 3, 4].map(index => <g key={index}><line x1="70" x2={width - 30} y1={240 - index * 50} y2={240 - index * 50} stroke="#E6E8EB" strokeDasharray="3 4" /><text x="60" y={244 - index * 50} textAnchor="end" fontSize="12" fill="#5E6877">{compactMoney(maximum * index / 4)}</text></g>)}
      {sorted.map((group, index) => {
        const value = average ? group.average : group.amount;
        const height = value / maximum * 200;
        const center = 70 + step * (index + .5);
        return <g key={group.id} tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ink" role="group" aria-label={`${group.label}: ${formatMoney(value)}`} onFocus={() => setActiveId(group.id)} onBlur={() => setActiveId(null)} onMouseEnter={() => setActiveId(group.id)} onMouseLeave={() => setActiveId(null)}>
          <title>{group.label}: {formatMoney(value)}</title><rect x={center - Math.min(64, step * .7) / 2} y={240 - height} width={Math.min(64, step * .7)} height={Math.max(1, height)} rx="3" fill={color} />
          <text x={center} y="268" textAnchor="middle" fontSize="12" fill="#16263D">{group.label.length > 16 ? `${group.label.slice(0, 14)}…` : group.label}</text>
        </g>;
      })}
    </svg></div>
    <p className="mt-1 min-h-6 text-center text-xs tabular-nums text-brand-muted" aria-live="polite">{active ? `${active.label} · ${formatMoney(average ? active.average : active.amount)}` : average ? 'Average amount per expense transaction, including its fee.' : 'Amount spent, including transaction fees.'}</p>
    <details className="mt-3 text-sm"><summary className="cursor-pointer rounded py-2 font-semibold text-brand-ink focus-visible:ring-2 focus-visible:ring-brand-orange">{average ? 'Category averages' : 'Member totals'}</summary><ul className="max-h-64 overflow-auto">{sorted.map(group => <li key={group.id} className="flex flex-wrap justify-between gap-2 border-t border-brand-line py-2"><span className="min-w-0 break-words">{group.label}</span><span className="tabular-nums">{formatMoney(average ? group.average : group.amount)}</span></li>)}</ul></details>
  </>;
}
