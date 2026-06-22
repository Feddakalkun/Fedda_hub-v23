import { inputBase, cn } from '../../lib/styles';

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  type?: string;
}

export const Input = ({ value, onChange, placeholder, disabled, className = '', type = 'text' }: InputProps) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className={cn(inputBase, className)}
  />
);

interface TextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export const Textarea = ({ value, onChange, placeholder, disabled, rows = 4, className = '' }: TextareaProps) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    rows={rows}
    className={cn(inputBase, 'resize-none leading-relaxed', className)}
  />
);

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Select = ({ value, onChange, disabled, className = '', children }: SelectProps) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className={cn(inputBase, 'cursor-pointer', className)}
  >
    {children}
  </select>
);
