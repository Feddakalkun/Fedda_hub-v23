import type { ReactNode } from 'react';
import { labelBase, cn } from '../../lib/styles';

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
  action?: ReactNode;
}

export const Field = ({ label, children, className = '', hint, action }: FieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <div className="flex items-center justify-between gap-2">
      <span className={labelBase}>{label}</span>
      {action}
    </div>
    {children}
    {hint && <p className="text-[10px] text-fedda-text-4 leading-relaxed">{hint}</p>}
  </div>
);
