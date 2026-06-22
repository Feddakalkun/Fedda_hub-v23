import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Brain,
    CheckCircle2,
    ClipboardList,
    Loader2,
    Paperclip,
    Play,
    Plus,
    RefreshCw,
    Send,
    ShieldCheck,
    Trash2,
    X,
} from 'lucide-react';
import { BACKEND_API } from '../config/api';
import { useToast } from '../components/ui/Toast';
import { comfyService } from '../services/comfyService';

type UIAgentWorkflow = {
    workflow_id: string;
    label: string;
    kind: string;
    tab: string;
    status: string;
    requires_image: boolean;
    accepted_params: string[];
    defaults: Record<string, unknown>;
    lora_prefixes: string[];
};

type UIAgentPlan = {
    intent: string;
    workflow_id: string;
    workflow_label: string;
    confidence: number;
    reason: string;
    character_prompt?: string;
    params: Record<string, unknown>;
    memory_used: string[];
    warnings: string[];
    requires_approval: boolean;
    created_at?: string;
};

type TranscriptTurn = {
    id: number;
    role: 'user' | 'assistant';
    text: string;
};

type WorkflowMemoryEntry = {
    id: string;
    kind?: string;
    title?: string;
    content?: string;
    created_at?: string;
};

type WorkflowModelStatus = {
    ready: boolean;
    missing_count: number;
    files?: Array<{
        filename?: string;
        exists?: boolean;
        status?: string;
        error?: string | null;
    }>;
};

type PreparedPlan = {
    ready: boolean;
    workflow_id: string;
    workflow_label: string;
    params: Record<string, unknown>;
    warnings: string[];
    blocked_reasons: string[];
    summary?: string;
};

type MemPalaceStatus = {
    mode?: string;
    upstream_available?: boolean;
};

type LoraParam = { name: string; strength: number };

const toInputValue = (value: unknown) => (value === undefined || value === null ? '' : String(value));
const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const planPill = (status: string) => {
    if (status === 'verified') return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100';
    if (status === 'parked')   return 'border-zinc-300/20 bg-zinc-500/10 text-zinc-200';
    return 'border-amber-300/25 bg-amber-400/10 text-amber-100';
};

const loraParamsFromPlan = (plan: UIAgentPlan | null): LoraParam[] => {
    const raw = plan?.params?.loras;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
            name: String(item.name ?? ''),
            strength: typeof item.strength === 'number' ? item.strength : parseNumber(String(item.strength ?? '1'), 1),
        }));
};

let transcriptId = 0;

const inputCls = 'h-10 w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 text-sm text-fedda-text-1 outline-none transition focus:border-white/20';
const textareaCls = 'w-full resize-none rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-sm leading-6 text-fedda-text-1 outline-none transition focus:border-white/20';

export const UIAgentPage = () => {
    const { toast } = useToast();
    const [workflows, setWorkflows]               = useState<UIAgentWorkflow[]>([]);
    const [workflowsLoading, setWorkflowsLoading] = useState(false);
    const [message, setMessage]                   = useState('');
    const [imageFilename, setImageFilename]       = useState('');
    const [isPlanning, setIsPlanning]             = useState(false);
    const [plan, setPlan]                         = useState<UIAgentPlan | null>(null);
    const [transcript, setTranscript]             = useState<TranscriptTurn[]>([]);
    const [memoryEntries, setMemoryEntries]       = useState<WorkflowMemoryEntry[]>([]);
    const [memoryLoading, setMemoryLoading]       = useState(false);
    const [modelStatus, setModelStatus]           = useState<WorkflowModelStatus | null>(null);
    const [modelStatusLoading, setModelStatusLoading] = useState(false);
    const [preparedPlan, setPreparedPlan]         = useState<PreparedPlan | null>(null);
    const [memPalaceStatus, setMemPalaceStatus]   = useState<MemPalaceStatus | null>(null);
    const [isPreparing, setIsPreparing]           = useState(false);
    const [isRunning, setIsRunning]               = useState(false);
    const [lastPromptId, setLastPromptId]         = useState('');

    const selectedWorkflow = useMemo(
        () => workflows.find((w) => w.workflow_id === plan?.workflow_id) ?? null,
        [plan?.workflow_id, workflows],
    );

    const loras = useMemo(() => loraParamsFromPlan(plan), [plan]);

    const updatePlan = (patch: Partial<UIAgentPlan>) => {
        setPreparedPlan(null);
        setPlan((current) => (current ? { ...current, ...patch } : current));
    };

    const updateParam = (key: string, value: unknown) => {
        setPreparedPlan(null);
        setPlan((current) => {
            if (!current) return current;
            return { ...current, params: { ...current.params, [key]: value } };
        });
    };

    const setLoras = (next: LoraParam[]) => updateParam('loras', next);

    const loadWorkflows = async () => {
        setWorkflowsLoading(true);
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.UI_AGENT_WORKFLOWS}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.detail || 'Could not load UI Agent workflows');
            setWorkflows(Array.isArray(data.workflows) ? data.workflows : []);
        } catch (error: unknown) {
            toast(error instanceof Error ? error.message : 'Could not load UI Agent workflows', 'error');
        } finally {
            setWorkflowsLoading(false);
        }
    };

    const loadMemPalaceStatus = async () => {
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.UI_AGENT_MEMPALACE_STATUS}`);
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.success) setMemPalaceStatus(data as MemPalaceStatus);
        } catch {
            setMemPalaceStatus(null);
        }
    };

    const loadMemory = async (workflowId: string) => {
        setMemoryLoading(true);
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.WORKFLOW_MEMORY}/${encodeURIComponent(workflowId)}?limit=8`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.detail || 'Could not load memory');
            setMemoryEntries(Array.isArray(data.entries) ? data.entries : []);
        } catch {
            setMemoryEntries([]);
        } finally {
            setMemoryLoading(false);
        }
    };

    const loadModelStatus = async (workflowId: string) => {
        setModelStatusLoading(true);
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.WORKFLOW_MODEL_STATUS}/${encodeURIComponent(workflowId)}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.detail || 'Could not load model status');
            setModelStatus(data as WorkflowModelStatus);
        } catch {
            setModelStatus(null);
        } finally {
            setModelStatusLoading(false);
        }
    };

    useEffect(() => {
        void loadWorkflows();
        void loadMemPalaceStatus();
    }, []);

    useEffect(() => {
        if (!plan?.workflow_id) {
            setMemoryEntries([]);
            setModelStatus(null);
            return;
        }
        void loadMemory(plan.workflow_id);
        void loadModelStatus(plan.workflow_id);
    }, [plan?.workflow_id]);

    const deleteMemory = async (entryId: string) => {
        if (!plan?.workflow_id) return;
        setMemoryEntries((current) => current.filter((e) => e.id !== entryId));
        try {
            const response = await fetch(
                `${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.WORKFLOW_MEMORY}/${encodeURIComponent(plan.workflow_id)}/${encodeURIComponent(entryId)}`,
                { method: 'DELETE' },
            );
            if (!response.ok) await loadMemory(plan.workflow_id);
        } catch {
            await loadMemory(plan.workflow_id);
        }
    };

    const submitPlan = async () => {
        const text = message.trim();
        if (!text || isPlanning) return;
        setTranscript((current) => [...current, { id: ++transcriptId, role: 'user', text }]);
        setMessage('');
        setIsPlanning(true);
        const attachments = imageFilename.trim() ? [{ kind: 'image', filename: imageFilename.trim() }] : [];
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.UI_AGENT_PLAN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, session_id: 'ui-agent', current_tab: plan?.workflow_id ?? '', attachments }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.detail || 'UI Agent planning failed');
            setPlan(data.plan as UIAgentPlan);
            setPreparedPlan(null);
            setTranscript((current) => [...current, { id: ++transcriptId, role: 'assistant', text: data.summary || 'Plan ready.' }]);
        } catch (error: unknown) {
            const errorText = error instanceof Error ? error.message : 'UI Agent planning failed';
            toast(errorText, 'error');
            setTranscript((current) => [...current, { id: ++transcriptId, role: 'assistant', text: errorText }]);
        } finally {
            setIsPlanning(false);
        }
    };

    const preparePlan = async () => {
        if (!plan || isPreparing) return null;
        setIsPreparing(true);
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.UI_AGENT_PREPARE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.detail || 'Plan validation failed');
            setPreparedPlan(data as PreparedPlan);
            const text = data.ready ? 'Payload validated. Ready to generate.' : data.summary || 'Plan needs attention.';
            setTranscript((current) => [...current, { id: ++transcriptId, role: 'assistant', text }]);
            if (!data.ready) toast(text, 'error');
            return data as PreparedPlan;
        } catch (error: unknown) {
            const errorText = error instanceof Error ? error.message : 'Plan validation failed';
            toast(errorText, 'error');
            setTranscript((current) => [...current, { id: ++transcriptId, role: 'assistant', text: errorText }]);
            return null;
        } finally {
            setIsPreparing(false);
        }
    };

    const runPlan = async () => {
        if (!plan || isRunning) return;
        let prepared = preparedPlan;
        if (!prepared?.ready) prepared = await preparePlan();
        if (!prepared?.ready) return;
        setIsRunning(true);
        setLastPromptId('');
        try {
            const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.UI_AGENT_RUN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, client_id: comfyService.clientId }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.detail || 'UI Agent run failed');
            setLastPromptId(String(data.prompt_id || ''));
            setTranscript((current) => [...current, {
                id: ++transcriptId,
                role: 'assistant',
                text: `Generation started${data.prompt_id ? `: ${data.prompt_id}` : '.'}`,
            }]);
            toast('Generation started', 'success');
            if (plan.workflow_id) void loadMemory(plan.workflow_id);
        } catch (error: unknown) {
            const errorText = error instanceof Error ? error.message : 'UI Agent run failed';
            toast(errorText, 'error');
            setTranscript((current) => [...current, { id: ++transcriptId, role: 'assistant', text: errorText }]);
        } finally {
            setIsRunning(false);
        }
    };

    const chooseWorkflow = (workflowId: string) => {
        const workflow = workflows.find((item) => item.workflow_id === workflowId);
        if (!workflow || !plan) return;
        setPlan({
            ...plan,
            workflow_id: workflow.workflow_id,
            workflow_label: workflow.label,
            params: {
                ...workflow.defaults,
                prompt: plan.params.prompt ?? workflow.defaults.prompt ?? '',
                negative: plan.params.negative ?? workflow.defaults.negative ?? '',
                loras: plan.params.loras ?? [],
            },
        });
    };

    const clearPlan = () => {
        setPlan(null);
        setMemoryEntries([]);
        setModelStatus(null);
        setPreparedPlan(null);
        setLastPromptId('');
    };

    const missingFiles = modelStatus?.files?.filter((f) => !f.exists) ?? [];

    return (
        <div className="flex h-full min-h-0 flex-col bg-fedda-bg-0">
            <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(400px,0.9fr)]">

                {/* ── Left: Chat transcript ── */}
                <section className="flex min-h-0 flex-col rounded-xl border border-white/[0.06] bg-fedda-bg-1">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-fedda-accent" />
                            <div>
                                <div className="text-sm font-semibold text-fedda-text-1">UI Agent</div>
                                <div className="text-[10px] uppercase tracking-[0.18em] text-fedda-text-4">Plan + Approve</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={clearPlan}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-fedda-bg-2 text-fedda-text-3 transition hover:border-white/15 hover:text-fedda-text-1"
                            title="Clear plan"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
                        {transcript.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-fedda-text-4">
                                Ready for a workflow request.
                            </div>
                        ) : (
                            transcript.map((turn) => (
                                <article
                                    key={turn.id}
                                    className={`max-w-[82%] rounded-xl border px-3 py-2 text-sm leading-6 ${
                                        turn.role === 'user'
                                            ? 'ml-auto border-fedda-accent/20 bg-fedda-accent/10 text-fedda-text-1'
                                            : 'border-white/[0.06] bg-fedda-bg-2 text-fedda-text-2'
                                    }`}
                                >
                                    {turn.text}
                                </article>
                            ))
                        )}
                    </div>
                </section>

                {/* ── Right: Plan + Context ── */}
                <section className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1.25fr)_minmax(220px,0.75fr)]">

                    {/* Plan panel */}
                    <div className="min-h-0 overflow-y-auto rounded-xl border border-white/[0.06] bg-fedda-bg-1">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-fedda-bg-1/95 px-4 py-3 backdrop-blur">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 text-fedda-accent/70" />
                                <span className="text-sm font-semibold text-fedda-text-1">Workflow Plan</span>
                            </div>
                            {plan && (
                                <div className="flex items-center gap-2">
                                    {preparedPlan?.ready && (
                                        <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                                            Validated
                                        </span>
                                    )}
                                    <span className="rounded-full border border-fedda-accent/25 bg-fedda-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-fedda-accent">
                                        Approval Required
                                    </span>
                                </div>
                            )}
                        </div>

                        {!plan ? (
                            <div className="flex h-64 items-center justify-center text-sm text-fedda-text-4">No active plan.</div>
                        ) : (
                            <div className="space-y-4 p-4">
                                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                    <label className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Workflow</span>
                                        <select
                                            value={plan.workflow_id}
                                            onChange={(e) => chooseWorkflow(e.target.value)}
                                            className="h-10 w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 text-sm text-fedda-text-1 outline-none transition focus:border-white/20"
                                        >
                                            {workflows.map((w) => (
                                                <option key={w.workflow_id} value={w.workflow_id}>{w.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="flex items-end">
                                        <span className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] ${planPill(selectedWorkflow?.status ?? 'lab')}`}>
                                            {selectedWorkflow?.status ?? 'lab'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <label className="space-y-1 md:col-span-2">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Reason</span>
                                        <input
                                            value={plan.reason}
                                            onChange={(e) => updatePlan({ reason: e.target.value })}
                                            className={inputCls}
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Confidence</span>
                                        <input
                                            type="number" min="0" max="1" step="0.01"
                                            value={toInputValue(plan.confidence)}
                                            onChange={(e) => updatePlan({ confidence: parseNumber(e.target.value, plan.confidence) })}
                                            className={inputCls}
                                        />
                                    </label>
                                </div>

                                <label className="block space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Prompt</span>
                                    <textarea
                                        value={toInputValue(plan.params.prompt)}
                                        onChange={(e) => updateParam('prompt', e.target.value)}
                                        rows={5}
                                        className={textareaCls}
                                    />
                                </label>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Character / Trigger</span>
                                        <textarea
                                            value={plan.character_prompt ?? ''}
                                            onChange={(e) => updatePlan({ character_prompt: e.target.value })}
                                            rows={3}
                                            className={textareaCls}
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Negative</span>
                                        <textarea
                                            value={toInputValue(plan.params.negative)}
                                            onChange={(e) => updateParam('negative', e.target.value)}
                                            rows={3}
                                            className={textareaCls}
                                        />
                                    </label>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    {['width', 'height', 'steps', 'cfg', 'seed'].map((key) => (
                                        <label key={key} className="space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">{key}</span>
                                            <input
                                                type="number"
                                                step={key === 'cfg' ? '0.1' : '1'}
                                                value={toInputValue(plan.params[key])}
                                                onChange={(e) => updateParam(key, parseNumber(e.target.value, Number(plan.params[key] ?? 0)))}
                                                className={inputCls}
                                            />
                                        </label>
                                    ))}
                                </div>

                                {Object.prototype.hasOwnProperty.call(plan.params, 'sampler_name') && (
                                    <label className="block space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Sampler</span>
                                        <input
                                            value={toInputValue(plan.params.sampler_name)}
                                            onChange={(e) => updateParam('sampler_name', e.target.value)}
                                            className={inputCls}
                                        />
                                    </label>
                                )}

                                {(selectedWorkflow?.requires_image || Object.prototype.hasOwnProperty.call(plan.params, 'image')) && (
                                    <label className="block space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Source Image</span>
                                        <input
                                            value={toInputValue(plan.params.image)}
                                            onChange={(e) => updateParam('image', e.target.value)}
                                            className={inputCls}
                                        />
                                    </label>
                                )}

                                {/* LoRAs */}
                                <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">LoRAs</span>
                                        <button
                                            type="button"
                                            onClick={() => setLoras([...loras, { name: '', strength: 1 }])}
                                            className="inline-flex h-7 items-center gap-1 rounded-xl border border-white/[0.06] bg-fedda-bg-1 px-2 text-[11px] text-fedda-text-3 transition hover:border-white/15 hover:text-fedda-text-1"
                                        >
                                            <Plus className="h-3 w-3" /> Add
                                        </button>
                                    </div>
                                    {loras.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-4 text-center text-xs text-fedda-text-4">No LoRA selected.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {loras.map((lora, index) => (
                                                <div key={`${lora.name}-${index}`} className="grid gap-2 md:grid-cols-[1fr_92px_34px]">
                                                    <input
                                                        value={lora.name}
                                                        onChange={(e) => {
                                                            const next = [...loras];
                                                            next[index] = { ...lora, name: e.target.value };
                                                            setLoras(next);
                                                        }}
                                                        className="h-9 min-w-0 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 text-xs text-fedda-text-1 outline-none transition focus:border-white/20"
                                                    />
                                                    <input
                                                        type="number" min="0" max="2" step="0.05"
                                                        value={toInputValue(lora.strength)}
                                                        onChange={(e) => {
                                                            const next = [...loras];
                                                            next[index] = { ...lora, strength: parseNumber(e.target.value, lora.strength) };
                                                            setLoras(next);
                                                        }}
                                                        className="h-9 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 text-xs text-fedda-text-1 outline-none transition focus:border-white/20"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setLoras(loras.filter((_, i) => i !== index))}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-fedda-bg-1 text-fedda-text-3 transition hover:border-red-300/30 hover:text-red-300"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {plan.warnings.length > 0 && (
                                    <div className="space-y-2">
                                        {plan.warnings.map((w) => (
                                            <div key={w} className="flex gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                <span>{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {preparedPlan?.blocked_reasons?.length ? (
                                    <div className="space-y-2">
                                        {preparedPlan.blocked_reasons.map((r) => (
                                            <div key={r} className="flex gap-2 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100">
                                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                <span>{r}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {lastPromptId && (
                                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                                        Prompt queued: {lastPromptId}
                                    </div>
                                )}

                                <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-3">
                                    <button
                                        type="button"
                                        onClick={() => void preparePlan()}
                                        disabled={isPreparing || isRunning}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-fedda-bg-2 px-3 text-sm font-semibold text-fedda-text-2 transition hover:border-white/15 hover:text-fedda-text-1 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                        Validate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void runPlan()}
                                        disabled={isPreparing || isRunning}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/15 px-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                        Approve & Generate
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Context panel */}
                    <div className="min-h-0 overflow-y-auto rounded-xl border border-white/[0.06] bg-fedda-bg-1">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-fedda-bg-1/95 px-4 py-3 backdrop-blur">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400/70" />
                                <span className="text-sm font-semibold text-fedda-text-1">Context</span>
                            </div>
                            {plan?.workflow_id && (
                                <button
                                    type="button"
                                    onClick={() => { void loadMemory(plan.workflow_id); void loadModelStatus(plan.workflow_id); }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-fedda-bg-2 text-fedda-text-3 transition hover:text-fedda-text-1"
                                >
                                    {memoryLoading || modelStatusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                </button>
                            )}
                        </div>

                        <div className="space-y-3 p-4">
                            <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3">
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Model Status</div>
                                {!plan ? (
                                    <div className="text-xs text-fedda-text-4">No workflow selected.</div>
                                ) : modelStatusLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-fedda-text-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking</div>
                                ) : !modelStatus ? (
                                    <div className="text-xs text-fedda-text-4">Status unavailable.</div>
                                ) : modelStatus.ready ? (
                                    <div className="text-xs text-emerald-400">Ready</div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="text-xs text-amber-300">{modelStatus.missing_count} missing file(s)</div>
                                        {missingFiles.slice(0, 4).map((f) => (
                                            <div key={`${f.filename}-${f.status}`} className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 px-2 py-1.5 text-[11px] text-fedda-text-3">
                                                {f.filename || 'Unknown file'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3">
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">MemPalace</div>
                                <div className="text-xs leading-5 text-fedda-text-3">
                                    {memPalaceStatus?.mode || 'fedda-local-palace'}
                                    {memPalaceStatus?.upstream_available ? ' + upstream available' : ''}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3">
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Memory Used</div>
                                {plan?.memory_used?.length ? (
                                    <div className="space-y-1.5">
                                        {plan.memory_used.map((item) => (
                                            <div key={item} className="rounded-xl border border-fedda-accent/10 bg-fedda-accent/5 px-2 py-1.5 text-xs leading-5 text-fedda-text-2">
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-fedda-text-4">None.</div>
                                )}
                            </div>

                            <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fedda-text-4">Workflow Memory</span>
                                    <span className="text-[11px] text-fedda-text-4">{memoryEntries.length}</span>
                                </div>
                                {memoryLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-fedda-text-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading</div>
                                ) : memoryEntries.length === 0 ? (
                                    <div className="text-xs text-fedda-text-4">No saved memory.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {memoryEntries.map((entry) => (
                                            <article key={entry.id} className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-xs font-semibold text-fedda-text-1">{entry.title || 'Workflow memory'}</div>
                                                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-fedda-text-3">
                                                            {entry.content || entry.kind || entry.created_at || 'Memory'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => void deleteMemory(entry.id)}
                                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-fedda-bg-2 text-fedda-text-3 transition hover:border-red-300/30 hover:text-red-300"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* ── Bottom bar: compose ── */}
            <form
                className="grid gap-2 border-t border-white/[0.06] bg-fedda-bg-1 p-3 md:grid-cols-[minmax(160px,240px)_1fr_auto]"
                onSubmit={(e) => { e.preventDefault(); void submitPlan(); }}
            >
                <label className="relative block">
                    <Paperclip className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fedda-text-4" />
                    <input
                        value={imageFilename}
                        onChange={(e) => setImageFilename(e.target.value)}
                        placeholder="Image filename"
                        className="h-11 w-full rounded-xl border border-white/10 bg-fedda-bg-2 pl-9 pr-3 text-sm text-fedda-text-1 outline-none transition placeholder:text-fedda-text-4 focus:border-white/20"
                    />
                </label>
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask FEDDA to plan a workflow"
                    className="h-11 min-w-0 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 text-sm text-fedda-text-1 outline-none transition placeholder:text-fedda-text-4 focus:border-white/20"
                />
                <button
                    type="submit"
                    disabled={!message.trim() || isPlanning || workflowsLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-fedda-accent/25 bg-fedda-accent/15 px-4 text-sm font-semibold text-fedda-accent transition hover:bg-fedda-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                    {isPlanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Plan
                </button>
            </form>
        </div>
    );
};
