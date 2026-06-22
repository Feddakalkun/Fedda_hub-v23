import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { WorkflowShell, WorkflowSection } from '../../components/layout/WorkflowShell';
import { ImageOutputPane } from '../../components/shared/ImageOutputPane';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { useImageGenerate } from '../../hooks/useImageGenerate';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useToast } from '../../components/ui/Toast';
import { comfyService } from '../../services/comfyService';
import { BACKEND_API } from '../../config/api';
import { cn } from '../../lib/styles';

type LoraEntry = { name: string; strength: number };
type PromptPreset = { group: string; label: string; prompt: string };
type SizePreset = { label: string; w: number; h: number };

export interface Txt2ImgConfig {
  storageKey: string;
  workflowId: string;
  familyLabel: string;
  enableLoras?: boolean;
  loraPrefixes?: string[];
  characterPromptLabel?: string;
  characterPromptPlaceholder?: string;
  requireImageUpload?: boolean;
  imageParamKey?: string;
  imageLabel?: string;
  aspectPresets: SizePreset[];
  allowedResolutions?: SizePreset[];
  defaultSteps?: number;
  defaultCfg?: number;
  defaultNegative?: string;
  maxSteps?: number;
  showCfgControl?: boolean;
  minCfg?: number;
  maxCfg?: number;
  promptPresets?: PromptPreset[];
  showMaskSettings?: boolean;
}

const normLora = (v: string) => v.replace(/\\/g, '/').toLowerCase().trim();

export const Txt2ImgPage = ({
  storageKey,
  workflowId,
  familyLabel,
  enableLoras = false,
  loraPrefixes = [],
  characterPromptLabel,
  characterPromptPlaceholder,
  requireImageUpload = false,
  imageParamKey = 'image',
  imageLabel = 'Reference Image',
  aspectPresets,
  allowedResolutions = [],
  defaultSteps = 20,
  defaultCfg = 7,
  defaultNegative = 'blurry, ugly, bad proportions, low quality, artifacts',
  maxSteps = 50,
  showCfgControl = false,
  minCfg = 1,
  maxCfg = 15,
  promptPresets = [],
  showMaskSettings = false,
}: Txt2ImgConfig) => {
  const k = (name: string) => `${storageKey}_${name}`;
  const { toast } = useToast();

  // Form state
  const [prompt, setPrompt] = usePersistentState(k('prompt'), '');
  const [charPrompt, setCharPrompt] = usePersistentState(k('char_prompt'), '');
  const [negPrompt, setNegPrompt] = usePersistentState(k('negative'), defaultNegative);
  const [width, setWidth] = usePersistentState(k('width'), aspectPresets[0]?.w ?? 1024);
  const [height, setHeight] = usePersistentState(k('height'), aspectPresets[0]?.h ?? 1024);
  const [steps, setSteps] = usePersistentState(k('steps'), defaultSteps);
  const [cfg, setCfg] = usePersistentState(k('cfg'), defaultCfg);
  const [seed, setSeed] = usePersistentState(k('seed'), -1);
  const [loraEntries, setLoraEntries] = usePersistentState<LoraEntry[]>(k('loras'), []);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [showNeg, setShowNeg] = useState(false);
  const [showMask, setShowMask] = useState(false);

  // Image upload state
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mask settings state
  const [maskFace, setMaskFace] = usePersistentState(k('mask_face'), false);
  const [maskHair, setMaskHair] = usePersistentState(k('mask_hair'), false);
  const [maskBody, setMaskBody] = usePersistentState(k('mask_body'), false);
  const [maskClothes, setMaskClothes] = usePersistentState(k('mask_clothes'), false);
  const [maskAccessories, setMaskAccessories] = usePersistentState(k('mask_accessories'), false);
  const [maskBackground, setMaskBackground] = usePersistentState(k('mask_background'), false);
  const [maskConfidence, setMaskConfidence] = usePersistentState(k('mask_confidence'), 0.2);
  const [maskDilation, setMaskDilation] = usePersistentState(k('mask_dilation'), 50);
  const [maskBlur, setMaskBlur] = usePersistentState(k('mask_blur'), 50);

  // Generate hook
  const { isGenerating, currentImage, setCurrentImage, history, previewUrl, start } = useImageGenerate({
    workflowId,
    historyKey: k('history'),
    currentKey: k('current_image'),
  });

  // Auto-size for SDXL inpaint when image is uploaded
  useEffect(() => {
    if (!requireImageUpload || !uploadedPreview || workflowId !== 'sdxl-inpaint-automask') return;
    const img = new Image();
    img.onload = () => {
      setWidth(Math.round(img.naturalWidth / 8) * 8);
      setHeight(Math.round(img.naturalHeight / 8) * 8);
    };
    img.src = uploadedPreview;
  }, [uploadedPreview, requireImageUpload, workflowId, setWidth, setHeight]);

  // Constrain to allowed resolutions
  useEffect(() => {
    if (!allowedResolutions.length || workflowId === 'sdxl-inpaint-automask') return;
    const ok = allowedResolutions.some((r) => r.w === width && r.h === height);
    if (ok) return;
    const fallback = aspectPresets[0] ?? allowedResolutions[0];
    if (fallback) { setWidth(fallback.w); setHeight(fallback.h); }
  }, [allowedResolutions, aspectPresets, width, height, setWidth, setHeight, workflowId]);

  // Load available LoRAs
  useEffect(() => {
    if (!enableLoras || !loraPrefixes.length) return;
    comfyService.getLoras().then((loras) => {
      const filtered = loras.filter((l) => loraPrefixes.some((p) => normLora(l).startsWith(normLora(p))));
      setAvailableLoras(filtered);
    }).catch(() => {});
  }, [enableLoras, loraPrefixes]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BACKEND_API.BASE_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail || 'Upload failed');
      setUploadedImageName(data.filename);
      if (uploadedPreview?.startsWith('blob:')) URL.revokeObjectURL(uploadedPreview);
      setUploadedPreview(URL.createObjectURL(file));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleUpload(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (requireImageUpload && !uploadedImageName) {
      toast(`Upload a ${imageLabel.toLowerCase()} first`, 'error');
      return;
    }

    const effectiveSeed = seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed;
    const effectivePrompt = [prompt.trim(), charPrompt.trim()].filter(Boolean).join(', ');

    const params: Record<string, unknown> = {
      prompt: effectivePrompt,
      negative: negPrompt,
      width,
      height,
      preresize_min_width: width,
      preresize_min_height: height,
      steps,
      cfg,
      seed: effectiveSeed,
    };

    if (requireImageUpload && uploadedImageName) {
      params[imageParamKey] = uploadedImageName;
    }

    const activeLoras = enableLoras
      ? loraEntries.filter((l) => l.name.trim()).map((l) => ({ name: l.name, strength: l.strength }))
      : [];
    if (activeLoras.length > 0) params.loras = activeLoras;

    if (showMaskSettings) {
      Object.assign(params, {
        mask_face: maskFace, mask_hair: maskHair, mask_body: maskBody,
        mask_clothes: maskClothes, mask_accessories: maskAccessories, mask_background: maskBackground,
        mask_confidence: maskConfidence, mask_dilation: maskDilation, mask_blur_amount: maskBlur,
      });
    }

    await start(params);
  };

  const canGenerate = !!prompt.trim() && !isGenerating && (!requireImageUpload || !!uploadedImageName);
  const lockSizeToPresets = allowedResolutions.length > 0 && workflowId !== 'sdxl-inpaint-automask';

  return (
    <WorkflowShell
      workflowId={workflowId}
      output={
        <ImageOutputPane
          currentImage={currentImage}
          history={history}
          isGenerating={isGenerating}
          previewUrl={previewUrl}
          onSelectImage={setCurrentImage}
          downloadName={`fedda-${storageKey}.png`}
        />
      }
    >
      {/* Prompt presets */}
      {promptPresets.length > 0 && (
        <WorkflowSection title="Quick Presets">
          <div className="flex flex-wrap gap-1.5">
            {promptPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setPrompt(preset.prompt)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-fedda-text-3 hover:text-fedda-text-1 hover:border-white/20 transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </WorkflowSection>
      )}

      {/* Prompt */}
      <WorkflowSection>
        <Field label="Prompt">
          <Textarea
            value={prompt}
            onChange={setPrompt}
            rows={4}
            placeholder={`Describe the image for ${familyLabel}…`}
          />
        </Field>

        {characterPromptLabel && (
          <Field label={characterPromptLabel}>
            <Textarea
              value={charPrompt}
              onChange={setCharPrompt}
              rows={2}
              placeholder={characterPromptPlaceholder ?? ''}
            />
          </Field>
        )}
      </WorkflowSection>

      {/* Image upload */}
      {requireImageUpload && (
        <WorkflowSection title={imageLabel}>
          <div
            className={cn(
              'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition cursor-pointer',
              uploadedPreview ? 'border-white/10 p-2' : 'border-white/10 p-6 hover:border-white/25',
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            {uploadedPreview ? (
              <div className="relative w-full">
                <img src={uploadedPreview} alt="Uploaded" className="w-full max-h-48 rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setUploadedPreview(null); setUploadedImageName(null); }}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 text-fedda-text-4" />
                <span className="text-xs text-fedda-text-4">
                  {uploading ? 'Uploading…' : `Click or drop ${imageLabel.toLowerCase()}`}
                </span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
          </div>
        </WorkflowSection>
      )}

      {/* LoRA entries */}
      {enableLoras && (
        <WorkflowSection title="LoRA">
          {loraEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={entry.name}
                onChange={(e) => {
                  const next = [...loraEntries];
                  next[i] = { ...entry, name: e.target.value };
                  setLoraEntries(next);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-xs text-fedda-text-1 outline-none focus:border-white/20 truncate"
              >
                <option value="">— select LoRA —</option>
                {availableLoras.map((l) => (
                  <option key={l} value={l}>{l.split('/').pop() ?? l}</option>
                ))}
              </select>
              <input
                type="number"
                min={0} max={2} step={0.05}
                value={entry.strength}
                onChange={(e) => {
                  const next = [...loraEntries];
                  next[i] = { ...entry, strength: parseFloat(e.target.value) || 1 };
                  setLoraEntries(next);
                }}
                className="w-16 rounded-xl border border-white/10 bg-fedda-bg-2 px-2 py-2 text-xs text-fedda-text-1 outline-none focus:border-white/20 text-center"
              />
              <button
                type="button"
                onClick={() => setLoraEntries(loraEntries.filter((_, j) => j !== i))}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-white/10 text-fedda-text-4 hover:text-red-400 transition flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost" size="sm"
            onClick={() => setLoraEntries([...loraEntries, { name: '', strength: 1.0 }])}
            disabled={loraEntries.length >= 4}
          >
            <Plus className="h-3 w-3" /> Add LoRA
          </Button>
        </WorkflowSection>
      )}

      {/* Settings */}
      <WorkflowSection title="Settings">
        {/* Size presets */}
        <Field label="Size">
          <div className={cn('grid gap-1 mb-2', aspectPresets.length <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
            {aspectPresets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setWidth(p.w); setHeight(p.h); }}
                className={cn(
                  'rounded-xl border py-2 text-[10px] font-semibold transition',
                  width === p.w && height === p.h
                    ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                    : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
                )}
              >
                {p.label}
                <span className="block text-[8px] font-normal opacity-60 mt-0.5">{p.w}×{p.h}</span>
              </button>
            ))}
          </div>
          {!lockSizeToPresets && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-fedda-text-4 mb-1">Width</p>
                <input
                  type="number" min={256} max={2048} step={8} value={width}
                  onChange={(e) => setWidth(Math.max(256, Math.round(Number(e.target.value) / 8) * 8))}
                  className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <p className="text-[9px] text-fedda-text-4 mb-1">Height</p>
                <input
                  type="number" min={256} max={2048} step={8} value={height}
                  onChange={(e) => setHeight(Math.max(256, Math.round(Number(e.target.value) / 8) * 8))}
                  className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
                />
              </div>
            </div>
          )}
        </Field>

        {/* Steps + optional CFG */}
        <div className={cn('grid gap-3', showCfgControl ? 'grid-cols-3' : 'grid-cols-2')}>
          <Field label={`Steps (max ${maxSteps})`}>
            <input
              type="number" min={1} max={maxSteps} step={1} value={steps}
              onChange={(e) => setSteps(Math.min(maxSteps, Math.max(1, Number(e.target.value))))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
            />
          </Field>
          {showCfgControl && (
            <Field label={`CFG (${minCfg}–${maxCfg})`}>
              <input
                type="number" min={minCfg} max={maxCfg} step={0.1} value={cfg}
                onChange={(e) => setCfg(parseFloat(e.target.value) || defaultCfg)}
                className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
              />
            </Field>
          )}
          <Field label="Seed (−1 = random)">
            <input
              type="number" value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
            />
          </Field>
        </div>

        {/* Negative prompt (collapsible) */}
        <button
          type="button"
          onClick={() => setShowNeg((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 hover:text-fedda-text-2 transition"
        >
          {showNeg ? '− Hide' : '+ Negative Prompt'}
        </button>
        {showNeg && (
          <Field label="Negative Prompt">
            <Textarea value={negPrompt} onChange={setNegPrompt} rows={3} />
          </Field>
        )}
      </WorkflowSection>

      {/* Mask settings (SDXL Inpaint) */}
      {showMaskSettings && (
        <WorkflowSection>
          <button
            type="button"
            onClick={() => setShowMask((v) => !v)}
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 hover:text-fedda-text-2 transition"
          >
            {showMask ? '− Hide' : '+ Mask Settings'}
          </button>
          {showMask && (
            <div className="space-y-3">
              <Field label="Mask Regions">
                <div className="flex flex-wrap gap-2">
                  {([
                    ['Face', maskFace, setMaskFace],
                    ['Hair', maskHair, setMaskHair],
                    ['Body', maskBody, setMaskBody],
                    ['Clothes', maskClothes, setMaskClothes],
                    ['Accessories', maskAccessories, setMaskAccessories],
                    ['Background', maskBackground, setMaskBackground],
                  ] as [string, boolean, (v: boolean) => void][]).map(([label, value, setter]) => (
                    <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox" checked={value}
                        onChange={(e) => setter(e.target.checked)}
                        className="rounded border-white/20 bg-fedda-bg-2 accent-fedda-accent"
                      />
                      <span className="text-xs text-fedda-text-2">{label}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['Confidence', maskConfidence, setMaskConfidence, 0, 1, 0.01],
                  ['Dilation', maskDilation, setMaskDilation, 0, 100, 1],
                  ['Blur', maskBlur, setMaskBlur, 0, 100, 1],
                ] as [string, number, (v: number) => void, number, number, number][]).map(([label, value, setter, min, max, step]) => (
                  <div key={label}>
                    <p className="text-[9px] text-fedda-text-4 mb-1">{label}</p>
                    <input
                      type="number" min={min} max={max} step={step} value={value}
                      onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-2 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </WorkflowSection>
      )}

      {/* Generate */}
      <Button variant="primary" size="lg" onClick={handleGenerate} disabled={!canGenerate} loading={isGenerating} className="w-full">
        {isGenerating ? 'Generating…' : `Generate with ${familyLabel}`}
      </Button>
    </WorkflowShell>
  );
};

// ─── Convenience re-export of Select for pages that need custom dropdowns ────
export { Select, Input };
