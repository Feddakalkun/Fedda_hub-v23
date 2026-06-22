import { ArrowLeft, Home, Loader2, Cpu, type LucideIcon } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useComfyExecution } from '../../contexts/ComfyExecutionContext';
import { useComfyStatus } from '../../hooks/useComfyStatus';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { useOllamaStatus } from '../../hooks/useOllamaStatus';
import { useGpuStats } from '../../hooks/useGpuStats';
import { SettingsPopover } from './SettingsPopover';

interface AppHeaderProps {
  title: string;
  Icon?: LucideIcon;
  showBack: boolean;
  showHome: boolean;
  onBack: () => void;
  onHome: () => void;
}

const StatusDot = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="flex items-center gap-1.5" title={`${label}: ${ok ? 'connected' : 'offline'}`}>
    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-fedda-text-4'}`} />
    <span className="text-[10px] text-fedda-text-4 hidden sm:block">{label}</span>
  </div>
);

const GpuPill = () => {
  const gpu = useGpuStats(5000);
  if (!gpu) return null;

  const usedGb  = (gpu.memUsed  / 1024).toFixed(1);
  const totalGb = (gpu.memTotal / 1024).toFixed(0);
  const vramPct = gpu.memPct;

  const barColor =
    vramPct > 90 ? 'bg-red-400' :
    vramPct > 70 ? 'bg-amber-400' :
    'bg-fedda-accent/60';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
      <span className="text-[10px] font-medium text-fedda-text-3 hidden md:block">{gpu.shortName}</span>

      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${vramPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-fedda-text-3 tabular-nums whitespace-nowrap">
          {usedGb}/{totalGb} GB
        </span>
      </div>

      <span className="text-fedda-text-4 text-[10px]">·</span>

      <span
        className={`text-[10px] font-mono tabular-nums ${gpu.utilization > 80 ? 'text-amber-400' : 'text-fedda-text-3'}`}
        title="GPU utilization"
      >
        {gpu.utilization}%
      </span>

      <span
        className={`text-[10px] font-mono tabular-nums hidden lg:block ${gpu.temperature > 80 ? 'text-red-400' : 'text-fedda-text-4'}`}
        title="GPU temperature"
      >
        {gpu.temperature}°
      </span>
    </div>
  );
};

const ClearVramButton = () => {
  const [clearing, setClearing] = useState(false);
  const [done, setDone]         = useState(false);

  const handleClick = useCallback(async () => {
    setClearing(true);
    setDone(false);
    try {
      await fetch('/api/hardware/free-vram', { method: 'POST' });
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setClearing(false);
    }
  }, []);

  return (
    <button
      onClick={handleClick}
      disabled={clearing}
      title="Unload models from GPU memory (ComfyUI + Ollama)"
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition disabled:opacity-40 ${
        done
          ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400'
          : 'border-white/[0.07] bg-white/[0.03] text-fedda-text-3 hover:text-amber-300 hover:border-amber-400/30'
      }`}
    >
      {clearing
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Cpu className="h-3 w-3" />
      }
      <span className="hidden sm:block">{clearing ? 'Clearing…' : done ? 'Cleared' : 'Clear VRAM'}</span>
    </button>
  );
};

export const AppHeader = ({ title, Icon, showBack, showHome, onBack, onHome }: AppHeaderProps) => {
  const { isConnected: comfyOk }    = useComfyStatus();
  const { isConnected: backendOk }  = useBackendStatus();
  const { isConnected: ollamaOk }   = useOllamaStatus();
  const { state, currentNodeName, overallProgress } = useComfyExecution();

  const isExecuting = state === 'executing';
  const isDone      = state === 'done';

  return (
    <header className="flex flex-col flex-shrink-0 border-b border-white/[0.06]">
      <div className="h-12 flex items-center px-4 gap-3">

        {/* Left — nav */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
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

        {/* Right */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Execution state */}
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

          {/* GPU */}
          <GpuPill />

          {/* Clear VRAM */}
          <ClearVramButton />

          {/* Service status dots */}
          <div className="flex items-center gap-3 border-l border-white/[0.06] pl-3">
            <StatusDot ok={backendOk} label="Backend" />
            <StatusDot ok={ollamaOk}  label="Ollama" />
            <StatusDot ok={comfyOk}   label="ComfyUI" />
          </div>

          {/* Token settings */}
          <SettingsPopover />
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
