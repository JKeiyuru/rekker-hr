// client/src/components/ProfileProgress.jsx
// Progress bar for the self-service profile. `completion` comes from the API
// ({ percent, done, total, complete, missing: [{ key, label, section }] }).
import { CheckCircle2 } from 'lucide-react';

export default function ProfileProgress({ completion, showMissing = true }) {
  if (!completion) return null;
  const { percent, done, total, complete, missing } = completion;
  const sections = [...new Set(missing.map((m) => m.section))];

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <p className="text-sm font-medium text-ink flex items-center gap-1.5">
          {complete ? (
            <>
              <CheckCircle2 size={16} className="text-brand-green" /> Profile complete
            </>
          ) : (
            `${total - done} item${total - done === 1 ? '' : 's'} left to complete`
          )}
        </p>
        <p className={`text-sm font-semibold tabular-nums ${complete ? 'text-brand-green' : 'text-brand-red'}`}>{percent}%</p>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface2"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${complete ? 'bg-brand-green' : 'bg-brand-red'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showMissing && !complete && (
        <p className="text-xs text-muted mt-2.5">
          Still needed: {sections.map((s) => `${s} (${missing.filter((m) => m.section === s).length})`).join(' · ')}
        </p>
      )}
    </div>
  );
}
