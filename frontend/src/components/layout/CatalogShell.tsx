import type { ElementType, ReactNode } from 'react';

interface CatalogShellProps {
    title: string;
    subtitle?: ReactNode;
    icon?: ElementType;
    actions?: ReactNode;
    children: ReactNode;
}

interface CatalogCardProps {
    title: string;
    subtitle?: ReactNode;
    icon?: ElementType;
    iconClassName?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    progress?: number;
    children?: ReactNode;
    className?: string;
}

export const CatalogShell = ({ title, subtitle, icon: Icon, actions, children }: CatalogShellProps) => (
    <div className="p-6 mx-auto space-y-8 max-w-[1920px]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="w-10 h-10 rounded-xl bg-fedda-bg-2 border border-white/[0.08] flex items-center justify-center">
                            <Icon className="w-5 h-5 text-fedda-text-3" />
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-fedda-text-1 tracking-tight">{title}</h1>
                </div>
                {subtitle && <p className="text-xs text-fedda-text-3 max-w-2xl">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div>{children}</div>
    </div>
);

export const CatalogCard = ({
    title,
    subtitle,
    icon: Icon,
    iconClassName = '',
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    progress,
    children,
    className = '',
}: CatalogCardProps) => (
    <div className={`group rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-6 flex flex-col justify-between transition-all hover:border-white/10 relative overflow-hidden ${className}`}>
        <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="w-10 h-10 rounded-xl bg-fedda-bg-2 border border-white/[0.08] flex items-center justify-center">
                        <Icon className={`w-5 h-5 text-fedda-text-3 ${iconClassName}`} />
                    </div>
                )}
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-fedda-text-1 truncate">{title}</div>
                    {subtitle && <div className="text-[11px] text-fedda-text-3 mt-0.5">{subtitle}</div>}
                </div>
            </div>
            {progress !== undefined && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-fedda-text-4">
                        <span>Progress</span>
                        <span className="text-fedda-accent">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-fedda-bg-3 rounded-full overflow-hidden">
                        <div className="h-full bg-fedda-accent transition-all duration-700" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}
            {children}
        </div>
        <div className="mt-6 flex gap-2 relative z-10">
            {onAction ? (
                <button onClick={onAction} className="flex-1 py-2.5 bg-fedda-accent hover:bg-fedda-accent/90 text-white rounded-xl text-[11px] font-semibold transition-all">
                    {actionLabel}
                </button>
            ) : actionLabel ? (
                <div className="flex-1 py-2.5 bg-fedda-bg-2 border border-white/[0.06] text-fedda-text-4 rounded-xl text-[11px] font-semibold flex items-center justify-center">
                    {actionLabel}
                </div>
            ) : null}
            {onSecondaryAction && (
                <button onClick={onSecondaryAction} className="px-4 py-2.5 bg-fedda-bg-2 hover:bg-fedda-bg-3 border border-white/[0.06] text-fedda-text-2 hover:text-fedda-text-1 rounded-xl text-[11px] font-semibold transition-all">
                    {secondaryActionLabel}
                </button>
            )}
        </div>
    </div>
);
