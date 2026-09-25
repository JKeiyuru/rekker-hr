// client/src/components/ConfirmDialog.jsx
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, description, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onCancel} />
      <div className="relative w-full max-w-sm card p-6 animate-riseIn">
        <div className="h-10 w-10 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center mb-4">
          <AlertTriangle size={20} />
        </div>
        <h3 className="font-semibold text-ink">{title}</h3>
        {description && <p className="text-sm text-muted mt-1.5">{description}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
