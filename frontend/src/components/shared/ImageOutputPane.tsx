import { Download, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { triggerMediaDownload } from '../../utils/mediaStore';
import { cn } from '../../lib/styles';

interface ImageOutputPaneProps {
  currentImage: string | null;
  history: string[];
  isGenerating: boolean;
  previewUrl: string | null;
  onSelectImage: (url: string) => void;
  downloadName?: string;
}

export const ImageOutputPane = ({
  currentImage,
  history,
  isGenerating,
  previewUrl,
  onSelectImage,
  downloadName = 'fedda-output.png',
}: ImageOutputPaneProps) => {
  const display = currentImage || (isGenerating ? previewUrl : null);
  return (
    <div className="flex flex-col h-full">
      {/* Main image area */}
      <div className="flex-1 relative flex items-center justify-center bg-fedda-bg-0 overflow-hidden">
        {isGenerating && !display ? (
          <div className="flex flex-col items-center gap-3 text-fedda-text-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Generating…</span>
          </div>
        ) : display ? (
          <img src={display} alt="Output" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-fedda-text-4">
            <ImageIcon className="h-8 w-8 opacity-30" />
            <span className="text-xs">No output yet</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {currentImage && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/[0.06] flex-shrink-0">
          <span className="text-[10px] text-fedda-text-4 flex-1">{history.length} generated</span>
          <button
            type="button"
            onClick={() => window.open(currentImage, '_blank', 'noopener,noreferrer')}
            className="h-7 w-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-fedda-text-3 hover:text-fedda-text-1 transition"
            title="Open full size"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => triggerMediaDownload(currentImage, downloadName)}
            className="h-7 w-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-fedda-text-3 hover:text-fedda-text-1 transition"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* History strip */}
      {history.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 border-t border-white/[0.06] overflow-x-auto flex-shrink-0">
          {history.slice(0, 16).map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => onSelectImage(url)}
              className={cn(
                'h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition',
                url === currentImage ? 'border-fedda-accent/50' : 'border-white/10 hover:border-white/25',
              )}
            >
              <img src={url} alt={`Output ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
