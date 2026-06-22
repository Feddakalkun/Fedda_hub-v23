import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  tab: string;
  label?: string;
}

export const PlaceholderPage = ({ tab, label }: PlaceholderPageProps) => (
  <div className="flex h-full items-center justify-center">
    <div className="text-center space-y-3 px-6">
      <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto">
        <Construction className="h-5 w-5 text-fedda-text-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-fedda-text-2">{label ?? tab}</p>
        <p className="text-xs text-fedda-text-4">Being ported to v23 — check back soon.</p>
      </div>
    </div>
  </div>
);
