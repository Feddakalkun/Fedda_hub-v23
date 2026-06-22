export function cn(...items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).join(' ');
}

export const inputBase = [
  'w-full rounded-xl border border-white/10 bg-fedda-bg-2',
  'px-3 py-2 text-sm text-fedda-text-1 outline-none transition',
  'placeholder:text-fedda-text-4',
  'focus:border-white/20 focus:ring-2 focus:ring-fedda-accent/10',
].join(' ');

export const labelBase = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-3';

export const panelBase = 'rounded-xl border border-white/[0.08] bg-fedda-bg-1 p-4';
