import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Images, RefreshCw, Video } from 'lucide-react';
import { loadStoredMedia, triggerMediaDownload, type MediaItem } from '../utils/mediaStore';
import { cn } from '../lib/styles';

type Filter = 'all' | 'image' | 'video';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
];

export const GalleryPage = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const refresh = () => setItems(loadStoredMedia());

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 2500);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('fedda:gallery-updated', refresh as EventListener);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('fedda:gallery-updated', refresh as EventListener);
    };
  }, []);

  const counts = useMemo(() => ({
    all: items.length,
    image: items.filter((i) => i.kind === 'image').length,
    video: items.filter((i) => i.kind === 'video').length,
  }), [items]);

  const visible = useMemo(
    () => items.filter((i) => filter === 'all' || i.kind === filter),
    [items, filter],
  );

  return (
    <div className="h-full overflow-y-auto bg-fedda-bg-0 px-6 py-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fedda-text-4">Unified Gallery</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-fedda-text-1">Images and videos</h1>
            <p className="mt-1 text-xs text-fedda-text-3">All outputs captured from FEDDA workflows, newest first.</p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-fedda-text-3 hover:text-fedda-text-1 transition self-start md:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-xl border px-4 py-1.5 text-xs font-semibold transition',
                filter === f.id
                  ? 'border-fedda-accent/50 bg-fedda-accent/10 text-fedda-accent'
                  : 'border-white/10 bg-white/[0.03] text-fedda-text-3 hover:text-fedda-text-1',
              )}
            >
              {f.label} <span className="opacity-50">{counts[f.id]}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="flex h-[58vh] items-center justify-center rounded-xl border border-white/[0.06] bg-fedda-bg-1 text-fedda-text-4 text-sm">
            No outputs yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((item, idx) => (
              <article key={`${item.url}-${idx}`} className="overflow-hidden rounded-xl border border-white/[0.06] bg-fedda-bg-1">
                <div className={item.kind === 'video' ? 'aspect-video bg-black' : 'aspect-square bg-black'}>
                  {item.kind === 'video' ? (
                    <video src={item.url} className="h-full w-full object-cover" controls playsInline />
                  ) : (
                    <img src={item.url} alt={`gallery-${idx}`} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-fedda-text-4">
                    {item.kind === 'video' ? <Video className="h-3 w-3" /> : <Images className="h-3 w-3" />}
                    <span className="truncate">{item.source}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 px-2 py-1.5 text-[11px] text-fedda-text-2 hover:bg-white/[0.05] transition"
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </button>
                    <button
                      onClick={() => triggerMediaDownload(item.url, `fedda-${item.kind}-${idx + 1}.${item.kind === 'video' ? 'mp4' : 'png'}`)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-fedda-accent/30 bg-fedda-accent/10 px-2 py-1.5 text-[11px] text-fedda-accent hover:bg-fedda-accent/20 transition"
                    >
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
