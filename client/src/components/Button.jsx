// client/src/components/Button.jsx
const variants = {
  primary:
    'bg-brand-red text-white hover:bg-brand-redDark shadow-sm shadow-brand-red/20',
  secondary:
    'bg-surface2 text-ink hover:bg-border/60 border border-border',
  ghost: 'text-ink hover:bg-surface2',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-brand-green text-white hover:brightness-95',
};

const sizes = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  loading = false,
  ...props
}) {
  return (
    <button
      className={`focus-ring inline-flex items-center justify-center rounded-full font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        Icon && <Icon size={16} strokeWidth={2.25} />
      )}
      {children}
    </button>
  );
}
