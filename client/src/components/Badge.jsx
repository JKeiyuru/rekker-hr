// client/src/components/Badge.jsx
// Maps common status strings to semantic Rekker-brand colors.
const toneMap = {
  // green - good/positive
  Active: 'green',
  Present: 'green',
  Approved: 'green',
  Completed: 'green',
  Hired: 'green',
  Paid: 'green',
  Permanent: 'green',
  Returned: 'green',
  Passed: 'green',
  Open: 'green',
  // yellow - attention/in-progress
  'On Leave': 'yellow',
  Pending: 'yellow',
  Late: 'yellow',
  Probation: 'yellow',
  Draft: 'yellow',
  'In Progress': 'yellow',
  'Under Review': 'yellow',
  Shortlisted: 'yellow',
  Interviewing: 'yellow',
  Offer: 'yellow',
  Submitted: 'yellow',
  'Half Day': 'yellow',
  // red - negative/urgent
  Suspended: 'red',
  Exited: 'red',
  Rejected: 'red',
  Absent: 'red',
  Terminated: 'red',
  Lost: 'red',
  Damaged: 'red',
  Failed: 'red',
  Expired: 'red',
  Closed: 'red',
  // neutral
  Cancelled: 'neutral',
  'N/A': 'neutral',
};

const toneStyles = {
  green: 'bg-brand-green/10 text-brand-green ring-1 ring-inset ring-brand-green/20',
  yellow: 'bg-brand-yellow/15 text-yellow-700 dark:text-brand-yellow ring-1 ring-inset ring-brand-yellow/25',
  red: 'bg-brand-red/10 text-brand-red ring-1 ring-inset ring-brand-red/20',
  neutral: 'bg-surface2 text-muted ring-1 ring-inset ring-border',
};

export default function Badge({ children, tone }) {
  const resolvedTone = tone || toneMap[children] || 'neutral';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${toneStyles[resolvedTone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
