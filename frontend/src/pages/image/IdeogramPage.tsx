import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { BACKEND_API } from '../../config/api';
import { useToast } from '../../components/ui/Toast';
import { useComfyExecution } from '../../contexts/ComfyExecutionContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { comfyService } from '../../services/comfyService';
import { WorkflowShell, WorkflowSection } from '../../components/layout/WorkflowShell';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Textarea, Input, Select } from '../../components/ui/Input';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';
import { ImageOutputPane } from '../../components/shared/ImageOutputPane';
import { cn } from '../../lib/styles';

const QUALITY_PRESETS = {
  Turbo: { steps: 12, mu: 0.5, std: 1.75 },
  Default: { steps: 20, mu: 0.0, std: 1.75 },
  Quality: { steps: 48, mu: 0.0, std: 1.5 },
} as const;
type QualityKey = keyof typeof QUALITY_PRESETS;

const SIZE_PRESETS = [
  { label: 'Square', w: 1024, h: 1024 },
  { label: 'Portrait', w: 880, h: 1456 },
  { label: 'Wide', w: 1456, h: 880 },
  { label: 'Tall', w: 784, h: 1456 },
];

const STYLE_OPTIONS = ['none', 'auto', 'realistic', 'design', 'illustration', 'render_3d', 'anime'];
const BG_PRESETS = ['white bg', 'black bg', 'transparent', 'gradient', 'studio'];

interface IdeogramElement {
  id: string;
  type: 'text' | 'obj';
  text: string;
  desc: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function newElement(type: 'text' | 'obj'): IdeogramElement {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type, text: '', desc: '', x: 0.1, y: 0.1, w: 0.4, h: 0.2,
  };
}

function serializeElements(elements: IdeogramElement[]): string {
  return JSON.stringify(elements.map((el) => ({
    type: el.type, text: el.type === 'obj' ? '' : el.text,
    desc: el.desc, palette: [] as string[],
    x: el.x, y: el.y, w: el.w, h: el.h,
  })));
}

// --- Main page ---
export function IdeogramPage() {
  const { toast } = useToast();
  const { state: execState, error: execError, lastOutputImages, outputReadyCount, previewUrl, registerNodeMap, startExecution } = useComfyExecution();

  const prevImgCountRef = useRef(0);

  const [description, setDescription] = usePersistentState('ideogram_description', '');
  const [background, setBackground] = usePersistentState('ideogram_background', 'white bg');
  const [style, setStyle] = usePersistentState('ideogram_style', 'none');
  const [aesthetics, setAesthetics] = usePersistentState('ideogram_aesthetics', '');
  const [lighting, setLighting] = usePersistentState('ideogram_lighting', '');
  const [medium, setMedium] = usePersistentState('ideogram_medium', '');
  const [bgBrightness, setBgBrightness] = usePersistentState('ideogram_bg_brightness', 13);
  const [elements, setElements] = usePersistentState<IdeogramElement[]>('ideogram_elements', []);
  const [width, setWidth] = usePersistentState('ideogram_width', 1024);
  const [height, setHeight] = usePersistentState('ideogram_height', 1024);
  const [quality, setQuality] = usePersistentState<QualityKey>('ideogram_quality', 'Default');
  const [seed, setSeed] = usePersistentState('ideogram_seed', -1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);

  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = usePersistentState<string[]>('ideogram_history', []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);

  const canRun = !!description.trim() && !isGenerating;

  useEffect(() => {
    if (!isGenerating && !pendingPromptId) return;
    if (!lastOutputImages?.length) return;
    const newImgs = lastOutputImages.slice(prevImgCountRef.current);
    if (!newImgs.length) return;
    prevImgCountRef.current = lastOutputImages.length;
    const urls = newImgs.map((img) => comfyService.getImageUrl(img));
    const ideogramUrls = urls.filter((url) => /ideogram/i.test(url));
    const picked = ideogramUrls.length > 0 ? ideogramUrls : urls;
    if (!picked.length) return;
    setCurrentImage(picked[picked.length - 1]);
    setHistory((prev) => [...picked, ...prev].slice(0, 30));
  }, [outputReadyCount, lastOutputImages, isGenerating, pendingPromptId, setHistory]);

  useEffect(() => {
    if (!pendingPromptId) return;
    if (execState === 'done') { setIsGenerating(false); setPendingPromptId(null); toast('Ideogram generation complete', 'success'); }
    if (execState === 'error') {
      setIsGenerating(false); setPendingPromptId(null);
      toast(typeof execError === 'string' ? execError : (execError?.message ?? 'Ideogram failed'), 'error');
    }
  }, [execError, execState, pendingPromptId, toast]);

  const runIdeogram = async () => {
    if (!canRun) return;
    prevImgCountRef.current = lastOutputImages?.length ?? 0;
    setIsGenerating(true);

    fetch(`${BACKEND_API.BASE_URL}/api/workflow/node-map/ideogram-txt2img`)
      .then((r) => r.json())
      .then((data) => { if (data.success) registerNodeMap(data.node_map); })
      .catch(() => {});

    const preset = QUALITY_PRESETS[quality];
    const effectiveSeed = seed === -1 ? Math.floor(Math.random() * 10_000_000_000) : seed;

    try {
      const res = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.GENERATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: 'ideogram-txt2img',
          params: {
            description: description.trim(), background: background.trim(), style,
            aesthetics: aesthetics.trim(), lighting: lighting.trim(), medium: medium.trim(),
            bg_brightness: bgBrightness, elements_data: serializeElements(elements),
            width, height, steps: preset.steps, mu: preset.mu, std: preset.std,
            seed: effectiveSeed, client_id: comfyService.clientId,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Ideogram generation failed');
      setPendingPromptId(String(data.prompt_id));
      startExecution();
    } catch (err: unknown) {
      setIsGenerating(false);
      toast(err instanceof Error ? err.message : 'Ideogram generation failed', 'error');
    }
  };

  const updateElement = (id: string, patch: Partial<IdeogramElement>) =>
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));

  const removeElement = (id: string) =>
    setElements((prev) => prev.filter((el) => el.id !== id));

  const generateLayout = async () => {
    if (!description.trim()) { toast('Enter a description first', 'error'); return; }
    setIsGeneratingLayout(true);
    try {
      const res = await fetch(`${BACKEND_API.BASE_URL}/api/ideogram/generate-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Layout generation failed');
      if (data.description) setDescription(data.description);
      if (data.background) setBackground(data.background);
      if (Array.isArray(data.elements)) {
        setElements(data.elements.map((el: any) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: (el.type === 'text' ? 'text' : 'obj') as 'text' | 'obj',
          text: el.text ?? '', desc: el.desc ?? '',
          x: el.x ?? 0.1, y: el.y ?? 0.1, w: el.w ?? 0.4, h: el.h ?? 0.2,
        })));
      }
      toast(`Layout generated — ${data.elements?.length ?? 0} elements`, 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Layout generation failed', 'error');
    } finally {
      setIsGeneratingLayout(false);
    }
  };

  return (
    <WorkflowShell
      workflowId="ideogram-txt2img"
      output={
        <ImageOutputPane
          currentImage={currentImage}
          history={history}
          isGenerating={isGenerating}
          previewUrl={previewUrl}
          onSelectImage={setCurrentImage}
        />
      }
    >
      {/* Description */}
      <WorkflowSection>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={setDescription}
            rows={4}
            placeholder="Describe the overall image: scene, mood, content, style…"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Background">
            <Input value={background} onChange={setBackground} placeholder="e.g. white bg, gradient…" />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {BG_PRESETS.map((p) => (
                <button
                  key={p} type="button" onClick={() => setBackground(p)}
                  className={cn(
                    'rounded-lg border px-2 py-0.5 text-[10px] transition',
                    background === p
                      ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                      : 'border-white/10 bg-white/[0.03] text-fedda-text-4 hover:text-fedda-text-2',
                  )}
                >{p}</button>
              ))}
            </div>
          </Field>

          <Field label="Style">
            <Select value={style} onChange={setStyle}>
              {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 hover:text-fedda-text-2 transition"
        >
          {showAdvanced ? '− Hide' : '+ Aesthetics, Lighting, Medium'}
        </button>
        {showAdvanced && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Aesthetics"><Input value={aesthetics} onChange={setAesthetics} placeholder="cinematic…" /></Field>
            <Field label="Lighting"><Input value={lighting} onChange={setLighting} placeholder="golden hour…" /></Field>
            <Field label="Medium"><Input value={medium} onChange={setMedium} placeholder="oil painting…" /></Field>
          </div>
        )}
      </WorkflowSection>

      {/* Settings */}
      <WorkflowSection title="Settings">
        <Field label="Quality">
          <div className="flex gap-1">
            {(Object.keys(QUALITY_PRESETS) as QualityKey[]).map((key) => (
              <button
                key={key} type="button" onClick={() => setQuality(key)}
                className={cn(
                  'flex-1 rounded-xl border py-2 text-xs font-semibold transition',
                  quality === key
                    ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                    : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1 hover:bg-white/[0.05]',
                )}
              >{key}</button>
            ))}
          </div>
          <p className="text-[10px] text-fedda-text-4 mt-1">{QUALITY_PRESETS[quality].steps} steps</p>
        </Field>

        <Field label="Size">
          <div className="grid grid-cols-4 gap-1 mb-2">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label} type="button" onClick={() => { setWidth(p.w); setHeight(p.h); }}
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-fedda-text-4 mb-1">Width</p>
              <input type="number" min={256} max={2048} step={16} value={width}
                onChange={(e) => setWidth(Math.max(256, Math.round(Number(e.target.value) / 16) * 16))}
                className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <p className="text-[9px] text-fedda-text-4 mb-1">Height</p>
              <input type="number" min={256} max={2048} step={16} value={height}
                onChange={(e) => setHeight(Math.max(256, Math.round(Number(e.target.value) / 16) * 16))}
                className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
              />
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="BG Brightness">
            <input type="number" min={0} max={100} value={bgBrightness}
              onChange={(e) => setBgBrightness(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
            />
          </Field>
          <Field label="Seed (−1 = random)">
            <input type="number" value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20"
            />
          </Field>
        </div>
      </WorkflowSection>

      {/* Elements */}
      <WorkflowSection title="Placed Elements (optional)">
        <div className="flex gap-2">
          <Button
            variant="ghost" size="sm"
            onClick={generateLayout}
            disabled={isGeneratingLayout || !description.trim()}
            className="border border-fedda-accent/30 bg-fedda-accent/[0.06] text-fedda-accent hover:bg-fedda-accent/10"
          >
            {isGeneratingLayout ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {isGeneratingLayout ? 'Thinking…' : 'AI Layout'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setElements((p) => [...p, newElement('text')])}>
            <Plus className="h-3 w-3" /> Text
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setElements((p) => [...p, newElement('obj')])}>
            <Plus className="h-3 w-3" /> Object
          </Button>
        </div>

        {elements.length === 0 ? (
          <p className="text-[11px] text-fedda-text-4 py-2 text-center">
            Add text or object elements to control their placement (positions are 0.0–1.0).
          </p>
        ) : (
          <div className="space-y-2">
            {elements.map((el) => (
              <Panel key={el.id} className="!p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={el.type === 'text' ? 'accent' : 'success'}>{el.type}</Badge>
                  <button type="button" onClick={() => removeElement(el.id)} className="text-fedda-text-4 hover:text-red-400 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {el.type === 'text' && (
                  <Textarea value={el.text} onChange={(v) => updateElement(el.id, { text: v })} rows={2}
                    placeholder="Text content (use \n for line breaks)" className="text-xs" />
                )}
                <Textarea value={el.desc} onChange={(v) => updateElement(el.id, { desc: v })} rows={2}
                  placeholder={el.type === 'text' ? 'Visual description (bold sans-serif, white, metallic…)' : 'Object description (photorealistic person, car…)'}
                  className="text-xs" />
                <div className="grid grid-cols-4 gap-1.5">
                  {(['x', 'y', 'w', 'h'] as const).map((key) => (
                    <div key={key}>
                      <p className="text-[9px] uppercase tracking-wider text-fedda-text-4 mb-0.5">
                        {key === 'x' ? 'Left' : key === 'y' ? 'Top' : key === 'w' ? 'Width' : 'Height'}
                      </p>
                      <input type="number" min={0} max={1} step={0.01} value={el[key]}
                        onChange={(e) => updateElement(el.id, { [key]: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) })}
                        className="w-full rounded-lg border border-white/10 bg-fedda-bg-2 px-2 py-1 text-[10px] font-mono text-fedda-text-1 outline-none focus:border-white/20"
                      />
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </WorkflowSection>

      {/* Generate */}
      <Button
        variant="primary"
        size="lg"
        onClick={runIdeogram}
        disabled={!canRun}
        loading={isGenerating}
        className="w-full"
      >
        {isGenerating ? 'Generating…' : 'Generate Image'}
      </Button>
    </WorkflowShell>
  );
}

export default IdeogramPage;
