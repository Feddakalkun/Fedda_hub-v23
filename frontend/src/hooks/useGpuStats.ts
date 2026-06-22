import { useState, useEffect } from 'react';

export type GpuStats = {
    name: string;
    shortName: string;
    utilization: number;
    temperature: number;
    memUsed: number;
    memTotal: number;
    memPct: number;
};

const shorten = (name: string) =>
    name.replace(/NVIDIA\s+/i, '').replace(/GeForce\s+/i, '').trim();

export const useGpuStats = (intervalMs = 5000) => {
    const [stats, setStats] = useState<GpuStats | null>(null);

    useEffect(() => {
        const fetch_ = async () => {
            try {
                const r = await fetch('/api/hardware/stats').catch(() => null);
                if (!r?.ok) return;
                const data = await r.json();
                if (data.status !== 'ok' || !data.gpu) return;
                const g = data.gpu;
                setStats({
                    name: g.name,
                    shortName: shorten(g.name),
                    utilization: g.utilization,
                    temperature: g.temperature,
                    memUsed: g.memory.used,
                    memTotal: g.memory.total,
                    memPct: g.memory.percentage,
                });
            } catch { /* backend offline — stay null */ }
        };
        fetch_();
        const id = setInterval(fetch_, intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

    return stats;
};
