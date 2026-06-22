import type { ReactNode } from 'react';
import { cn } from '../../lib/styles';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-white/[0.06] text-fedda-text-2',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-red-500/10 text-red-400',
  accent: 'bg-fedda-accent/10 text-fedda-accent',
};

export const Badge = ({ children, variant = 'neutral', className = '' }: BadgeProps) => (
  <span className={cn(
    'inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5',
    'text-[10px] font-semibold uppercase tracking-wider',
    variantStyles[variant],
    className,
  )}>
    {children}
  </span>
);
