import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/styles';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  title?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-fedda-accent text-white hover:bg-fedda-accent/85 focus-visible:ring-2 focus-visible:ring-fedda-accent/40',
  secondary: 'border border-white/10 bg-white/[0.04] text-fedda-text-2 hover:bg-white/[0.08] hover:text-fedda-text-1',
  ghost: 'text-fedda-text-3 hover:text-fedda-text-2 hover:bg-white/[0.05]',
  danger: 'border border-red-500/20 bg-red-500/[0.05] text-red-400 hover:bg-red-500/10',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export const Button = ({
  children,
  onClick,
  disabled,
  loading,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className = '',
  title,
}: ButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    title={title}
    className={cn(
      'inline-flex items-center justify-center rounded-xl font-medium transition outline-none',
      'disabled:cursor-not-allowed disabled:opacity-40',
      variantStyles[variant],
      sizeStyles[size],
      className,
    )}
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" /> : null}
    {children}
  </button>
);
