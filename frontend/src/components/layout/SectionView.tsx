import { ArrowLeft } from 'lucide-react';
import { IMAGE_MODULE_CANDIDATES, VIDEO_MODULE_CANDIDATES } from '../../modules/registry';
import type { FeddaModule } from '../../modules/registry';
import { useModules } from '../../contexts/ModuleContext';
import { cn } from '../../lib/styles';

interface SectionViewProps {
  type: 'image' | 'video';
  onSelect: (tab: string) => void;
  onBack: () => void;
}

interface WorkflowCardProps {
  module: FeddaModule;
  onClick: () => void;
  available: boolean;
}

const WorkflowCard = ({ module, onClick, available }: WorkflowCardProps) => {
  const Icon = module.Icon;

  return (
    <button
      onClick={available ? onClick : undefined}
      className={cn(
        'group relative flex overflow-hidden rounded-xl border text-left transition',
        'bg-fedda-bg-1 border-white/[0.08]',
        available
          ? 'hover:border-fedda-accent/30 hover:bg-fedda-bg-2 cursor-pointer'
          : 'opacity-35 cursor-not-allowed',
      )}
    >
      {/* Poster */}
      {module.card?.poster ? (
        <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden bg-fedda-bg-2">
          <img
            src={module.card.poster}
            alt=""
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="w-24 h-24 flex-shrink-0 bg-fedda-bg-2 flex items-center justify-center">
          <Icon className="h-5 w-5 text-fedda-text-4" />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col justify-center gap-1 px-4 py-3 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-fedda-text-3 flex-shrink-0" />
          <span className="text-sm font-semibold text-fedda-text-1 truncate">{module.label}</span>
          {!available && (
            <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-fedda-text-4 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">
              Locked
            </span>
          )}
        </div>
        <p className="text-[11px] text-fedda-text-3 leading-snug line-clamp-2">{module.description}</p>
      </div>
    </button>
  );
};

export const SectionView = ({ type, onSelect, onBack }: SectionViewProps) => {
  const { availableModules } = useModules();
  const availableIds = new Set(availableModules.map((m) => m.id));
  const candidates = type === 'image' ? IMAGE_MODULE_CANDIDATES : VIDEO_MODULE_CANDIDATES;
  const heading = type === 'image' ? 'Image Studio' : 'Video Studio';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-fedda-text-3 hover:text-fedda-text-1 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </button>
          <h2 className="text-lg font-bold text-fedda-text-1 tracking-tight">{heading}</h2>
        </div>

        {/* Workflow list */}
        <div className="grid grid-cols-1 gap-2">
          {candidates.map((module) => (
            <WorkflowCard
              key={module.id}
              module={module}
              available={availableIds.has(module.id)}
              onClick={() => onSelect(module.defaultTab)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
