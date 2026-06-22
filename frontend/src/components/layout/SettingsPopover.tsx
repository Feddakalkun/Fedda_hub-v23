import { useState, useEffect, useRef } from 'react';
import { Settings, X, Check } from 'lucide-react';

type SlotStatus = { configured: boolean; loading: boolean };

const TokenSlot = ({
    label,
    placeholder,
    status,
    onSave,
    saving,
}: {
    label: string;
    placeholder: string;
    status: SlotStatus;
    onSave: (v: string) => void;
    saving: boolean;
}) => {
    const [value, setValue] = useState('');
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-medium text-fedda-text-2">{label}</span>
                {status.configured && !status.loading && (
                    <Check className="h-3 w-3 text-emerald-400" />
                )}
            </div>
            <div className="flex gap-2">
                <input
                    type="password"
                    placeholder={status.configured ? '••••••••••• (saved)' : placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-fedda-bg-2 px-2.5 py-1.5 text-xs text-fedda-text-1 outline-none focus:border-white/20 placeholder:text-fedda-text-4"
                />
                <button
                    onClick={() => { onSave(value); setValue(''); }}
                    disabled={!value.trim() || saving}
                    className="rounded-lg bg-fedda-accent/20 px-2.5 py-1.5 text-xs font-semibold text-fedda-accent transition hover:bg-fedda-accent/30 disabled:opacity-40"
                >
                    {saving ? '…' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export const SettingsPopover = () => {
    const [open, setOpen] = useState(false);
    const [hf, setHf] = useState<SlotStatus>({ configured: false, loading: true });
    const [cv, setCv] = useState<SlotStatus>({ configured: false, loading: true });
    const [hfSaving, setHfSaving] = useState(false);
    const [cvSaving, setCvSaving] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const load = async () => {
            const [hfRes, cvRes] = await Promise.all([
                fetch('/api/settings/hf-token/status').then((r) => r.json()).catch(() => ({ configured: false })),
                fetch('/api/settings/civitai-key/status').then((r) => r.json()).catch(() => ({ configured: false })),
            ]);
            setHf({ configured: !!hfRes.configured, loading: false });
            setCv({ configured: !!cvRes.configured, loading: false });
        };
        load();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const saveHf = async (token: string) => {
        setHfSaving(true);
        const r = await fetch('/api/settings/hf-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        }).then((r) => r.json()).catch(() => ({}));
        setHf({ configured: !!r.configured, loading: false });
        setHfSaving(false);
    };

    const saveCv = async (api_key: string) => {
        setCvSaving(true);
        const r = await fetch('/api/settings/civitai-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key }),
        }).then((r) => r.json()).catch(() => ({}));
        setCv({ configured: !!r.configured, loading: false });
        setCvSaving(false);
    };

    const allOk = hf.configured && cv.configured;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                title="API Tokens"
                className={`relative inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                    open ? 'bg-white/[0.08] text-fedda-text-1' : 'text-fedda-text-4 hover:text-fedda-text-2 hover:bg-white/[0.05]'
                }`}
            >
                <Settings className="h-3.5 w-3.5" />
                {!hf.loading && !cv.loading && !allOk && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" />
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/[0.10] bg-fedda-bg-1 p-4 shadow-2xl z-50">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-fedda-text-1">API Tokens</span>
                        <button
                            onClick={() => setOpen(false)}
                            className="text-fedda-text-4 hover:text-fedda-text-2 transition"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <TokenSlot
                            label="Hugging Face Token"
                            placeholder="hf_…"
                            status={hf}
                            onSave={saveHf}
                            saving={hfSaving}
                        />
                        <TokenSlot
                            label="Civitai API Key"
                            placeholder="key…"
                            status={cv}
                            onSave={saveCv}
                            saving={cvSaving}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
