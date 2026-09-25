// client/src/components/PageHeader.jsx
import { Search, Plus } from 'lucide-react';
import Button from './Button';

export default function PageHeader({
  title,
  subtitle,
  search,
  onSearchChange,
  onAdd,
  addLabel = 'Add new',
  actions,
}) {
  return (
    <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onSearchChange && (
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="focus-ring w-48 sm:w-64 rounded-full border border-border bg-surface2/60 pl-9 pr-4 py-2 text-sm placeholder:text-muted focus:bg-surface focus:border-brand-red/40"
            />
          </div>
        )}
        {actions}
        {onAdd && (
          <Button onClick={onAdd} icon={Plus}>
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
