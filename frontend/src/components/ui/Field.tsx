import type { ReactNode } from 'react';
import { labelBase, cn } from '../../lib/styles';

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}

export const Field = ({ label, children, className = '', hint }: FieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <span className={labelBase}>{label}</span>
    {children}
    {hint && <p className="text-[10px] text-fedda-text-4 leading-relaxed">{hint}</p>}
  </div>
);
