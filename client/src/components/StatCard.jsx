// client/src/components/StatCard.jsx
export default function StatCard({ label, value, icon: Icon, tone = 'neutral', hint }) {
  const toneStyles = {
    red: 'bg-brand-red/10 text-brand-red',
    green: 'bg-brand-green/10 text-brand-green',
    yellow: 'bg-brand-yellow/15 text-yellow-700 dark:text-brand-yellow',
    neutral: 'bg-surface2 text-ink',
  };

  return (
    <div className="card p-5 flex items-start justify-between animate-riseIn">
      <div className="min-w-0">
        <p className="text-sm text-muted font-medium truncate">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {Icon && (
        <span className={`shrink-0 rounded-xl p-2.5 ${toneStyles[tone]}`}>
          <Icon size={20} strokeWidth={2} />
        </span>
      )}
    </div>
  );
}
