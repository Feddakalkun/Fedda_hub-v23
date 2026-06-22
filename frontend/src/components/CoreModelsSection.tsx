import { useEffect, useState, useCallback } from 'react';
import { Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type FileState = {
    filename: string;
    status: 'idle' | 'downloading' | 'completed' | 'error' | 'unknown';
    progress: number;
    exists: boolean;
    error?: string | null;
};

type EnsureResult = {
    success: boolean;
    ready: boolean;
    files: FileState[];
};

const LABELS: Record<string, { label: string; size: string; desc: string }> = {
    'z_image_turbo_bf16.safetensors': {
        label: 'Z-Image Turbo BF16',
        size: '11.7 GB',
        desc: 'Main diffusion model — required for all Z-Image workflows',
    },
    'qwen_3_4b.safetensors': {
        label: 'Qwen 3 4B (text encoder)',
        size: '7.7 GB',
        desc: 'Prompt encoder — required for Z-Image prompt understanding',
    },
};

const fetchStatus = async (): Promise<EnsureResult | null> => {
    try {
        const r = await fetch('/api/models/status-check', {
            method: 'GET',
        }).catch(() => null);
        if (r?.ok) return r.json();
    } catch { /* fall through */ }
    return null;
};

const pollStatus = async (): Promise<EnsureResult | null> => {
    try {
        const r = await fetch('/api/models/zimage-core/ensure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        if (!r.ok) return null;
        return r.json();
    } catch {
        return null;
    }
};

const getIndividualStatus = async (filename: string) => {
    try {
        const r = await fetch(`/api/models/status/${encodeURIComponent(filename)}`);
        if (!r.ok) return null;
        return r.json() as Promise<{ status: string; progress: number; error?: string }>;
    } catch {
        return null;
    }
};

export const CoreModelsSection = () => {
    const [files, setFiles] = useState<FileState[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggeredFiles, setTriggeredFiles] = useState<Set<string>>(new Set());

    const refreshStatus = useCallback(async () => {
        const statuses = await Promise.all(
            Object.keys(LABELS).map(async (filename) => {
                const s = await getIndividualStatus(filename);
                return {
                    filename,
                    status: (s?.status ?? 'idle') as FileState['status'],
                    progress: s?.progress ?? 0,
                    exists: s?.status === 'completed',
                    error: s?.error ?? null,
                };
            })
        );
        setFiles(statuses);
        setLoading(false);
    }, []);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Poll every 2s while any file is downloading
    useEffect(() => {
        const anyDownloading = files.some((f) => f.status === 'downloading');
        if (!anyDownloading) return;
        const id = setInterval(refreshStatus, 2000);
        return () => clearInterval(id);
    }, [files, refreshStatus]);

    const triggerDownload = async (filename: string) => {
        setTriggeredFiles((prev) => new Set([...prev, filename]));
        await pollStatus();
        await refreshStatus();
    };

    if (loading) {
        return (
            <div className="px-6 py-4 border-b border-white/[0.06]">
                <div className="h-4 w-40 rounded bg-white/[0.06] animate-pulse mb-3" />
                <div className="flex flex-col gap-2">
                    {Object.keys(LABELS).map((k) => (
                        <div key={k} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const allReady = files.length > 0 && files.every((f) => f.status === 'completed' && f.exists);

    return (
        <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-0.5">
                        Core Models
                    </div>
                    <p className="text-xs text-fedda-text-3">
                        Required base models — downloaded once, used by all Z-Image workflows
                    </p>
                </div>
                {allReady && <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
            </div>

            <div className="flex flex-col gap-2">
                {files.map((f) => {
                    const meta = LABELS[f.filename];
                    const isDownloading = f.status === 'downloading';
                    const isReady = f.status === 'completed' && f.exists;
                    const isError = f.status === 'error';
                    const isPending = triggeredFiles.has(f.filename) && f.status === 'idle';

                    return (
                        <div
                            key={f.filename}
                            className="rounded-xl border border-white/[0.08] bg-fedda-bg-1 p-3"
                        >
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-semibold text-fedda-text-1">
                                            {meta?.label ?? f.filename}
                                        </span>
                                        <span className="text-[10px] text-fedda-text-4">{meta?.size}</span>
                                    </div>
                                    <p className="text-[11px] text-fedda-text-3 mt-0.5">{meta?.desc}</p>
                                </div>

                                <div className="flex-shrink-0 pt-0.5">
                                    {isReady && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                                    {isError && <AlertCircle className="h-4 w-4 text-red-400" />}
                                    {(isDownloading || isPending) && (
                                        <Loader2 className="h-4 w-4 text-fedda-accent animate-spin" />
                                    )}
                                    {!isReady && !isDownloading && !isError && !isPending && (
                                        <button
                                            onClick={() => triggerDownload(f.filename)}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-fedda-accent/20 px-2.5 py-1 text-[11px] font-semibold text-fedda-accent transition hover:bg-fedda-accent/30"
                                        >
                                            <Download className="h-3 w-3" />
                                            Download
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isDownloading && (
                                <div className="mt-2.5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-fedda-text-3">Downloading…</span>
                                        <span className="text-[10px] font-mono text-fedda-accent">
                                            {f.progress}%
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-fedda-accent transition-all duration-500"
                                            style={{ width: `${Math.max(2, f.progress)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {isError && f.error && (
                                <p className="mt-1.5 text-[11px] text-red-400">{f.error}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
