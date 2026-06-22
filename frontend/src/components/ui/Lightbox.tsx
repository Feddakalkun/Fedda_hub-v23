import { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { triggerMediaDownload } from '../../utils/mediaStore';

interface LightboxProps {
  imageUrl: string;
  onClose: () => void;
  downloadName?: string;
}

export const Lightbox = ({ imageUrl, onClose, downloadName = 'fedda-image.png' }: LightboxProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt="Full size" className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl" />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <button
            onClick={() => triggerMediaDownload(imageUrl, downloadName)}
            className="h-8 w-8 rounded-lg bg-black/70 flex items-center justify-center text-white hover:bg-black/90 transition"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-black/70 flex items-center justify-center text-white hover:bg-black/90 transition"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
