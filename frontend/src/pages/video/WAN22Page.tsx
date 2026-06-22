import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Upload, X } from 'lucide-react';
import { WorkflowShell, WorkflowSection } from '../../components/layout/WorkflowShell';
import { VideoOutputPane } from '../../components/shared/VideoOutputPane';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Textarea } from '../../components/ui/Input';
import { useWorkflowRun } from '../../hooks/useWorkflowRun';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useToast } from '../../components/ui/Toast';
import { BACKEND_API } from '../../config/api';
import { comfyService } from '../../services/comfyService';
import { cn } from '../../lib/styles';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function useWanUpload(persistKey: string) {
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

function ImageSlot({ label, preview, uploading, accept = 'image/*', onFile, onClear }: {
  label: string; preview: string | null; uploading: boolean;
  accept?: string; onFile: (f: File) => void; onClear?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn('relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition cursor-pointer',
        preview ? 'border-white/10 p-2' : 'border-white/10 p-5 hover:border-white/25')}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      {preview ? (
        <div className="relative w-full">
          {accept.includes('video') ? (
            <video src={preview} className="w-full max-h-36 rounded-lg" muted playsInline />
          ) : (
            <img src={preview} alt={label} className="w-full max-h-36 rounded-lg object-contain" />
          )}
          {onClear && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 flex items-center justify-center text-white hover:bg-black transition">
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
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

function ScenePrompt({ label, value, onChange, placeholder, fallback }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; fallback?: string;
}) {
  const [open, setOpen] = useState(label === 'Scene 1');
  return (
    <div className={cn('rounded-xl border transition', value.trim() ? 'border-fedda-accent/20 bg-fedda-accent/[0.03]' : 'border-white/[0.06] bg-white/[0.02]')}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', value.trim() ? 'bg-fedda-accent' : 'bg-white/10')} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-fedda-text-3">{label}</span>
          {fallback && !value.trim() && <span className="text-[9px] text-fedda-text-4">→ {fallback}</span>}
          {value.trim() && <span className="text-[9px] text-fedda-text-4 truncate max-w-[120px]">{value.slice(0, 28)}{value.length > 28 ? '…' : ''}</span>}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-fedda-text-4" /> : <ChevronDown className="h-3.5 w-3.5 text-fedda-text-4" />}
      </button>
      {open && (
        <div className="px-4 pb-3">
          <Textarea value={value} onChange={onChange} rows={3} placeholder={placeholder} />
        </div>
      )}
    </div>
  );
}

function DualLora({ prefix, high, setHigh, highStr, setHighStr, low, setLow, lowStr, setLowStr, available }: {
  prefix: string; high: string; setHigh: (v: string) => void; highStr: number; setHighStr: (v: number) => void;
  low: string; setLow: (v: string) => void; lowStr: number; setLowStr: (v: number) => void; available: string[];
}) {
  const opts = available.filter((l) => l.replace(/\\/g, '/').toLowerCase().startsWith(prefix.toLowerCase()));
  const opt = (v: string, set: (v: string) => void, str: number, setStr: (v: number) => void, label: string) => (
    <div key={label} className="flex gap-2">
      <select value={v} onChange={(e) => set(e.target.value)}
        className="flex-1 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-xs text-fedda-text-1 outline-none focus:border-white/20">
        <option value="">— {label} LoRA —</option>
        {opts.map((l) => <option key={l} value={l}>{l.split('/').pop() ?? l}</option>)}
      </select>
      <input type="number" min={0} max={2} step={0.05} value={str}
        onChange={(e) => setStr(parseFloat(e.target.value) || 1)}
        className="w-16 rounded-xl border border-white/10 bg-fedda-bg-2 px-2 py-2 text-xs text-fedda-text-1 outline-none focus:border-white/20 text-center" />
    </div>
  );
  return (
    <div className="space-y-2">
      {opt(high, setHigh, highStr, setHighStr, 'High Noise')}
      {opt(low, setLow, lowStr, setLowStr, 'Low Noise')}
    </div>
  );
}

// ─── WAN 2.2 Img2Vid ──────────────────────────────────────────────────────────

export const WAN22Img2VidPage = () => {
  const [prompt1, setPrompt1] = usePersistentState('wan22i2v_p1', '');
  const [prompt2, setPrompt2] = usePersistentState('wan22i2v_p2', '');
  const [prompt3, setPrompt3] = usePersistentState('wan22i2v_p3', '');
  const [frameCount, setFrameCount] = usePersistentState('wan22i2v_frames', 81);
  const [seed, setSeed] = usePersistentState('wan22i2v_seed', -1);
  const [nsfw, setNsfw] = usePersistentState('wan22i2v_nsfw', true);
  const [loraHigh, setLoraHigh] = usePersistentState('wan22i2v_lora_high', '');
  const [loraLow, setLoraLow] = usePersistentState('wan22i2v_lora_low', '');
  const [loraStrHigh, setLoraStrHigh] = usePersistentState('wan22i2v_lora_high_str', 1.0);
  const [loraStrLow, setLoraStrLow] = usePersistentState('wan22i2v_lora_low_str', 1.0);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);

  const img = useWanUpload('wan22i2v_image');
  const run = useWorkflowRun({ workflowId: 'wan22-img2vid', currentKey: 'wan22i2v_current', historyKey: 'wan22i2v_history', outputKind: 'video', readyMessage: 'WAN video ready' });

  useEffect(() => {
    comfyService.getLoras().then((l) => setAvailableLoras(l)).catch(() => {});
  }, []);

  const handleGenerate = () => {
    if (!img.filename || !prompt1.trim() || run.isGenerating) return;
    run.start({
      image: img.filename,
      frame_count: frameCount,
      prompt1: prompt1.trim(),
      prompt2: prompt2.trim() || prompt1.trim(),
      prompt3: prompt3.trim() || prompt1.trim(),
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
      nsfw,
      ...(loraHigh ? { lora_high: { on: true, lora: loraHigh, strength: loraStrHigh } } : {}),
      ...(loraLow ? { lora_low: { on: true, lora: loraLow, strength: loraStrLow } } : {}),
    });
  };

  const canGenerate = !!img.filename && !!prompt1.trim() && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="wan22-img2vid"
      output={<VideoOutputPane currentVideo={run.currentMedia} history={run.history} isGenerating={run.isGenerating} onSelectVideo={(u) => run.setCurrentMedia(u)} downloadName="fedda-wan22-i2v.mp4" />}
    >
      <WorkflowSection>
        <Field label="Source Image">
          <ImageSlot label="Click or drop image" preview={img.preview} uploading={img.uploading} onFile={img.upload} onClear={img.clear} />
        </Field>
      </WorkflowSection>

      <WorkflowSection title="Frame Count">
        <div className="space-y-1">
          <input type="range" min={17} max={161} step={8} value={frameCount}
            onChange={(e) => setFrameCount(Number(e.target.value))}
            className="w-full accent-[#a78bfa]" />
          <div className="flex justify-between text-[10px] text-fedda-text-4">
            <span>17f · 0.7s</span>
            <span className="text-fedda-text-2 font-semibold">{frameCount}f · {(frameCount / 24).toFixed(1)}s</span>
            <span>161f · 6.7s</span>
          </div>
        </div>
      </WorkflowSection>

      <WorkflowSection title="Scene Expansions">
        <ScenePrompt label="Scene 1" value={prompt1} onChange={setPrompt1} placeholder="Describe the motion / action…" />
        <ScenePrompt label="Scene 2" value={prompt2} onChange={setPrompt2} placeholder="Continue the motion…" fallback="Scene 1" />
        <ScenePrompt label="Scene 3" value={prompt3} onChange={setPrompt3} placeholder="Final motion…" fallback="Scene 1" />
      </WorkflowSection>

      <WorkflowSection title="LoRA">
        <DualLora prefix="wan22/" high={loraHigh} setHigh={setLoraHigh} highStr={loraStrHigh} setHighStr={setLoraStrHigh}
          low={loraLow} setLow={setLoraLow} lowStr={loraStrLow} setLowStr={setLoraStrLow} available={availableLoras} />
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
          </Field>
          <Field label="NSFW">
            <label className="flex items-center gap-2 pt-2 cursor-pointer">
              <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="accent-[#a78bfa]" />
              <span className="text-xs text-fedda-text-2">Allow NSFW content</span>
            </label>
          </Field>
        </div>
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate WAN 2.2 Video'}
      </Button>
    </WorkflowShell>
  );
};

// ─── WAN 2.2 Vid2Vid ──────────────────────────────────────────────────────────

export const WAN22Vid2VidPage = () => {
  const [prompt1, setPrompt1] = usePersistentState('wan22v2v_p1', '');
  const [prompt2, setPrompt2] = usePersistentState('wan22v2v_p2', '');
  const [prompt3, setPrompt3] = usePersistentState('wan22v2v_p3', '');
  const [seed, setSeed] = usePersistentState('wan22v2v_seed', -1);
  const [nsfw, setNsfw] = usePersistentState('wan22v2v_nsfw', true);
  const [loraHigh, setLoraHigh] = usePersistentState('wan22v2v_lora_high', '');
  const [loraLow, setLoraLow] = usePersistentState('wan22v2v_lora_low', '');
  const [loraStrHigh, setLoraStrHigh] = usePersistentState('wan22v2v_lora_high_str', 1.0);
  const [loraStrLow, setLoraStrLow] = usePersistentState('wan22v2v_lora_low_str', 1.0);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);

  const vid = useWanUpload('wan22v2v_video');
  const run = useWorkflowRun({ workflowId: 'wan22-vid2vid', currentKey: 'wan22v2v_current', historyKey: 'wan22v2v_history', outputKind: 'video', readyMessage: 'WAN Vid2Vid ready' });

  useEffect(() => {
    comfyService.getLoras().then((l) => setAvailableLoras(l)).catch(() => {});
  }, []);

  const handleGenerate = () => {
    if (!vid.filename || !prompt1.trim() || run.isGenerating) return;
    run.start({
      video: vid.filename,
      prompt1: prompt1.trim(),
      prompt2: prompt2.trim() || prompt1.trim(),
      prompt3: prompt3.trim() || prompt1.trim(),
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
      nsfw,
      ...(loraHigh ? { lora_high: { on: true, lora: loraHigh, strength: loraStrHigh } } : {}),
      ...(loraLow ? { lora_low: { on: true, lora: loraLow, strength: loraStrLow } } : {}),
    });
  };

  const canGenerate = !!vid.filename && !!prompt1.trim() && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="wan22-vid2vid"
      output={<VideoOutputPane currentVideo={run.currentMedia} history={run.history} isGenerating={run.isGenerating} onSelectVideo={(u) => run.setCurrentMedia(u)} downloadName="fedda-wan22-v2v.mp4" />}
    >
      <WorkflowSection>
        <Field label="Source Video">
          <ImageSlot label="Click or drop video" preview={vid.preview} uploading={vid.uploading} accept="video/*" onFile={vid.upload} onClear={vid.clear} />
        </Field>
      </WorkflowSection>

      <WorkflowSection title="Scene Prompts">
        <ScenePrompt label="Scene 1" value={prompt1} onChange={setPrompt1} placeholder="Describe the style / motion transformation…" />
        <ScenePrompt label="Scene 2" value={prompt2} onChange={setPrompt2} placeholder="Continue…" fallback="Scene 1" />
        <ScenePrompt label="Scene 3" value={prompt3} onChange={setPrompt3} placeholder="Final…" fallback="Scene 1" />
      </WorkflowSection>

      <WorkflowSection title="LoRA">
        <DualLora prefix="wan22/" high={loraHigh} setHigh={setLoraHigh} highStr={loraStrHigh} setHighStr={setLoraStrHigh}
          low={loraLow} setLow={setLoraLow} lowStr={loraStrLow} setLowStr={setLoraStrLow} available={availableLoras} />
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
          </Field>
          <Field label="NSFW">
            <label className="flex items-center gap-2 pt-2 cursor-pointer">
              <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="accent-[#a78bfa]" />
              <span className="text-xs text-fedda-text-2">Allow NSFW content</span>
            </label>
          </Field>
        </div>
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Transform Video with WAN 2.2'}
      </Button>
    </WorkflowShell>
  );
};

// ─── WAN 2.2 Story (6 Frames) ─────────────────────────────────────────────────

const FRAME_COUNT = 6;

export const WAN22StoryPage = () => {
  const [prompts, setPrompts] = usePersistentState<string[]>('wan22_6f_prompts', Array(FRAME_COUNT).fill(''));
  const [imageNames, setImageNames] = usePersistentState<string[]>('wan22_6f_image_names', Array(FRAME_COUNT).fill(''));
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(Array(FRAME_COUNT).fill(null));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [seed, setSeed] = usePersistentState('wan22_6f_seed', -1);
  const [nsfw, setNsfw] = usePersistentState('wan22_6f_nsfw', true);
  const [loraHigh, setLoraHigh] = usePersistentState('wan22_6f_lora_high', '');
  const [loraLow, setLoraLow] = usePersistentState('wan22_6f_lora_low', '');
  const [loraStrHigh, setLoraStrHigh] = usePersistentState('wan22_6f_lora_high_str', 1.0);
  const [loraStrLow, setLoraStrLow] = usePersistentState('wan22_6f_lora_low_str', 1.0);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);

  const { toast } = useToast();
  const run = useWorkflowRun({ workflowId: 'wan22-img2vid-6frames', currentKey: 'wan22_6f_current', historyKey: 'wan22_6f_history', outputKind: 'video', readyMessage: 'WAN Story ready' });

  useEffect(() => {
    comfyService.getLoras().then((l) => setAvailableLoras(l)).catch(() => {});
  }, []);

  const uploadFrame = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BACKEND_API.BASE_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail || 'Upload failed');
      const next = [...imageNames];
      next[idx] = data.filename;
      setImageNames(next);
      const prevs = [...imagePreviews];
      prevs[idx] = URL.createObjectURL(file);
      setImagePreviews(prevs);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleGenerate = () => {
    const filled = imageNames.filter((n, i) => n && prompts[i]);
    if (!filled.length || run.isGenerating) return;
    const frames = imageNames.map((name, i) => ({ image: name, prompt: prompts[i] || '' })).filter((f) => f.image);
    run.start({
      frames,
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
      nsfw,
      ...(loraHigh ? { lora_high: { on: true, lora: loraHigh, strength: loraStrHigh } } : {}),
      ...(loraLow ? { lora_low: { on: true, lora: loraLow, strength: loraStrLow } } : {}),
    });
  };

  const canGenerate = imageNames.some((n) => n) && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="wan22-img2vid-6frames"
      output={<VideoOutputPane currentVideo={run.currentMedia} history={run.history} isGenerating={run.isGenerating} onSelectVideo={(u) => run.setCurrentMedia(u)} downloadName="fedda-wan22-story.mp4" />}
    >
      <WorkflowSection title="Story Frames">
        <div className="space-y-3">
          {Array.from({ length: FRAME_COUNT }, (_, i) => {
            const preview = imagePreviews[i] || (imageNames[i] ? `/comfy/view?filename=${encodeURIComponent(imageNames[i])}&type=input` : null);
            return (
              <div key={i} className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <ImageSlot
                  label={`Frame ${i + 1}`}
                  preview={preview}
                  uploading={uploadingIdx === i}
                  onFile={(f) => uploadFrame(i, f)}
                  onClear={() => {
                    const n = [...imageNames]; n[i] = ''; setImageNames(n);
                    const p = [...imagePreviews]; p[i] = null; setImagePreviews(p);
                  }}
                />
                <Textarea
                  value={prompts[i]}
                  onChange={(v) => { const next = [...prompts]; next[i] = v; setPrompts(next); }}
                  rows={3}
                  placeholder={`Describe scene ${i + 1}…`}
                />
              </div>
            );
          })}
        </div>
      </WorkflowSection>

      <WorkflowSection title="LoRA">
        <DualLora prefix="wan22/" high={loraHigh} setHigh={setLoraHigh} highStr={loraStrHigh} setHighStr={setLoraStrHigh}
          low={loraLow} setLow={setLoraLow} lowStr={loraStrLow} setLowStr={setLoraStrLow} available={availableLoras} />
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
          </Field>
          <Field label="NSFW">
            <label className="flex items-center gap-2 pt-2 cursor-pointer">
              <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="accent-[#a78bfa]" />
              <span className="text-xs text-fedda-text-2">Allow NSFW</span>
            </label>
          </Field>
        </div>
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate WAN Story'}
      </Button>
    </WorkflowShell>
  );
};
