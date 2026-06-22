import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { WorkflowShell, WorkflowSection } from '../../components/layout/WorkflowShell';
import { VideoOutputPane } from '../../components/shared/VideoOutputPane';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useWorkflowRun } from '../../hooks/useWorkflowRun';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useToast } from '../../components/ui/Toast';
import { BACKEND_API } from '../../config/api';
import { cn } from '../../lib/styles';

const CONTROL_MODES = [
  { label: 'DWPose', value: 2 },
  { label: 'Lotus Depth', value: 1 },
  { label: 'Canny', value: 3 },
  { label: 'Canny Edge', value: 4 },
  { label: 'HED Soft Edge', value: 5 },
];

const STYLES = [
  'No Style',
  'Hyper Portrait Master',
  'Natural Beauty Unfiltered',
  'Kodak Portra Film',
  'Soft Diffused Intimacy',
  'Authentic Unposed Moment',
];

function useUpload(persistKey: string, accept: string) {
  const { toast } = useToast();
  const [filename, setFilename] = usePersistentState<string | null>(persistKey, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const stored = filename
    ? `/comfy/view?filename=${encodeURIComponent(filename)}&type=input`
    : null;

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
  return { filename, preview: preview || stored, uploading, upload, clear, accept };
}

function UploadSlot({ label, preview, uploading, accept, onFile, onClear }: {
  label: string; preview: string | null; uploading: boolean;
  accept: string; onFile: (f: File) => void; onClear?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isVideo = accept.includes('video');
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
          {isVideo
            ? <video src={preview} className="w-full max-h-40 rounded-lg" muted playsInline />
            : <img src={preview} alt={label} className="w-full max-h-40 rounded-lg object-contain" />}
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

// ─── Steady Dancer ────────────────────────────────────────────────────────────

export const SteadyDancerPage = () => {
  const [controlMode, setControlMode] = usePersistentState('dancer_control_mode', 2);
  const [style, setStyle] = usePersistentState('dancer_style', 'No Style');
  const [seed, setSeed] = usePersistentState('dancer_seed', -1);

  const portrait = useUpload('dancer_portrait', 'image/*');
  const refVid = useUpload('dancer_ref_video', 'video/*');
  const run = useWorkflowRun({
    workflowId: 'wan21-steady-dancer',
    currentKey: 'dancer_current',
    historyKey: 'dancer_history',
    outputKind: 'video',
    readyMessage: 'Steady Dancer complete',
  });

  const handleGenerate = () => {
    if (!portrait.filename || !refVid.filename || run.isGenerating) return;
    run.start({
      portrait_image: portrait.filename,
      reference_video: refVid.filename,
      control_mode: controlMode,
      style,
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
    });
  };

  const canGenerate = !!portrait.filename && !!refVid.filename && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="wan21-steady-dancer"
      output={<VideoOutputPane currentVideo={run.currentMedia} history={run.history} isGenerating={run.isGenerating} onSelectVideo={(u) => run.setCurrentMedia(u)} downloadName="fedda-steady-dancer.mp4" />}
    >
      <WorkflowSection>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Portrait Image">
            <UploadSlot label="Click or drop portrait" preview={portrait.preview} uploading={portrait.uploading} accept="image/*" onFile={portrait.upload} onClear={portrait.clear} />
          </Field>
          <Field label="Reference Video">
            <UploadSlot label="Click or drop dance video" preview={refVid.preview} uploading={refVid.uploading} accept="video/*" onFile={refVid.upload} onClear={refVid.clear} />
          </Field>
        </div>
      </WorkflowSection>

      <WorkflowSection title="Control Mode">
        <div className="grid grid-cols-3 gap-1">
          {CONTROL_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => setControlMode(m.value)}
              className={cn('rounded-xl border py-2 text-[10px] font-semibold transition',
                controlMode === m.value ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
              )}>{m.label}</button>
          ))}
        </div>
      </WorkflowSection>

      <WorkflowSection title="Style">
        <div className="grid grid-cols-2 gap-1">
          {STYLES.map((s) => (
            <button key={s} type="button" onClick={() => setStyle(s)}
              className={cn('rounded-xl border py-2 text-[10px] font-semibold transition text-left px-3',
                style === s ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
              )}>{s}</button>
          ))}
        </div>
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <Field label="Seed (−1 = random)">
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
        </Field>
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate Steady Dancer'}
      </Button>
    </WorkflowShell>
  );
};

// ─── SCAIL-2 ──────────────────────────────────────────────────────────────────

const QUALITY_STEPS = [-2, -1, 0, 1, 2] as const;
const QUALITY_LABELS: Record<number, string> = { [-2]: '0.5×', [-1]: '0.75×', [0]: '1×', [1]: '1.25×', [2]: '1.5×' };

export const Scail2Page = () => {
  const [qualityStep, setQualityStep] = usePersistentState('scail2_quality_step', 0);
  const [seed, setSeed] = usePersistentState('scail2_seed', -1);

  const portrait = useUpload('scail2_portrait', 'image/*');
  const refVid = useUpload('scail2_ref_video', 'video/*');
  const run = useWorkflowRun({
    workflowId: 'wan21-scail2',
    currentKey: 'scail2_current',
    historyKey: 'scail2_history',
    outputKind: 'video',
    readyMessage: 'SCAIL-2 complete',
  });

  const QUALITY_SCALES: Record<number, number> = { [-2]: 0.5, [-1]: 0.75, [0]: 1.0, [1]: 1.25, [2]: 1.5 };

  const handleGenerate = () => {
    if (!portrait.filename || !refVid.filename || run.isGenerating) return;
    run.start({
      portrait_image: portrait.filename,
      reference_video: refVid.filename,
      quality_scale: QUALITY_SCALES[qualityStep] ?? 1.0,
      seed: seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed,
    });
  };

  const canGenerate = !!portrait.filename && !!refVid.filename && !run.isGenerating;

  return (
    <WorkflowShell
      workflowId="wan21-scail2"
      output={<VideoOutputPane currentVideo={run.currentMedia} history={run.history} isGenerating={run.isGenerating} onSelectVideo={(u) => run.setCurrentMedia(u)} downloadName="fedda-scail2.mp4" />}
    >
      <WorkflowSection>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Portrait Image">
            <UploadSlot label="Click or drop portrait" preview={portrait.preview} uploading={portrait.uploading} accept="image/*" onFile={portrait.upload} onClear={portrait.clear} />
          </Field>
          <Field label="Reference Video">
            <UploadSlot label="Click or drop dance video" preview={refVid.preview} uploading={refVid.uploading} accept="video/*" onFile={refVid.upload} onClear={refVid.clear} />
          </Field>
        </div>
      </WorkflowSection>

      <WorkflowSection title="Quality Scale">
        <div className="flex gap-1">
          {QUALITY_STEPS.map((s) => (
            <button key={s} type="button" onClick={() => setQualityStep(s)}
              className={cn('flex-1 rounded-xl border py-2 text-[10px] font-semibold transition',
                qualityStep === s ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
              )}>{QUALITY_LABELS[s]}</button>
          ))}
        </div>
      </WorkflowSection>

      <WorkflowSection title="Settings">
        <Field label="Seed (−1 = random)">
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20" />
        </Field>
      </WorkflowSection>

      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={run.isGenerating} className="w-full">
        {run.isGenerating ? 'Generating…' : 'Generate SCAIL-2'}
      </Button>
    </WorkflowShell>
  );
};
