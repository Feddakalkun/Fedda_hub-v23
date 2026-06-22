import { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Copy, Check, RefreshCw, Loader2, Cpu } from 'lucide-react';
import { cn } from '../lib/styles';
import { useOllamaStatus } from '../hooks/useOllamaStatus';

type ModelFamily = 'z-image' | 'flux' | 'chroma' | 'qwen' | 'wan';
type Mode = 'inspire' | 'enhance';

const MODEL_FAMILIES: { key: ModelFamily; label: string }[] = [
  { key: 'z-image', label: 'Z-Image' },
  { key: 'flux',    label: 'FLUX' },
  { key: 'chroma',  label: 'Chroma' },
  { key: 'qwen',    label: 'Qwen' },
  { key: 'wan',     label: 'WAN Video' },
];

const EXAMPLE_IDEAS = [
  'a cute Norwegian girl posing in the streets of Oslo on a rainy afternoon',
  'a dramatic sci-fi cityscape at dusk with flying cars and neon reflections',
  'cozy wooden cabin interior, warm light, snow outside the window',
  'powerful warrior woman in ancient armor standing on a cliff edge at sunrise',
];

export const PromptStudioPage = () => {
  const [idea, setIdea]               = useState('');
  const [mode, setMode]               = useState<Mode>('inspire');
  const [family, setFamily]           = useState<ModelFamily>('z-image');
  const [result, setResult]           = useState('');
  const [seed, setSeed]               = useState<number | null>(null);
  const [usedModel, setUsedModel]     = useState<string | null>(null);
  const [streaming, setStreaming]     = useState(false);
  const [copied, setCopied]           = useState(false);
  const [clearingVram, setClearingVram] = useState(false);
  const abortRef                      = useRef<AbortController | null>(null);
  const outputRef                     = useRef<HTMLDivElement | null>(null);
  const ollama                        = useOllamaStatus();

  const enhance = useCallback(async () => {
    const text = idea.trim();
    if (!text || streaming) return;

    setResult('');
    setSeed(null);
    setUsedModel(null);
    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch('/api/ollama/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          context: family === 'wan' ? 'wan' : 'zimage',
          current_prompt: text,
          target_model_family: family,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        setResult(`Error: ${err.detail ?? res.statusText}`);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStreaming(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') { setStreaming(false); return; }
          try {
            const { token, error, done, seed: s, model: m } = JSON.parse(payload);
            if (error) { setResult(`Error: ${error}`); setStreaming(false); return; }
            if (done) { if (s != null) setSeed(s); if (m) setUsedModel(m); setStreaming(false); return; }
            if (token) { accumulated += token; setResult(accumulated); }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setResult(`Error: ${(err as Error).message}`);
      }
    } finally {
      setStreaming(false);
    }
  }, [idea, mode, family, streaming]);

  // Auto-scroll output box to bottom while streaming
  useEffect(() => {
    if (streaming && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result, streaming]);

  const clearVram = useCallback(async () => {
    setClearingVram(true);
    try {
      await fetch('/api/hardware/free-vram', { method: 'POST' });
    } finally {
      setClearingVram(false);
    }
  }, []);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fillExample = () => {
    const random = EXAMPLE_IDEAS[Math.floor(Math.random() * EXAMPLE_IDEAS.length)];
    setIdea(random);
  };

  return (
    <div className="h-full overflow-y-auto bg-fedda-bg-0">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">

        {/* Page header */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-1">
            Prompt Studio
          </p>
          <h1 className="text-xl font-semibold text-fedda-text-1 tracking-tight">
            Natural language → image prompt
          </h1>
          <p className="mt-1 text-sm text-fedda-text-3">
            Describe what you have in mind in plain language. The local AI rewrites it into a detailed, model-optimized generation prompt.
          </p>
        </div>

        {/* Ollama offline warning */}
        {!ollama.isLoading && !ollama.isConnected && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
            Ollama is offline. Start Ollama and make sure a text model is installed before using Prompt Studio.
          </div>
        )}

        {/* Controls card */}
        <div className="rounded-xl border border-white/[0.07] bg-fedda-bg-1 p-5 space-y-5">

          {/* Mode toggle */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-2">
              Mode
            </label>
            <div className="flex gap-2">
              {(['inspire', 'enhance'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-xs font-semibold capitalize transition',
                    mode === m
                      ? 'border-fedda-accent/40 bg-fedda-accent/10 text-fedda-accent'
                      : 'border-white/[0.08] bg-fedda-bg-2 text-fedda-text-3 hover:text-fedda-text-1',
                  )}
                >
                  {m === 'inspire' ? '✨ Inspire — generate from scratch' : '✍ Enhance — polish a draft'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-fedda-text-4">
              {mode === 'inspire'
                ? 'Write a plain description — the AI builds a full prompt from it.'
                : 'Paste an existing prompt and the AI will refine and extend it.'}
            </p>
          </div>

          {/* Target model family */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-2">
              Optimize for
            </label>
            <div className="flex flex-wrap gap-2">
              {MODEL_FAMILIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFamily(key)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                    family === key
                      ? 'border-fedda-accent/40 bg-fedda-accent/10 text-fedda-accent'
                      : 'border-white/[0.08] bg-fedda-bg-2 text-fedda-text-3 hover:text-fedda-text-1',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Idea input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4">
                {mode === 'inspire' ? 'Your idea' : 'Your draft prompt'}
              </label>
              <button
                onClick={fillExample}
                className="text-[10px] text-fedda-text-4 hover:text-fedda-text-2 transition"
              >
                Try an example
              </button>
            </div>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={
                mode === 'inspire'
                  ? 'e.g. a cute Norwegian girl posing in the streets of Oslo…'
                  : 'Paste your existing prompt here to polish it…'
              }
              rows={4}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-fedda-bg-2 px-4 py-3 text-sm text-fedda-text-1 placeholder:text-fedda-text-4 outline-none focus:border-fedda-accent/40 transition"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={enhance}
            disabled={!idea.trim() || streaming || (!ollama.isLoading && !ollama.isConnected)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fedda-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-fedda-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {streaming
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              : <><Sparkles className="h-4 w-4" /> {mode === 'inspire' ? 'Generate Prompt' : 'Enhance Prompt'}</>
            }
          </button>
        </div>

        {/* Output card */}
        {(result || streaming) && (
          <div className="rounded-xl border border-white/[0.07] bg-fedda-bg-1 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4">
                Generated prompt
              </span>
              <div className="flex items-center gap-2">
                {streaming && (
                  <span className="flex items-center gap-1 text-[10px] text-fedda-text-4">
                    <Loader2 className="h-3 w-3 animate-spin" /> Streaming
                  </span>
                )}
                {result && !streaming && (
                  <button
                    onClick={() => { setResult(''); setIdea(''); setSeed(null); setUsedModel(null); }}
                    title="Clear output"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-fedda-text-3 hover:text-fedda-text-1 transition"
                  >
                    <RefreshCw className="h-3 w-3" /> Reset
                  </button>
                )}
                <button
                  onClick={clearVram}
                  disabled={clearingVram}
                  title="Unload models from GPU memory (ComfyUI + Ollama)"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-fedda-text-3 hover:text-amber-300 transition disabled:opacity-40"
                >
                  {clearingVram
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Clearing…</>
                    : <><Cpu className="h-3 w-3" /> Clear VRAM</>
                  }
                </button>
                <button
                  onClick={copyResult}
                  disabled={!result}
                  title="Copy to clipboard"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                    copied
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/[0.08] bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1',
                  )}
                >
                  {copied
                    ? <><Check className="h-3 w-3" /> Copied</>
                    : <><Copy className="h-3 w-3" /> Copy</>
                  }
                </button>
              </div>
            </div>

            <div
              ref={outputRef}
              className="h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-4 py-3 text-sm text-fedda-text-1 leading-relaxed whitespace-pre-wrap"
            >
              {result}
              {streaming && <span className="inline-block w-1 h-[1em] bg-fedda-accent/70 ml-0.5 animate-pulse rounded-sm" />}
            </div>

            {/* Seed + model metadata */}
            {!streaming && (seed != null || usedModel) && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {seed != null && (
                  <span className="flex items-center gap-1.5 text-[11px] text-fedda-text-4 font-mono">
                    <span className="text-fedda-text-4 font-sans font-semibold uppercase tracking-widest text-[9px]">Seed</span>
                    {seed}
                  </span>
                )}
                {usedModel && (
                  <span className="flex items-center gap-1.5 text-[11px] text-fedda-text-4 font-mono">
                    <span className="text-fedda-text-4 font-sans font-semibold uppercase tracking-widest text-[9px]">Model</span>
                    {usedModel}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
