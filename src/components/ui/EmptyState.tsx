import React from 'react';

export function EmptyState({ title, children, action, illustration }: { title: string; children?: React.ReactNode; action?: React.ReactNode; illustration?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-line bg-white/70 px-6 py-10 text-center">
      {illustration ? <div aria-hidden="true" className="mb-4 flex justify-center">{illustration}</div> : null}
      <h3 className="text-base font-bold text-brand-ink">{title}</h3>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
