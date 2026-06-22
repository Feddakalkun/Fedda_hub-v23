import { Bot, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useOllamaManager } from '../hooks/useOllamaManager';
import { useOllamaStatus } from '../hooks/useOllamaStatus';
import { cn } from '../lib/styles';

function formatBytes(value: number) {
  if (!value) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const inputCls = 'w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-sm text-fedda-text-1 outline-none focus:border-white/20';

export const OllamaModelsPage = () => {
  const status = useOllamaStatus();
  const manager = useOllamaManager();
  const selectedOption = manager.activeList.find((m) => m.id === manager.selectedModel);

  return (
    <div className="h-full overflow-y-auto bg-fedda-bg-0 px-6 py-6">
      <div className="mx-auto max-w-[1300px] space-y-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4">Ollama Models</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-fedda-text-1">Local text and vision models</h1>
            <p className="mt-1 text-xs text-fedda-text-3">Manage the Ollama models FEDDA uses for prompt assistance and visual captioning.</p>
          </div>
          <div className={cn(
            'rounded-xl border px-4 py-2.5 text-xs font-semibold self-start md:self-auto',
            status.isConnected
              ? 'border-white/10 bg-white/[0.04] text-fedda-text-2'
              : 'border-red-400/25 bg-red-500/10 text-red-200',
          )}>
            {status.isLoading ? 'Checking Ollama…' : status.isConnected ? 'Ollama online' : 'Ollama offline'}
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          {/* Download Panel */}
          <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Download className="h-4 w-4 text-fedda-accent" />
              <h2 className="text-sm font-semibold text-fedda-text-1">Download model</h2>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['text', 'vision'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => manager.setModelCategory(kind)}
                  className={cn(
                    'rounded-xl border py-2 text-xs font-semibold capitalize transition',
                    manager.modelCategory === kind
                      ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                      : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1',
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>

            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-1.5">Recommended model</label>
            <select
              value={manager.selectedModel}
              onChange={(e) => manager.setSelectedModel(e.target.value)}
              className={inputCls}
            >
              {manager.activeList.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {selectedOption && <p className="mt-2 text-xs text-fedda-text-4 leading-5">{selectedOption.description}</p>}

            <label className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-1.5">Custom model name</label>
            <input
              value={manager.customModel}
              onChange={(e) => manager.setCustomModel(e.target.value)}
              placeholder="Optional, e.g. llama3.2-vision:11b"
              className={inputCls}
            />

            <button
              onClick={manager.handlePull}
              disabled={manager.isPulling || !status.isConnected}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fedda-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-fedda-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {manager.isPulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {manager.isPulling ? 'Downloading…' : 'Pull model'}
            </button>

            {manager.pullProgress && (
              <div className="mt-4 rounded-xl border border-white/10 bg-fedda-bg-2 p-3 text-xs text-fedda-text-3">
                <div className="mb-1 text-fedda-text-2">{manager.pullProgress.status}</div>
                {manager.pullProgress.total ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-fedda-accent transition-all"
                      style={{ width: `${Math.min(100, ((manager.pullProgress.completed ?? 0) / manager.pullProgress.total) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )}
            {manager.pullError && <p className="mt-3 text-xs text-red-300">{manager.pullError}</p>}
          </div>

          {/* Installed Models Panel */}
          <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-fedda-accent" />
                <h2 className="text-sm font-semibold text-fedda-text-1">Installed models</h2>
              </div>
              <button
                onClick={manager.refreshModels}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-fedda-text-3 hover:text-fedda-text-1 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            {manager.isLoadingModels ? (
              <div className="flex h-48 items-center justify-center text-fedda-text-4 gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading models…
              </div>
            ) : manager.installedModels.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-white/[0.06] bg-fedda-bg-2 text-fedda-text-4 text-sm">
                No Ollama models installed.
              </div>
            ) : (
              <div className="space-y-2">
                {manager.installedModels.map((model) => (
                  <div key={model.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-fedda-text-1">{model.name}</div>
                      <div className="mt-0.5 text-xs text-fedda-text-4">
                        {formatBytes(model.size)} · {new Date(model.modified_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => manager.handleDelete(model.name)}
                      className="rounded-xl border border-red-400/25 bg-red-500/10 p-2 text-red-200 hover:bg-red-500/20 transition"
                      title="Delete model"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
