import { useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
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

// ─── LTX Img2Vid ─────────────────────────────────────────────────────────────

export const LtxImg2VidPage = () => {
  const [prompt, setPrompt] = usePersistentState('ltx_img2vid_prompt', '');
  const [negative, setNegative] = usePersistentState('ltx_img2vid_negative', 'blurry, low quality, deformed, jitter, artifacts');
  const [seed, setSeed] = usePersistentState('ltx_img2vid_seed', -1);
  const [loraName, setLoraName] = usePersistentState('ltx_img2vid_lora_name', '');
  const [loraStrength, setLoraStrength] = usePersistentState('ltx_img2vid_lora_strength', 0.65);
  const [aspect, setAspect] = usePersistentState<LtxRatio>('ltx_img2vid_ar', '16:9');
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [showNeg, setShowNeg] = useState(false);

  const img = useLtxUpload('ltx_img2vid_image_file');
  const run = useWorkflowRun({ workflowId: 'ltx-img2vid', currentKey: 'ltx_img2vid_current', historyKey: 'ltx_img2vid_history', outputKind: 'video', readyMessage: 'LTX video ready' });

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
        <Field label="Prompt">
          <Textarea value={prompt} onChange={setPrompt} rows={4} placeholder="Describe the motion and scene…" />
        </Field>
      </WorkflowSection>

      <WorkflowSection title="Aspect Ratio">
        <div className="grid grid-cols-4 gap-1">
          {LTX_RATIOS.map((r) => (
            <button key={r} type="button" onClick={() => setAspect(r as LtxRatio)}
              className={cn('rounded-xl border py-2 text-[10px] font-semibold transition',
                aspect === r ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
              )}>{r}</button>
          ))}
        </div>
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
          </Field>
          <Field label="LoRA Strength">
            <input type="number" min={0} max={2} step={0.05} value={loraStrength}
              onChange={(e) => setLoraStrength(parseFloat(e.target.value) || 0.65)}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
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
        {showNeg && <Field label="Negative"><Textarea value={negative} onChange={setNegative} rows={2} /></Field>}
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate with LTX'}
      </Button>
    </WorkflowShell>
  );
};

// ─── LTX First / Last Frame ──────────────────────────────────────────────────

export const LtxFlfPage = () => {
  const [prompt, setPrompt] = usePersistentState('ltx_flf_prompt', '');
  const [negative, setNegative] = usePersistentState('ltx_flf_negative', 'blurry, low quality, deformed, jitter, artifacts');
  const [seed, setSeed] = usePersistentState('ltx_flf_seed', -1);
  const [loraName, setLoraName] = usePersistentState('ltx_flf_lora_name', '');
  const [loraStrength, setLoraStrength] = usePersistentState('ltx_flf_lora_strength', 0.65);
  const [aspect, setAspect] = usePersistentState<LtxRatio>('ltx_flf_ar', '16:9');
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [showNeg, setShowNeg] = useState(false);

  const firstFrame = useLtxUpload('ltx_flf_first_frame');
  const lastFrame = useLtxUpload('ltx_flf_last_frame');
  const run = useWorkflowRun({ workflowId: 'ltx-flf', currentKey: 'ltx_flf_current', historyKey: 'ltx_flf_history', outputKind: 'video', readyMessage: 'LTX FLF video ready' });

  useEffect(() => {
    comfyService.getLoras().then((loras) => {
      setAvailableLoras(loras.filter((l) => l.replace(/\\/g, '/').toLowerCase().startsWith('ltx/')));
    }).catch(() => {});
  }, []);

  const handleGenerate = () => {
    if (!firstFrame.filename || !lastFrame.filename || !prompt.trim() || run.isGenerating) return;
    const dims = getLtxDimensions(aspect);
    run.start({
      first_frame: firstFrame.filename,
      last_frame: lastFrame.filename,
      prompt: prompt.trim(),
      negative: negative.trim(),
      width: dims.width,
      height: dims.height,
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
      <WorkflowSection>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Frame">
            <ImageSlot label="First frame" preview={firstFrame.preview} uploading={firstFrame.uploading} onFile={firstFrame.upload} onClear={firstFrame.clear} />
          </Field>
          <Field label="Last Frame">
            <ImageSlot label="Last frame" preview={lastFrame.preview} uploading={lastFrame.uploading} onFile={lastFrame.upload} onClear={lastFrame.clear} />
          </Field>
        </div>
        <Field label="Motion Description">
          <Textarea value={prompt} onChange={setPrompt} rows={3} placeholder="Describe the motion between the two frames…" />
        </Field>
      </WorkflowSection>

      <WorkflowSection title="Aspect Ratio">
        <div className="grid grid-cols-4 gap-1">
          {LTX_RATIOS.map((r) => (
            <button key={r} type="button" onClick={() => setAspect(r as LtxRatio)}
              className={cn('rounded-xl border py-2 text-[10px] font-semibold transition',
                aspect === r ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
              )}>{r}</button>
          ))}
        </div>
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
          </Field>
          <Field label="LoRA Strength">
            <input type="number" min={0} max={2} step={0.05} value={loraStrength}
              onChange={(e) => setLoraStrength(parseFloat(e.target.value) || 0.65)}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
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
        {showNeg && <Field label="Negative"><Textarea value={negative} onChange={setNegative} rows={2} /></Field>}
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate with LTX FLF'}
      </Button>
    </WorkflowShell>
  );
};
