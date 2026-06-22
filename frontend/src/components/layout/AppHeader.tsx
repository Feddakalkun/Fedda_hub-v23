import { ArrowLeft, Home, Loader2, type LucideIcon } from 'lucide-react';
import { useComfyExecution } from '../../contexts/ComfyExecutionContext';
import { useComfyStatus } from '../../hooks/useComfyStatus';

interface AppHeaderProps {
  title: string;
  Icon?: LucideIcon;
  showBack: boolean;
  showHome: boolean;
  onBack: () => void;
  onHome: () => void;
}

export const AppHeader = ({ title, Icon, showBack, showHome, onBack, onHome }: AppHeaderProps) => {
  const { isConnected } = useComfyStatus();
  const { state, currentNodeName, overallProgress } = useComfyExecution();

  const isExecuting = state === 'executing';
  const isDone = state === 'done';

  return (
    <header className="flex flex-col flex-shrink-0 border-b border-white/[0.06]">
      <div className="h-12 flex items-center px-4 gap-3">
        {/* Left — nav controls */}
        <div className="flex items-center gap-1.5">
          {showBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05] transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {showHome && (
            <button
              onClick={onHome}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05] transition"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBack && <span className="text-fedda-text-4 text-sm">/</span>}
          {Icon && <Icon className="h-3.5 w-3.5 text-fedda-text-3 flex-shrink-0" />}
          <h1 className="text-sm font-semibold text-fedda-text-1 tracking-tight truncate">{title}</h1>
          {isExecuting && (
            <span className="ml-1 text-[10px] text-fedda-text-3 font-mono truncate hidden sm:block">
              — {currentNodeName}
            </span>
          )}
        </div>

        {/* Right — system status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isExecuting && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-fedda-accent/20 bg-fedda-accent/[0.06]">
              <Loader2 className="h-3 w-3 text-fedda-accent animate-spin" />
              <span className="text-[10px] font-semibold text-fedda-accent">{overallProgress}%</span>
            </div>
          )}
          {isDone && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06]">
              <span className="text-[10px] font-semibold text-emerald-400">Done</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400' : 'bg-fedda-text-4'}`} />
            <span className="text-[10px] text-fedda-text-4 hidden sm:block">ComfyUI</span>
          </div>
        </div>
      </div>

      {/* Execution progress bar */}
      {(isExecuting || isDone) && (
        <div className="h-[2px] bg-white/[0.04] relative overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-fedda-accent'}`}
            style={{ width: isDone ? '100%' : `${Math.max(3, overallProgress)}%` }}
          />
        </div>
      )}
    </header>
  );
};
