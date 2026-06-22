import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
    CircleDot,
    Download,
    Eraser,
    Image as ImageIcon,
    Loader2,
    Lock,
    RefreshCw,
    Sparkles,
    Unlock,
    Wand2,
} from 'lucide-react';
import { BACKEND_API } from '../../config/api';
import { WorkflowShell } from '../../components/layout/WorkflowShell';
import { useComfyExecution } from '../../contexts/ComfyExecutionContext';
import { comfyService } from '../../services/comfyService';
import { useToast } from '../../components/ui/Toast';
import { usePersistentState } from '../../hooks/usePersistentState';

type BoxSource = 'none' | 'detected' | 'fallback' | 'manual';
type DualBox = { x1: number; y1: number; x2: number; y2: number };
type DragPoint = { x: number; y: number };
type TraitSet = { gender: string; archetype: string; hair: string; wardrobe: string; face: string; pose: string };
type StageStatus = {
    success: boolean;
    status?: 'pending' | 'running' | 'completed' | 'not_found';
    error?: string;
    images?: Array<{ filename: string; subfolder: string; type: string }>;
    detected_boxes?: number[][];
    raw_outputs?: Record<string, unknown>;
};

const TARGET_CHOICES = [
    { label: 'Person 1', hint: 'left side', side: 'left' },
    { label: 'Person 2', hint: 'right side', side: 'right' },
];
const ARCHETYPES = ['editorial model', 'cinematic character', 'streetwear creator', 'fashion portrait subject', 'studio muse'];
const GENDERS = ['woman', 'man'];
const HAIR = ['long blonde hair', 'black bob haircut', 'soft brown waves', 'silver ponytail', 'dark curly hair'];
const WARDROBE = ['minimal modern outfit', 'tailored black blazer', 'clean white top', 'luxury fashion styling', 'soft neutral wardrobe'];
const FACES = ['natural skin texture', 'calm confident expression', 'soft smile', 'sharp editorial gaze', 'realistic facial detail'];
const POSES = ['standing side by side', 'three-quarter portrait pose', 'relaxed fashion pose', 'shoulders angled toward camera', 'clean studio composition'];
const SCENES = ['neutral studio background', 'soft window light interior', 'minimal black and grey set', 'editorial photo studio', 'cinematic apartment light'];
const STYLES = ['photorealistic, natural skin, coherent faces', 'editorial photography, clean lighting, sharp focus', 'cinematic realism, balanced contrast, detailed texture', 'high-end fashion photo, realistic anatomy, soft shadows'];

const randomFrom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)] || '';
const randomSeed = () => Math.floor(Math.random() * 9_000_000_000_000) + 1;

const inputCls = 'w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-xs text-fedda-text-1 outline-none transition focus:border-white/20';
const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.14em] text-fedda-text-4 mb-1';

function choosePreferredBoxIndex(boxes: DualBox[], phrase: string) {
    if (boxes.length === 0) return -1;
    if (boxes.length === 1) return 0;
    const lower = phrase.toLowerCase();
    const wantsLeft = lower.includes('left');
    const wantsRight = lower.includes('right');
    if (!wantsLeft && !wantsRight) return 0;
    let bestIndex = 0;
    let bestCenter = (boxes[0].x1 + boxes[0].x2) / 2;
    boxes.forEach((box, index) => {
        const center = (box.x1 + box.x2) / 2;
        if ((wantsLeft && center < bestCenter) || (wantsRight && center > bestCenter)) {
            bestIndex = index;
            bestCenter = center;
        }
    });
    return bestIndex;
}

function extractBoxesFromUnknown(value: unknown): DualBox[] {
    const boxes: DualBox[] = [];
    const seen = new Set<string>();
    const add = (x1: number, y1: number, x2: number, y2: number) => {
        if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
        if (x2 <= x1 || y2 <= y1) return;
        const key = `${x1.toFixed(1)}:${y1.toFixed(1)}:${x2.toFixed(1)}:${y2.toFixed(1)}`;
        if (seen.has(key)) return;
        seen.add(key);
        boxes.push({ x1, y1, x2, y2 });
    };
    const walk = (v: unknown) => {
        if (Array.isArray(v)) {
            if (v.length >= 4) { const [a, b, c, d] = v.map(Number); if ([a, b, c, d].every(Number.isFinite)) add(a, b, c, d); }
            v.forEach(walk);
            return;
        }
        if (v && typeof v === 'object') {
            const obj = v as Record<string, unknown>;
            if (['x1', 'y1', 'x2', 'y2'].every((k) => typeof obj[k] !== 'undefined')) add(Number(obj.x1), Number(obj.y1), Number(obj.x2), Number(obj.y2));
            if (['left', 'top', 'right', 'bottom'].every((k) => typeof obj[k] !== 'undefined')) add(Number(obj.left), Number(obj.top), Number(obj.right), Number(obj.bottom));
            Object.values(obj).forEach(walk);
        }
    };
    walk(value);
    return boxes;
}

async function pollPrompt(promptId: string, workflowId: string, timeoutMs = 300000): Promise<StageStatus> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const res = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.GENERATE_STATUS}/${promptId}?workflow_id=${encodeURIComponent(workflowId)}`);
        const data = (await res.json()) as StageStatus;
        if (!data.success) throw new Error(data.error || 'Status request failed');
        if (data.status === 'completed') return data;
        await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    throw new Error('Timed out waiting for generation');
}

const selectBestImage = (images: StageStatus['images'], needle: string) => {
    const list = images || [];
    return list.find((img) => String(img.filename).toLowerCase().includes(needle)) || list[list.length - 1];
};

export const ZImageDualLoraPage = () => {
    const { toast } = useToast();
    const { clearOutputs, registerNodeMap } = useComfyExecution();

    const [loraMainName, setLoraMainName] = usePersistentState('zimage_dual_lora_main_name', '');
    const [loraMainStrength, setLoraMainStrength] = usePersistentState('zimage_dual_lora_main_strength', 1);
    const [loraDetailName, setLoraDetailName] = usePersistentState('zimage_dual_lora_detail_name', '');
    const [loraDetailStrength, setLoraDetailStrength] = usePersistentState('zimage_dual_lora_detail_strength', 1);
    const [scene, setScene] = usePersistentState('zimage_dual_scene', SCENES[0]);
    const [style, setStyle] = usePersistentState('zimage_dual_style', STYLES[0]);
    const [personA, setPersonA] = usePersistentState<TraitSet>('zimage_dual_trait_a', { gender: 'woman', archetype: ARCHETYPES[0], hair: HAIR[0], wardrobe: WARDROBE[0], face: FACES[0], pose: POSES[0] });
    const [personB, setPersonB] = usePersistentState<TraitSet>('zimage_dual_trait_b', { gender: 'woman', archetype: ARCHETYPES[1], hair: HAIR[1], wardrobe: WARDROBE[1], face: FACES[1], pose: POSES[1] });
    const [mainPrompt, setMainPrompt] = usePersistentState('zimage_dual_main_prompt', '');
    const [detailPrompt, setDetailPrompt] = usePersistentState('zimage_dual_detail_prompt', '');
    const [negativePrompt, setNegativePrompt] = usePersistentState('zimage_dual_negative_prompt', 'blurry, low quality, bad anatomy, deformed, extra limbs, distorted face, plastic skin');
    const [detectionPhrase, setDetectionPhrase] = usePersistentState('zimage_dual_detection_phrase', 'person on right');
    const [lockedSeed, setLockedSeed] = usePersistentState<number>('zimage_dual_locked_seed', randomSeed());
    const [seedLocked, setSeedLocked] = usePersistentState<boolean>('zimage_dual_seed_locked', false);
    const [baseImageUrl, setBaseImageUrl] = usePersistentState<string | null>('zimage_dual_base_image', null);
    const [beforeImageUrl, setBeforeImageUrl] = usePersistentState<string | null>('zimage_dual_before_image', null);
    const [finalImageUrl, setFinalImageUrl] = usePersistentState<string | null>('zimage_dual_final_image', null);
    const [detectedBoxes, setDetectedBoxes] = usePersistentState<DualBox[]>('zimage_dual_boxes', []);
    const [selectedBoxIndex, setSelectedBoxIndex] = usePersistentState<number>('zimage_dual_selected_box', -1);
    const [boxSource, setBoxSource] = usePersistentState<BoxSource>('zimage_dual_box_source', 'none');

    const [runningWorkflow, setRunningWorkflow] = useState(false);
    const [availableLoras, setAvailableLoras] = useState<string[]>([]);
    const [manualMarkMode, setManualMarkMode] = useState(false);
    const [dragStart, setDragStart] = useState<DragPoint | null>(null);
    const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);
    const [notice, setNotice] = useState('');

    const imageRef = useRef<HTMLImageElement | null>(null);
    const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

    const selectedBox = selectedBoxIndex >= 0 ? detectedBoxes[selectedBoxIndex] : undefined;
    const canRun = !!loraMainName && !!loraDetailName && loraMainStrength > 0 && loraDetailStrength > 0;

    const draftBox = useMemo(() => {
        if (!dragStart || !dragCurrent) return null;
        return { x1: Math.min(dragStart.x, dragCurrent.x), y1: Math.min(dragStart.y, dragCurrent.y), x2: Math.max(dragStart.x, dragCurrent.x), y2: Math.max(dragStart.y, dragCurrent.y) };
    }, [dragCurrent, dragStart]);

    useEffect(() => {
        comfyService.getLoras().then((all) => {
            const filtered = all.filter((name) => {
                const normalized = name.replace(/\\/g, '/').toLowerCase();
                return normalized.startsWith('zimage_turbo/') || normalized.startsWith('zimage-turbo/');
            });
            setAvailableLoras(filtered);
        }).catch(() => setAvailableLoras([]));
    }, []);

    const buildFallbackBoxes = (w: number, h: number, phrase: string) => {
        const left: DualBox = { x1: w * 0.06, y1: h * 0.08, x2: w * 0.49, y2: h * 0.96 };
        const right: DualBox = { x1: w * 0.51, y1: h * 0.08, x2: w * 0.94, y2: h * 0.96 };
        const center: DualBox = { x1: w * 0.18, y1: h * 0.08, x2: w * 0.82, y2: h * 0.96 };
        const lower = phrase.toLowerCase();
        if (lower.includes('left')) return [left, right];
        if (lower.includes('right')) return [right, left];
        return [left, right, center];
    };

    const eventToNaturalPoint = (e: ReactMouseEvent): DragPoint | null => {
        const img = imageRef.current;
        if (!img) return null;
        const rect = img.getBoundingClientRect();
        if (!rect.width || !rect.height || naturalSize.w <= 1 || naturalSize.h <= 1) return null;
        const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
        const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
        return { x: (x / rect.width) * naturalSize.w, y: (y / rect.height) * naturalSize.h };
    };

    const randomizePromptParts = () => {
        setPersonA({ gender: personA.gender || 'woman', archetype: randomFrom(ARCHETYPES), hair: randomFrom(HAIR), wardrobe: randomFrom(WARDROBE), face: randomFrom(FACES), pose: randomFrom(POSES) });
        setPersonB({ gender: personB.gender || 'woman', archetype: randomFrom(ARCHETYPES), hair: randomFrom(HAIR), wardrobe: randomFrom(WARDROBE), face: randomFrom(FACES), pose: randomFrom(POSES) });
        setScene(randomFrom(SCENES));
        setStyle(randomFrom(STYLES));
    };

    const composePrompts = () => {
        const left = `left person: ${personA.gender || 'woman'}, ${personA.archetype}, ${personA.hair}, ${personA.wardrobe}, ${personA.face}, ${personA.pose}`;
        const right = `right person: ${personB.gender || 'woman'}, ${personB.archetype}, ${personB.hair}, ${personB.wardrobe}, ${personB.face}, ${personB.pose}`;
        const base = `two people side by side, ${left}, ${right}, ${scene}, ${style}, realistic proportions, separate identities, clean composition`;
        const target = detectionPhrase.toLowerCase().includes('left') ? personA : personB;
        const side = detectionPhrase.toLowerCase().includes('left') ? 'left' : 'right';
        const detail = `refine only the ${side} ${target.gender || 'person'} inside the mask, preserve the other person unchanged, preserve pose and composition, ${target.gender || 'person'}, ${target.archetype}, ${target.hair}, ${target.face}, natural skin texture, coherent face, realistic lighting`;
        setMainPrompt(base);
        setDetailPrompt(detail);
        return { base, detail };
    };

    const setDetectionTarget = (phrase: string) => {
        setDetectionPhrase(phrase);
        if (detectedBoxes.length > 0) setSelectedBoxIndex(choosePreferredBoxIndex(detectedBoxes, phrase));
    };

    const clearSelection = () => {
        setDetectedBoxes([]);
        setSelectedBoxIndex(-1);
        setBoxSource('none');
        setManualMarkMode(false);
        setDragStart(null);
        setDragCurrent(null);
        setNotice('');
    };

    const applyFallbackBoxes = () => {
        if (!baseImageUrl || naturalSize.w <= 1 || naturalSize.h <= 1) { toast('Preview must load first.', 'info'); return; }
        const boxes = buildFallbackBoxes(naturalSize.w, naturalSize.h, detectionPhrase);
        setDetectedBoxes(boxes);
        setSelectedBoxIndex(choosePreferredBoxIndex(boxes, detectionPhrase));
        setBoxSource('fallback');
        setManualMarkMode(false);
        setNotice('Auto-mark fallback boxes are active.');
    };

    const ensurePromptText = () => {
        if (mainPrompt.trim() && detailPrompt.trim()) return { base: mainPrompt.trim(), detail: detailPrompt.trim() };
        return composePrompts();
    };

    const targetPhraseForSide = (side: string) => {
        const target = side === 'left' ? personA : personB;
        return `${side} ${target.gender || 'person'}`;
    };

    const selectedTargetSide = detectionPhrase.toLowerCase().includes('left') ? 'left' : 'right';

    const runSingleWorkflow = async () => {
        if (!canRun) { toast('Select both LoRAs first.', 'error'); return; }
        const prompts = ensurePromptText();
        const seed = seedLocked ? lockedSeed : randomSeed();
        setLockedSeed(seed);
        setSeedLocked(true);
        clearOutputs();
        setFinalImageUrl(null);
        setRunningWorkflow(true);
        try {
            const finalDetectionPhrase = targetPhraseForSide(selectedTargetSide);
            setDetectionPhrase(finalDetectionPhrase);
            try {
                const r = await fetch(`${BACKEND_API.BASE_URL}/api/workflow/node-map/z-image-dual-lora`);
                const d = await r.json();
                if (d.success) registerNodeMap(d.node_map);
            } catch { /**/ }

            const payload = {
                workflow_id: 'z-image-dual-lora',
                params: {
                    main_prompt: prompts.base, detail_prompt: prompts.detail, negative: negativePrompt,
                    detection_phrase: finalDetectionPhrase, selected_box_index: '0', seed,
                    lora_main_name: loraMainName, lora_main_strength: Number(loraMainStrength),
                    lora_detail_name: loraDetailName, lora_detail_strength: Number(loraDetailStrength),
                    client_id: comfyService.clientId,
                },
            };
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.GENERATE}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.detail || 'Failed to start Dual LoRA workflow');

            const done = await pollPrompt(data.prompt_id, 'z-image-dual-lora');
            const beforeImage = selectBestImage(done.images, 'main_before_detail');
            const finalImage = selectBestImage(done.images, 'final_refined');
            if (beforeImage) { const url = comfyService.getImageUrl(beforeImage); setBaseImageUrl(url); setBeforeImageUrl(url); }
            if (!finalImage) throw new Error('No refined image returned');
            setFinalImageUrl(comfyService.getImageUrl(finalImage));

            const directBoxes = (done.detected_boxes || []).map((b) => ({ x1: Number(b[0]), y1: Number(b[1]), x2: Number(b[2]), y2: Number(b[3]) }));
            const rawBoxes = extractBoxesFromUnknown(done.raw_outputs || {});
            const seen = new Set<string>();
            const boxes = [...directBoxes, ...rawBoxes]
                .filter((box) => [box.x1, box.y1, box.x2, box.y2].every(Number.isFinite))
                .filter((box) => { const k = `${Math.round(box.x1)}:${Math.round(box.y1)}:${Math.round(box.x2)}:${Math.round(box.y2)}`; if (seen.has(k)) return false; seen.add(k); return true; });

            if (boxes.length) {
                setDetectedBoxes(boxes);
                setSelectedBoxIndex(choosePreferredBoxIndex(boxes, detectionPhrase));
                setBoxSource('detected');
                setNotice('');
                toast(`Done. Found ${boxes.length} candidate box(es).`, 'success');
            } else {
                setNotice('Done. Detection returned no preview boxes.');
                toast('Dual LoRA image finished.', 'success');
            }
        } catch (err: any) {
            toast(err.message || 'Dual LoRA workflow failed', 'error');
        } finally {
            setRunningWorkflow(false);
        }
    };

    const selectedLabel = useMemo(() => {
        if (!selectedBox) return 'No person selected';
        const source = boxSource === 'detected' ? 'Detected' : boxSource === 'manual' ? 'Manual' : 'Auto-marked';
        return `${source} person #${selectedBoxIndex + 1}`;
    }, [boxSource, selectedBox, selectedBoxIndex]);

    const loraOptions = availableLoras.length ? availableLoras : [loraMainName, loraDetailName].filter(Boolean);

    const outputPane = (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Image + box overlay */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-fedda-bg-0 p-3">
                {baseImageUrl ? (
                    <div className="flex items-start justify-center">
                        <div className="relative inline-block max-w-full">
                            <img
                                ref={imageRef}
                                src={baseImageUrl}
                                alt="Base"
                                className="max-h-[500px] rounded-xl border border-white/[0.06] object-contain"
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    setNaturalSize({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
                                }}
                            />
                            {manualMarkMode && (
                                <div
                                    className="absolute inset-0 cursor-crosshair"
                                    onMouseDown={(e) => { const p = eventToNaturalPoint(e); if (!p) return; setDragStart(p); setDragCurrent(p); }}
                                    onMouseMove={(e) => { if (!dragStart) return; const p = eventToNaturalPoint(e); if (p) setDragCurrent(p); }}
                                    onMouseUp={(e) => {
                                        if (!dragStart) return;
                                        const p = eventToNaturalPoint(e);
                                        setDragStart(null); setDragCurrent(null);
                                        if (!p) return;
                                        const box = { x1: Math.min(dragStart.x, p.x), y1: Math.min(dragStart.y, p.y), x2: Math.max(dragStart.x, p.x), y2: Math.max(dragStart.y, p.y) };
                                        const minSize = Math.max(naturalSize.w, naturalSize.h) * 0.03;
                                        if (box.x2 - box.x1 < minSize || box.y2 - box.y1 < minSize) { toast('Box too small.', 'error'); return; }
                                        setDetectedBoxes([box]); setSelectedBoxIndex(0); setBoxSource('manual'); setManualMarkMode(false); setNotice('Manual person box selected.');
                                    }}
                                />
                            )}
                            {detectedBoxes.map((box, index) => {
                                const active = index === selectedBoxIndex;
                                return (
                                    <button
                                        key={`${index}-${Math.round(box.x1)}-${Math.round(box.y1)}`}
                                        onClick={() => setSelectedBoxIndex(index)}
                                        className={`absolute rounded border-2 transition ${active ? 'border-fedda-accent bg-fedda-accent/15' : 'border-white/45 bg-white/5 hover:bg-white/10'}`}
                                        style={{ left: `${(box.x1 / naturalSize.w) * 100}%`, top: `${(box.y1 / naturalSize.h) * 100}%`, width: `${((box.x2 - box.x1) / naturalSize.w) * 100}%`, height: `${((box.y2 - box.y1) / naturalSize.h) * 100}%` }}
                                    />
                                );
                            })}
                            {draftBox && (
                                <div className="pointer-events-none absolute rounded border-2 border-fedda-accent bg-fedda-accent/10"
                                    style={{ left: `${(draftBox.x1 / naturalSize.w) * 100}%`, top: `${(draftBox.y1 / naturalSize.h) * 100}%`, width: `${((draftBox.x2 - draftBox.x1) / naturalSize.w) * 100}%`, height: `${((draftBox.y2 - draftBox.y1) / naturalSize.h) * 100}%` }}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-white/[0.06]">
                        <div className="text-center text-fedda-text-4">
                            <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                            <div className="text-sm font-semibold">No image yet</div>
                            <div className="mt-1 text-xs">Choose two LoRAs, then run once.</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar controls */}
            <div className="shrink-0 border-t border-white/[0.06] bg-fedda-bg-1 p-3 space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fedda-text-4">{selectedLabel}</div>

                <div className="grid grid-cols-2 gap-2">
                    {TARGET_CHOICES.map((choice) => (
                        <button
                            key={choice.side}
                            onClick={() => setDetectionTarget(targetPhraseForSide(choice.side))}
                            className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${selectedTargetSide === choice.side ? 'border-fedda-accent/30 bg-fedda-accent/10 text-fedda-accent' : 'border-white/[0.06] bg-fedda-bg-2 text-fedda-text-3 hover:text-fedda-text-1'}`}
                        >
                            <span>{choice.label}</span>
                            <span className="text-[9px] font-normal text-fedda-text-4">{choice.hint}</span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={applyFallbackBoxes} disabled={!baseImageUrl} className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-3 py-2 text-xs font-semibold text-fedda-text-2 hover:text-fedda-text-1 transition disabled:opacity-40">
                        Auto-Mark
                    </button>
                    <button
                        onClick={() => { if (!baseImageUrl) return; setManualMarkMode((v) => !v); setDragStart(null); setDragCurrent(null); setNotice(manualMarkMode ? '' : 'Manual mark active.'); }}
                        disabled={!baseImageUrl}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${manualMarkMode ? 'border-fedda-accent/30 bg-fedda-accent/10 text-fedda-accent' : 'border-white/[0.06] bg-fedda-bg-2 text-fedda-text-2 hover:text-fedda-text-1'}`}
                    >
                        Manual Box
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10px] text-fedda-text-4 bg-fedda-bg-2 rounded-xl px-3 py-2">
                    <div>Boxes: {detectedBoxes.length}</div>
                    <div>Source: {boxSource}</div>
                    <div>Chosen: {selectedBoxIndex >= 0 ? `#${selectedBoxIndex + 1}` : '-'}</div>
                </div>

                {notice && <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-2.5 text-xs text-fedda-text-3">{notice}</div>}

                {finalImageUrl && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fedda-text-4">Finished Image</div>
                        <img src={finalImageUrl} alt="Final" className="rounded-xl border border-white/[0.06]" />
                        <div className="flex gap-2">
                            <a href={finalImageUrl} target="_blank" rel="noreferrer" className="flex-1 text-center rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-3 py-2 text-xs font-semibold text-fedda-text-2 hover:text-fedda-text-1 transition">Open</a>
                            <a href={finalImageUrl} download className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-fedda-accent/10 px-3 py-2 text-xs font-semibold text-fedda-accent hover:bg-fedda-accent/20 transition">
                                <Download className="h-3.5 w-3.5" /> Save
                            </a>
                        </div>
                        {beforeImageUrl && (
                            <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2">
                                <div><div className="mb-1 text-[9px] uppercase tracking-wide text-fedda-text-4">Before</div><img src={beforeImageUrl} alt="Before" className="rounded-xl border border-white/[0.06]" /></div>
                                <div><div className="mb-1 text-[9px] uppercase tracking-wide text-fedda-text-4">After</div><img src={finalImageUrl} alt="After" className="rounded-xl border border-white/[0.06]" /></div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <WorkflowShell workflowId="z-image-dual-lora" output={outputPane} defaultOutputWidth={380}>
            <div className="overflow-y-auto h-full p-4 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                    <CircleDot className="h-4 w-4 text-fedda-accent" />
                    <div>
                        <div className="font-semibold text-fedda-text-1 text-sm">Z-Image Dual LoRA</div>
                        <div className="text-[10px] text-fedda-text-4">Two-person image — choose one person, refine with second LoRA</div>
                    </div>
                </div>

                {/* LoRA selectors */}
                <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fedda-text-4">LoRA Selection</div>
                        <div className="flex gap-2">
                            <button onClick={() => setSeedLocked(!seedLocked)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-2.5 py-1.5 text-[11px] text-fedda-text-2 hover:text-fedda-text-1 transition">
                                {seedLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                {seedLocked ? `${lockedSeed}` : 'Random'}
                            </button>
                            <button onClick={() => { setLockedSeed(randomSeed()); setSeedLocked(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-2.5 py-1.5 text-[11px] text-fedda-text-2 hover:text-fedda-text-1 transition">
                                <RefreshCw className="h-3 w-3" /> New Seed
                            </button>
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className={labelCls}>Person 1 LoRA</label>
                            <select value={loraMainName} onChange={(e) => setLoraMainName(e.target.value)} className={inputCls}>
                                <option value="">Select Person 1 LoRA</option>
                                {loraOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <input type="range" min={0.1} max={1.8} step={0.01} value={loraMainStrength} onChange={(e) => setLoraMainStrength(Number(e.target.value))} className="mt-2 w-full accent-fedda-accent" />
                            <div className="text-[10px] text-fedda-text-4 text-right">{Number(loraMainStrength).toFixed(2)}</div>
                        </div>
                        <div>
                            <label className={labelCls}>Person 2 LoRA</label>
                            <select value={loraDetailName} onChange={(e) => setLoraDetailName(e.target.value)} className={inputCls}>
                                <option value="">Select Person 2 LoRA</option>
                                {loraOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <input type="range" min={0.1} max={1.8} step={0.01} value={loraDetailStrength} onChange={(e) => setLoraDetailStrength(Number(e.target.value))} className="mt-2 w-full accent-fedda-accent" />
                            <div className="text-[10px] text-fedda-text-4 text-right">{Number(loraDetailStrength).toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* Character traits */}
                <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fedda-text-4">Character Traits</div>
                        <div className="flex gap-2">
                            <button onClick={randomizePromptParts} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-2.5 py-1.5 text-[11px] text-fedda-text-2 hover:text-fedda-text-1 transition">
                                <RefreshCw className="h-3 w-3" /> Randomize
                            </button>
                            <button onClick={composePrompts} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-2.5 py-1.5 text-[11px] text-fedda-text-2 hover:text-fedda-text-1 transition">
                                <Wand2 className="h-3 w-3" /> Build Prompts
                            </button>
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {[{ title: 'Person 1 (left)', value: personA, setValue: setPersonA }, { title: 'Person 2 (right)', value: personB, setValue: setPersonB }].map((person) => (
                            <div key={person.title} className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3">
                                <div className="mb-2 text-xs font-semibold text-fedda-text-2">{person.title}</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={person.value.gender || 'woman'} onChange={(e) => person.setValue({ ...person.value, gender: e.target.value })} className={inputCls}>
                                        {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <input value={person.value.archetype} onChange={(e) => person.setValue({ ...person.value, archetype: e.target.value })} className={inputCls} placeholder="archetype" />
                                    <input value={person.value.hair} onChange={(e) => person.setValue({ ...person.value, hair: e.target.value })} className={inputCls} placeholder="hair" />
                                    <input value={person.value.wardrobe} onChange={(e) => person.setValue({ ...person.value, wardrobe: e.target.value })} className={inputCls} placeholder="wardrobe" />
                                    <input value={person.value.face} onChange={(e) => person.setValue({ ...person.value, face: e.target.value })} className={inputCls} placeholder="face" />
                                    <input value={person.value.pose} onChange={(e) => person.setValue({ ...person.value, pose: e.target.value })} className={`${inputCls} col-span-2`} placeholder="pose" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div><label className={labelCls}>Scene</label><input value={scene} onChange={(e) => setScene(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Style</label><input value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls} /></div>
                    </div>
                </div>

                {/* Prompts */}
                <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-4 space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fedda-text-4">Prompts</div>
                    <div>
                        <label className={labelCls}>Full Scene Prompt</label>
                        <textarea value={mainPrompt} onChange={(e) => setMainPrompt(e.target.value)} rows={5} className={`${inputCls} resize-y`} placeholder="Prompt for the first image with both people..." />
                    </div>
                    <div>
                        <label className={labelCls}>Selected Person Prompt</label>
                        <textarea value={detailPrompt} onChange={(e) => setDetailPrompt(e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="Prompt used when refining the chosen person..." />
                    </div>
                    <div>
                        <label className={labelCls}>Negative</label>
                        <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                    </div>
                </div>

                {/* Generate */}
                <div className="flex gap-2">
                    <button
                        onClick={() => void runSingleWorkflow()}
                        disabled={!canRun || runningWorkflow}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-fedda-accent px-4 py-3 text-sm font-semibold text-white hover:bg-fedda-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {runningWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Create Dual LoRA Image
                    </button>
                    <button onClick={clearSelection} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-fedda-bg-1 px-3 py-3 text-xs font-semibold text-fedda-text-2 hover:text-fedda-text-1 transition">
                        <Eraser className="h-3.5 w-3.5" /> Clear
                    </button>
                </div>
            </div>
        </WorkflowShell>
    );
};
