// client/src/pages/LeaveRecommendations.jsx
// For department heads / managers an admin has allowed to recommend leave.
// They mark each application "Recommended" or "Not Recommended" (advisory);
// HR, a director or the admin then makes the final decision on the Leave page.
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import { Field, TextArea } from '../components/Fields';
import { Spinner } from '../components/Feedback';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const FILTERS = [
  { key: 'Pending', label: 'Awaiting my recommendation' },
  { key: 'Recommended', label: 'Recommended' },
  { key: 'Not Recommended', label: 'Not recommended' },
  { key: 'All', label: 'All' },
];

const myRec = (l) => l.sectionHeadReview?.decision || 'Pending';

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-medium text-right">{value || '—'}</span>
    </div>
  );
}

export default function LeaveRecommendations() {
  const [data, setData] = useState({ departments: [], leaves: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Pending');
  const [target, setTarget] = useState(null); // { leave, decision } - the dialog
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = () => {
    api
      .get('/leave/to-recommend')
      .then((res) => setData(res.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load leave applications'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = (leave, decision) => {
    setTarget({ leave, decision });
    setComments(leave.sectionHeadReview?.decision === decision ? leave.sectionHeadReview.comments || '' : '');
  };

  const submit = async () => {
    const { leave, decision } = target;
    if (decision === 'Not Recommended' && !comments.trim()) {
      return toast.error('Please give a reason so the approver understands');
    }
    setSaving(true);
    try {
      await api.put(`/leave/${leave._id}/section-head-review`, { decision, comments });
      toast.success(decision === 'Recommended' ? 'Marked as recommended' : 'Marked as not recommended');
      setTarget(null);
      setViewing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your recommendation');
    } finally {
      setSaving(false);
    }
  };

  const count = (key) => (key === 'All' ? data.leaves.length : data.leaves.filter((l) => myRec(l) === key).length);
  const rows = filter === 'All' ? data.leaves : data.leaves.filter((l) => myRec(l) === filter);

  const actions = (row) =>
    row.status === 'Pending' ? (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="success" icon={Check} onClick={() => open(row, 'Recommended')}>
          Recommend
        </Button>
        <Button size="sm" variant="secondary" icon={X} onClick={() => open(row, 'Not Recommended')}>
          Not recommend
        </Button>
      </div>
    ) : null;

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.employee?.firstName} ${row.employee?.lastName}`} size="sm" />
          <div>
            <p className="font-medium text-ink">
              {row.employee?.firstName} {row.employee?.lastName}
            </p>
            <p className="text-xs text-muted">{row.employee?.department}</p>
          </div>
        </div>
      ),
    },
    { key: 'leaveType', header: 'Type' },
    { key: 'dates', header: 'Dates', render: (row) => `${row.startDate.slice(0, 10)} → ${row.endDate.slice(0, 10)}` },
    { key: 'days', header: 'Days' },
    {
      key: 'rec',
      header: 'My recommendation',
      render: (row) =>
        myRec(row) === 'Pending' ? <span className="text-xs text-muted">Not yet reviewed</span> : <Badge>{myRec(row)}</Badge>,
    },
    {
      key: 'status',
      header: 'Final decision',
      render: (row) => (row.status === 'Pending' ? <span className="text-xs text-muted">With management</span> : <Badge>{row.status}</Badge>),
    },
    { key: 'actions', header: '', render: actions },
  ];

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Recommend Leave"
        subtitle={`Leave applications for ${data.departments.join(', ') || 'your departments'}. Your recommendation is advisory — HR, a director or the admin makes the final decision.`}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key ? 'border-brand-red bg-brand-red/10 text-brand-red' : 'border-border text-ink/70 hover:text-ink'
            }`}
          >
            {f.label} · {count(f.key)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={setViewing}
        emptyMessage={filter === 'Pending' ? 'Nothing waiting for your recommendation' : 'No applications here'}
      />

      {/* Application detail */}
      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Leave application"
        subtitle={viewing ? `${viewing.employee?.firstName} ${viewing.employee?.lastName} · ${viewing.leaveType}` : ''}
        footer={viewing ? <div className="flex justify-end gap-2">{actions(viewing)}</div> : undefined}
      >
        {viewing && (
          <div className="space-y-6">
            <div className="card divide-y divide-border">
              <DetailRow label="Department" value={viewing.employee?.department} />
              <DetailRow label="Dates" value={`${viewing.startDate.slice(0, 10)} → ${viewing.endDate.slice(0, 10)}`} />
              <DetailRow label="Duration" value={`${viewing.days} day(s)`} />
              <DetailRow label="Reason" value={viewing.reason} />
              <DetailRow
                label="Balance before"
                value={viewing.balanceBeforeDays != null ? `${viewing.balanceBeforeDays} days` : 'N/A for this type'}
              />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Cover arrangement</h4>
              <div className="card divide-y divide-border">
                <DetailRow label="Covering" value={viewing.handoverPerson} />
                <DetailRow label="Their dept/position" value={viewing.handoverDepartment} />
                <DetailRow label="Duties to cover" value={viewing.handoverDuties} />
                <DetailRow label="Contact while away" value={viewing.contactAddress} />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Recommendation</h4>
              <div className="card divide-y divide-border">
                <DetailRow label="Status" value={myRec(viewing) === 'Pending' ? 'Not yet reviewed' : <Badge>{myRec(viewing)}</Badge>} />
                <DetailRow label="Reason / comments" value={viewing.sectionHeadReview?.comments} />
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Recommend / not recommend dialog */}
      {target && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setTarget(null)} />
          <div className="relative w-full max-w-md card p-6 animate-riseIn">
            <h3 className="font-semibold text-ink">
              {target.decision === 'Recommended' ? 'Recommend this leave?' : 'Not recommend this leave?'}
            </h3>
            <p className="text-sm text-muted mt-1.5 mb-4">
              {target.leave.employee?.firstName} {target.leave.employee?.lastName} · {target.leave.leaveType} ·{' '}
              {target.leave.days} day(s). This is advisory; management still makes the final decision.
            </p>
            <Field
              label={target.decision === 'Recommended' ? 'Comments (optional)' : 'Reason'}
              required={target.decision === 'Not Recommended'}
            >
              <TextArea autoFocus value={comments} onChange={(e) => setComments(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button
                variant={target.decision === 'Recommended' ? 'success' : 'danger'}
                onClick={submit}
                loading={saving}
              >
                {target.decision === 'Recommended' ? 'Recommend' : 'Not recommend'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
