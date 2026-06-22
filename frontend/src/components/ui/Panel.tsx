import type { ReactNode } from 'react';
import { panelBase, cn } from '../../lib/styles';

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export const Panel = ({ children, className = '', title }: PanelProps) => (
  <div className={cn(panelBase, className)}>
    {title && (
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-3">{title}</p>
    )}
    {children}
  </div>
);
