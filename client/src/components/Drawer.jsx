// client/src/components/Drawer.jsx
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Drawer({ open, onClose, title, subtitle, children, footer, wide = false }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div
        className={`relative h-full w-full ${wide ? 'max-w-2xl' : 'max-w-md'} bg-surface border-l border-border shadow-floating flex flex-col animate-riseIn`}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-muted hover:bg-surface2 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
