// client/src/components/Avatar.jsx
const palette = [
  'bg-brand-red/15 text-brand-red',
  'bg-brand-green/15 text-brand-green',
  'bg-brand-yellow/20 text-yellow-700 dark:text-brand-yellow',
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-purple-500/15 text-purple-600 dark:text-purple-400',
];

function hashName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

export default function Avatar({ name = '?', size = 'md', src }) {
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-14 w-14 text-lg' };
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
  const tone = palette[hashName(name) % palette.length];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ring-1 ring-border`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} ${tone} flex items-center justify-center rounded-full font-semibold shrink-0`}
    >
      {initials || '?'}
    </div>
  );
}
