import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import { WorkflowShell, WorkflowSection } from '../../components/layout/WorkflowShell';
import { VideoOutputPane } from '../../components/shared/VideoOutputPane';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Textarea } from '../../components/ui/Input';
import { useWorkflowRun } from '../../hooks/useWorkflowRun';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useToast } from '../../components/ui/Toast';
import { BACKEND_API } from '../../config/api';
import { LTX_RATIOS, getLtxDimensions } from '../../config/ltx';
import { cn } from '../../lib/styles';
import { comfyService } from '../../services/comfyService';

type LtxRatio = (typeof LTX_RATIOS)[number];
type Direction = 'forward' | 'backward';

// ─── Image upload slot ────────────────────────────────────────────────────────

function ImageSlot({ label, preview, uploading, onFile, onClear }: {
  label: string; preview: string | null; uploading: boolean;
  onFile: (f: File) => void; onClear?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition cursor-pointer',
        preview ? 'border-white/10 p-2' : 'border-white/10 p-6 hover:border-white/25',
      )}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith('image/')) onFile(f);
      }}
    >
      {preview ? (
        <div className="relative w-full">
          <img src={preview} alt={label} className="w-full max-h-40 rounded-lg object-contain" />
          {onClear && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 flex items-center justify-center text-white hover:bg-black transition"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <>
          <Upload className="h-5 w-5 text-fedda-text-4" />
          <span className="text-xs text-fedda-text-4">{uploading ? 'Uploading…' : label}</span>
        </>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ─── Upload hook ──────────────────────────────────────────────────────────────

function useLtxUpload(persistKey: string) {
  const { toast } = useToast();
  const [filename, setFilename] = usePersistentState<string | null>(persistKey, null);
  const [preview, setPreview] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const preview_ = filename ? `/comfy/view?filename=${encodeURIComponent(filename)}&type=input` : null;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BACKEND_API.BASE_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail || 'Upload failed');
      setFilename(data.filename);
      setPreview(URL.createObjectURL(file));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const clear = () => { setFilename(null); setPreview(null); };
  return { filename, preview: preview || preview_, uploading, upload, clear };
}

// ─── Inline prompt enhance ────────────────────────────────────────────────────

function usePromptEnhance() {
  const [enhancing, setEnhancing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const enhance = useCallback(async (
    currentPrompt: string,
    onUpdate: (text: string) => void,
    workflowId?: string,
  ) => {
    if (enhancing) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setEnhancing(true);

    try {
      const res = await fetch('/api/ollama/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: currentPrompt.trim().length > 15 ? 'enhance' : 'inspire',
          context: 'wan',
          current_prompt: currentPrompt,
          target_model_family: 'wan',
          workflow_id: workflowId,
        }),
        signal: ac.signal,
      });
      if (!res.ok) return;
      const reader = res.body?.getReader();
      if (!reader) return;

      const dec = new TextDecoder();
      let buf = '', acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const { token, done: d } = JSON.parse(line.slice(5).trim());
            if (d) return;
            if (token) { acc += token; onUpdate(acc); }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
    } finally {
      setEnhancing(false);
    }
  }, [enhancing]);

  return { enhance, enhancing };
}

const EnhanceButton = ({ prompt, onUpdate, workflowId }: {
  prompt: string; onUpdate: (t: string) => void; workflowId?: string;
}) => {
  const { enhance, enhancing } = usePromptEnhance();
  return (
    <button
      type="button"
      onClick={() => enhance(prompt, onUpdate, workflowId)}
      disabled={enhancing}
      title="Enhance prompt with local AI"
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-fedda-text-4 hover:text-fedda-accent transition disabled:opacity-40"
    >
      {enhancing
        ? <><Loader2 className="h-3 w-3 animate-spin" /> Enhancing…</>
        : <><Sparkles className="h-3 w-3" /> Enhance</>
      }
    </button>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20';

function AspectGrid({ value, onChange }: { value: LtxRatio; onChange: (r: LtxRatio) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {LTX_RATIOS.map((r) => (
        <button key={r} type="button" onClick={() => onChange(r as LtxRatio)}
          className={cn('rounded-xl border py-2 text-[10px] font-semibold transition',
            value === r
              ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
              : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
          )}>
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── LTX Img2Vid ──────────────────────────────────────────────────────────────

export const LtxImg2VidPage = () => {
  const [prompt, setPrompt]             = usePersistentState('ltx_img2vid_prompt', '');
  const [negative, setNegative]         = usePersistentState('ltx_img2vid_negative', 'blurry, low quality, deformed, jitter, artifacts');
  const [seed, setSeed]                 = usePersistentState('ltx_img2vid_seed', -1);
  const [loraName, setLoraName]         = usePersistentState('ltx_img2vid_lora_name', '');
  const [loraStrength, setLoraStrength] = usePersistentState('ltx_img2vid_lora_strength', 0.65);
  const [aspect, setAspect]             = usePersistentState<LtxRatio>('ltx_img2vid_ar', '16:9');
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [showNeg, setShowNeg]           = useState(false);

  const img = useLtxUpload('ltx_img2vid_image_file');
  const run = useWorkflowRun({
    workflowId: 'ltx-img2vid',
    currentKey: 'ltx_img2vid_current',
    historyKey: 'ltx_img2vid_history',
    outputKind: 'video',
    readyMessage: 'LTX video ready',
  });

  useEffect(() => {
    comfyService.getLoras().then((loras) => {
      setAvailableLoras(loras.filter((l) => l.replace(/\\/g, '/').toLowerCase().startsWith('ltx/')));
    }).catch(() => {});
  }, []);

  const handleGenerate = () => {
    if (!img.filename || !prompt.trim() || run.isGenerating) return;
    const dims = getLtxDimensions(aspect);
    run.start({
      image: img.filename,
      prompt: prompt.trim(),
      negative: negative.trim(),
      width: dims.width,
      height: dims.height,
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
      ...(loraName ? { lora_name: loraName, lora_strength: loraStrength } : {}),
    });
  };

  const canGenerate = !!img.filename && !!prompt.trim() && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="ltx-img2vid"
      output={
        <VideoOutputPane
          currentVideo={run.currentMedia}
          history={run.history}
          isGenerating={run.isGenerating}
          onSelectVideo={(url) => run.setCurrentMedia(url)}
          downloadName="fedda-ltx.mp4"
        />
      }
    >
      <WorkflowSection>
        <Field label="Reference Image">
          <ImageSlot label="Click or drop image" preview={img.preview} uploading={img.uploading} onFile={img.upload} onClear={img.clear} />
        </Field>
        <Field
          label="Motion Prompt"
          action={<EnhanceButton prompt={prompt} onUpdate={setPrompt} workflowId="ltx-img2vid" />}
        >
          <Textarea value={prompt} onChange={setPrompt} rows={4} placeholder="Describe the motion and scene…" />
        </Field>
      </WorkflowSection>

      <WorkflowSection title="Aspect Ratio">
        <AspectGrid value={aspect} onChange={setAspect} />
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="LoRA Strength">
            <input type="number" min={0} max={2} step={0.05} value={loraStrength}
              onChange={(e) => setLoraStrength(parseFloat(e.target.value) || 0.65)} className={inputCls} />
          </Field>
        </div>
        <Field label="LoRA">
          <select value={loraName} onChange={(e) => setLoraName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-xs text-fedda-text-1 outline-none focus:border-white/20">
            <option value="">— none —</option>
            {availableLoras.map((l) => <option key={l} value={l}>{l.split('/').pop() ?? l}</option>)}
          </select>
        </Field>
        <button type="button" onClick={() => setShowNeg((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 hover:text-fedda-text-2 transition">
          {showNeg ? '− Hide' : '+ Negative Prompt'}
        </button>
        {showNeg && (
          <Field label="Negative">
            <Textarea value={negative} onChange={setNegative} rows={2} />
          </Field>
        )}
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate with LTX'}
      </Button>
    </WorkflowShell>
  );
};

// ─── LTX First / Last Frame ───────────────────────────────────────────────────

const LENGTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];

export const LtxFlfPage = () => {
  const [prompt, setPrompt]                     = usePersistentState('ltx_flf_prompt', '');
  const [negative, setNegative]                 = usePersistentState('ltx_flf_negative', 'blurry, low quality, deformed, jitter, artifacts');
  const [seed, setSeed]                         = usePersistentState('ltx_flf_seed', -1);
  const [loraName, setLoraName]                 = usePersistentState('ltx_flf_lora_name', '');
  const [loraStrength, setLoraStrength]         = usePersistentState('ltx_flf_lora_strength', 0.65);
  const [aspect, setAspect]                     = usePersistentState<LtxRatio>('ltx_flf_ar', '16:9');
  const [lengthSeconds, setLengthSeconds]       = usePersistentState('ltx_flf_length', 5);
  const [direction, setDirection]               = usePersistentState<Direction>('ltx_flf_direction', 'forward');
  const [guideFirst, setGuideFirst]             = usePersistentState('ltx_flf_guide_first', 0.9);
  const [guideLast, setGuideLast]               = usePersistentState('ltx_flf_guide_last', 0.9);
  const [availableLoras, setAvailableLoras]     = useState<string[]>([]);
  const [showNeg, setShowNeg]                   = useState(false);

  const firstFrame = useLtxUpload('ltx_flf_first_frame');
  const lastFrame  = useLtxUpload('ltx_flf_last_frame');
  const run = useWorkflowRun({
    workflowId: 'ltx-flf',
    currentKey: 'ltx_flf_current',
    historyKey: 'ltx_flf_history',
    outputKind: 'video',
    readyMessage: 'LTX FLF video ready',
  });

  useEffect(() => {
    comfyService.getLoras().then((loras) => {
      setAvailableLoras(loras.filter((l) => l.replace(/\\/g, '/').toLowerCase().startsWith('ltx/')));
    }).catch(() => {});
  }, []);

  const handleGenerate = () => {
    if (!firstFrame.filename || !lastFrame.filename || !prompt.trim() || run.isGenerating) return;
    const dims = getLtxDimensions(aspect);
    run.start({
      image_first: firstFrame.filename,   // correct workflow_api.json key
      image_last: lastFrame.filename,     // correct workflow_api.json key
      prompt: prompt.trim(),
      negative: negative.trim(),
      width: dims.width,
      height: dims.height,
      length_seconds: lengthSeconds,
      direction,
      guide_strength_first: guideFirst,
      guide_strength_last: guideLast,
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
      ...(loraName ? { lora_name: loraName, lora_strength: loraStrength } : {}),
    });
  };

  const canGenerate = !!firstFrame.filename && !!lastFrame.filename && !!prompt.trim() && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="ltx-flf"
      output={
        <VideoOutputPane
          currentVideo={run.currentMedia}
          history={run.history}
          isGenerating={run.isGenerating}
          onSelectVideo={(url) => run.setCurrentMedia(url)}
          downloadName="fedda-ltx-flf.mp4"
        />
      }
    >
      {/* Frames */}
      <WorkflowSection>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Frame">
            <ImageSlot label="First frame" preview={firstFrame.preview} uploading={firstFrame.uploading} onFile={firstFrame.upload} onClear={firstFrame.clear} />
          </Field>
          <Field label="Last Frame">
            <ImageSlot label="Last frame" preview={lastFrame.preview} uploading={lastFrame.uploading} onFile={lastFrame.upload} onClear={lastFrame.clear} />
          </Field>
        </div>
        <Field
          label="Motion Description"
          action={<EnhanceButton prompt={prompt} onUpdate={setPrompt} workflowId="ltx-flf" />}
        >
          <Textarea value={prompt} onChange={setPrompt} rows={3} placeholder="Describe the motion between the two frames…" />
        </Field>
      </WorkflowSection>

      {/* Video length */}
      <WorkflowSection title="Length">
        <div className="flex flex-wrap gap-1.5">
          {LENGTH_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setLengthSeconds(s)}
              className={cn('rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                lengthSeconds === s
                  ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1',
              )}>
              {s}s
            </button>
          ))}
        </div>
      </WorkflowSection>

      {/* Aspect ratio */}
      <WorkflowSection title="Aspect Ratio">
        <AspectGrid value={aspect} onChange={setAspect} />
      </WorkflowSection>

      {/* Frame guide strengths */}
      <WorkflowSection title="Frame Adherence">
        <div className="grid grid-cols-2 gap-4">
          <Field label={`First frame · ${guideFirst.toFixed(2)}`}>
            <input type="range" min={0.5} max={1} step={0.05} value={guideFirst}
              onChange={(e) => setGuideFirst(parseFloat(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fedda-accent cursor-pointer" />
          </Field>
          <Field label={`Last frame · ${guideLast.toFixed(2)}`}>
            <input type="range" min={0.5} max={1} step={0.05} value={guideLast}
              onChange={(e) => setGuideLast(parseFloat(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fedda-accent cursor-pointer" />
          </Field>
        </div>
        <p className="text-[10px] text-fedda-text-4">Higher = stays closer to the reference frame. Lower = more creative interpolation.</p>
      </WorkflowSection>

      {/* Settings */}
      <WorkflowSection title="Settings">
        {/* Direction */}
        <Field label="Direction">
          <div className="flex gap-2">
            {(['forward', 'backward'] as Direction[]).map((d) => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                className={cn('flex-1 rounded-xl border py-2 text-xs font-semibold transition',
                  direction === d
                    ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                    : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1',
                )}>
                {d === 'forward' ? '→ Forward' : '← Backward'}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="LoRA Strength">
            <input type="number" min={0} max={2} step={0.05} value={loraStrength}
              onChange={(e) => setLoraStrength(parseFloat(e.target.value) || 0.65)} className={inputCls} />
          </Field>
        </div>
        <Field label="LoRA">
          <select value={loraName} onChange={(e) => setLoraName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-xs text-fedda-text-1 outline-none focus:border-white/20">
            <option value="">— none —</option>
            {availableLoras.map((l) => <option key={l} value={l}>{l.split('/').pop() ?? l}</option>)}
          </select>
        </Field>
        <button type="button" onClick={() => setShowNeg((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 hover:text-fedda-text-2 transition">
          {showNeg ? '− Hide' : '+ Negative Prompt'}
        </button>
        {showNeg && (
          <Field label="Negative">
            <Textarea value={negative} onChange={setNegative} rows={2} />
          </Field>
        )}
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate with LTX FLF'}
      </Button>
    </WorkflowShell>
  );
};
