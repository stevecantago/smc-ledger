import React from 'react';
import { clsx } from 'clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ tone = 'secondary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  const tones = {
    primary: 'bg-brand-orange text-white hover:bg-[#A94312] shadow-sm',
    secondary: 'bg-white text-brand-ink ring-1 ring-brand-line hover:bg-[#F5F6F7]',
    quiet: 'bg-transparent text-brand-ink hover:bg-brand-sky/60',
    danger: 'bg-rose-700 text-white hover:bg-rose-800',
  };
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'text-xs' : 'text-sm',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
