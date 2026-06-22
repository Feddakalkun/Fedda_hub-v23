import type { FeddaModule } from '../../modules/registry';
import { HOME_MODULE_CANDIDATES } from '../../modules/registry';
import { useModules } from '../../contexts/ModuleContext';
import { cn } from '../../lib/styles';

interface HomeViewProps {
  onSelect: (tab: string) => void;
}

interface ModuleCardProps {
  module: FeddaModule;
  onClick: () => void;
  available: boolean;
}

const ModuleCard = ({ module, onClick, available }: ModuleCardProps) => {
  const Icon = module.Icon;

  return (
    <button
      onClick={available ? onClick : undefined}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border text-left transition',
        'bg-fedda-bg-1 border-white/[0.08]',
        available
          ? 'hover:border-white/15 hover:bg-fedda-bg-2 cursor-pointer'
          : 'opacity-40 cursor-not-allowed',
      )}
    >
      {/* Poster image */}
      {module.card?.poster && (
        <div className="relative h-36 overflow-hidden bg-fedda-bg-2">
          <img
            src={module.card.poster}
            alt=""
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-fedda-bg-1/80 to-transparent" />
        </div>
      )}

      {/* Card body */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Icon className="h-3.5 w-3.5 text-fedda-text-2" />
          </div>
          <span className="text-sm font-semibold text-fedda-text-1 truncate">{module.label}</span>
          {!available && (
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-fedda-text-4 border border-white/10 rounded px-1.5 py-0.5">
              Locked
            </span>
          )}
        </div>
        <p className="text-[11px] text-fedda-text-3 leading-snug line-clamp-2 pl-8">
          {module.description}
        </p>
      </div>
    </button>
  );
};

export const HomeView = ({ onSelect }: HomeViewProps) => {
  const { availableModules } = useModules();
  const availableIds = new Set(availableModules.map((m) => m.id));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-fedda-text-1 tracking-tight">FEDDA Hub</h2>
          <p className="text-sm text-fedda-text-3">Select a workflow to get started.</p>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {HOME_MODULE_CANDIDATES.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              available={availableIds.has(module.id)}
              onClick={() => {
                if (module.tabs[0] === 'image') onSelect('image');
                else if (module.tabs[0] === 'video') onSelect('video');
                else onSelect(module.defaultTab);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
