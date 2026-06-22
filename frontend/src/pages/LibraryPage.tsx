import { useState } from 'react';
import { LoRADownloader } from '../components/LoRADownloader';
import { CoreModelsSection } from '../components/CoreModelsSection';

type Family = 'z-image' | 'flux2klein' | 'sd15' | 'sdxl' | 'wan';

const FAMILIES: { key: Family; label: string; desc: string }[] = [
    { key: 'z-image',    label: 'Z-Image',     desc: 'Turbo character LoRAs for Z-Image workflows' },
    { key: 'flux2klein', label: 'FLUX2-KLEIN',  desc: 'FLUX.2-klein specific LoRAs only' },
    { key: 'wan',        label: 'WAN',          desc: 'WAN video LoRA packs' },
    { key: 'sd15',       label: 'SD 1.5',       desc: 'Classic portrait and style LoRAs' },
    { key: 'sdxl',       label: 'SDXL',         desc: 'High-res XL character models' },
];

export const LibraryPage = () => {
    const [activeFamily, setActiveFamily] = useState<Family>('z-image');
    const active = FAMILIES.find((f) => f.key === activeFamily);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-fedda-bg-0">
            {/* Page header */}
            <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4 mb-1">
                    LoRA & Character
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-fedda-text-1">
                            Manage workflow character models
                        </h1>
                        <p className="mt-1 text-sm text-fedda-text-3">
                            Install packs, import local LoRAs and keep ComfyUI model lists in sync.
                        </p>
                    </div>
                    {active && <div className="text-xs text-fedda-text-3">{active.desc}</div>}
                </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
                {/* Core models — only shown on Z-Image tab */}
                {activeFamily === 'z-image' && <CoreModelsSection />}

                {/* Family tabs */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex flex-wrap gap-2">
                        {FAMILIES.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setActiveFamily(f.key)}
                                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                                    activeFamily === f.key
                                        ? 'border-fedda-accent/40 bg-fedda-accent/10 text-fedda-accent'
                                        : 'border-white/[0.08] bg-fedda-bg-1 text-fedda-text-3 hover:text-fedda-text-1'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <LoRADownloader family={activeFamily} />
            </div>
        </div>
    );
};
