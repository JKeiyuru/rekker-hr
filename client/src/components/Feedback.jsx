// client/src/components/Feedback.jsx
import { Inbox } from 'lucide-react';

export function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <span className="h-8 w-8 rounded-full border-2 border-brand-red border-t-transparent animate-spin" />
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fadeIn">
      <div className="h-12 w-12 rounded-2xl bg-surface2 flex items-center justify-center text-muted mb-4">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
