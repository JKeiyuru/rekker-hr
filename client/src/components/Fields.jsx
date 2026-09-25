// client/src/components/Fields.jsx
const base =
  'w-full rounded-xl border border-border bg-surface2/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus-ring focus:bg-surface focus:border-brand-red/40';

export function Field({ label, required, hint, children }) {
  return (
    <label className="block mb-4">
      {label && (
        <span className="block text-sm font-medium text-ink mb-1.5">
          {label} {required && <span className="text-brand-red">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput(props) {
  return <input className={base} {...props} />;
}

export function TextArea(props) {
  return <textarea rows={3} className={`${base} resize-none`} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={`${base} appearance-none bg-surface2/60`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer select-none py-1">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-brand-red focus:ring-brand-red/40 accent-current"
        {...props}
      />
      {label}
    </label>
  );
}
