import { useEffect } from 'react';
import type { TranslationKey } from '../../i18n/LanguageContext';
import type { BuffingImage } from './buffingApi';

type GalleryState = { images: BuffingImage[]; index: number };

type BuffingImageGalleryProps = {
  gallery: GalleryState;
  translate: (key: TranslationKey) => string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/** Render a keyboard-accessible gallery for images attached to a checklist. */
export function BuffingImageGallery({
  gallery,
  translate,
  onClose,
  onIndexChange,
}: BuffingImageGalleryProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onIndexChange(Math.max(0, gallery.index - 1));
      if (event.key === 'ArrowRight')
        onIndexChange(Math.min(gallery.images.length - 1, gallery.index + 1));
      if (event.key === 'Home') onIndexChange(0);
      if (event.key === 'End') onIndexChange(gallery.images.length - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gallery.index, gallery.images.length, onClose, onIndexChange]);

  const image = gallery.images[gallery.index];
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={translate('buffingImages')}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={translate('closeGallery')}
          className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center bg-industrial text-lg text-white shadow-lg"
          onClick={onClose}
        >
          ×
        </button>
        <img
          src={image.url}
          alt={`${translate('buffingImages')} ${gallery.index + 1}`}
          className="block w-[min(92vw,1440px)] max-h-[calc(100vh-7rem)] aspect-[4/3] object-contain shadow-2xl"
        />
        <div className="flex w-full items-center justify-between gap-3 text-white">
          <button
            type="button"
            aria-label={translate('previousImage')}
            className="h-9 w-12 border border-white/60 bg-industrial/90 text-xl disabled:opacity-40"
            disabled={gallery.index === 0}
            onClick={() => onIndexChange(Math.max(0, gallery.index - 1))}
          >
            ‹
          </button>
          <span className="text-xs font-bold">
            {gallery.index + 1} / {gallery.images.length}
          </span>
          <button
            type="button"
            aria-label={translate('nextImage')}
            className="h-9 w-12 border border-white/60 bg-industrial/90 text-xl disabled:opacity-40"
            disabled={gallery.index === gallery.images.length - 1}
            onClick={() => onIndexChange(Math.min(gallery.images.length - 1, gallery.index + 1))}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
