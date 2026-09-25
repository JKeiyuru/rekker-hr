// client/src/pages/Leave.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import { Field, TextInput, Select, TextArea } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const leaveTypes = ['Annual', 'Sick', 'Maternity', 'Paternity', 'Compassionate', 'Absence', 'Unpaid', 'Study'];

const emptyForm = {
  employee: '',
  leaveType: 'Annual',
  startDate: '',
  endDate: '',
  reason: '',
  handoverPerson: '',
  handoverDepartment: '',
  handoverDuties: '',
  contactAddress: '',
};

export default function Leave() {
  const [tab, setTab] = useState('applications');
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();
  const { can, user } = useAuth();
  const isSelfService = !can('admin', 'hr');
  const canDecide = can('admin', 'hr', 'director', 'manager'); // Part C: Management
  const canRecommend = can('department_manager'); // Part B: Section Head

  useEffect(() => {
    if (isSelfService && user?.employee?._id) {
      setForm((f) => ({ ...f, employee: user.employee._id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/leave'), api.get('/leave/balances')])
      .then(([l, b]) => {
        setLeaves(l.data);
        setBalances(b.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleApply = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/leave', form);
      toast.success('Leave application submitted');
      setDrawerOpen(false);
      setForm((f) => ({ ...emptyForm, employee: isSelfService ? f.employee : '' }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit application');
    } finally {
      setSaving(false);
    }
  };

  const recommend = async (leave, decision) => {
    try {
      await api.put(`/leave/${leave._id}/section-head-review`, {
        decision,
        by: user?.employee?._id,
      });
      toast.success(decision === 'Recommended' ? 'Marked as recommended' : 'Marked as not recommended');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const decide = async (leave, decision) => {
    try {
      await api.put(`/leave/${leave._id}/decision`, {
        decision,
        approver: user?.employee?._id,
      });
      toast.success(`Leave ${decision.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const leaveColumns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.employee?.firstName} ${row.employee?.lastName}`} size="sm" />
          <p className="font-medium text-ink">
            {row.employee?.firstName} {row.employee?.lastName}
          </p>
        </div>
      ),
    },
    { key: 'leaveType', header: 'Type' },
    {
      key: 'dates',
      header: 'Dates',
      render: (row) => `${row.startDate.slice(0, 10)} → ${row.endDate.slice(0, 10)}`,
    },
    { key: 'days', header: 'Days' },
    {
      key: 'sectionHead',
      header: 'Section Head',
      render: (row) =>
        row.sectionHeadReview?.decision && row.sectionHeadReview.decision !== 'Pending' ? (
          <Badge tone={row.sectionHeadReview.decision === 'Recommended' ? 'green' : 'red'}>
            {row.sectionHeadReview.decision}
          </Badge>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (row.status !== 'Pending') return null;
        if (canDecide) {
          return (
            <div className="flex gap-1.5">
              <button
                onClick={() => decide(row, 'Approved')}
                className="focus-ring rounded-full p-1.5 bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                title="Approve (final)"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => decide(row, 'Rejected')}
                className="focus-ring rounded-full p-1.5 bg-brand-red/10 text-brand-red hover:bg-brand-red/20"
                title="Reject (final)"
              >
                <X size={14} />
              </button>
            </div>
          );
        }
        if (canRecommend && (row.sectionHeadReview?.decision || 'Pending') === 'Pending') {
          return (
            <div className="flex gap-1.5">
              <button
                onClick={() => recommend(row, 'Recommended')}
                className="focus-ring rounded-full p-1.5 bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                title="Recommend"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => recommend(row, 'Not Recommended')}
                className="focus-ring rounded-full p-1.5 bg-brand-red/10 text-brand-red hover:bg-brand-red/20"
                title="Not recommended"
              >
                <X size={14} />
              </button>
            </div>
          );
        }
        return null;
      },
    },
  ];

  const balanceColumns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.employee?.firstName} ${row.employee?.lastName}`} size="sm" />
          <p className="font-medium text-ink">
            {row.employee?.firstName} {row.employee?.lastName}
          </p>
        </div>
      ),
    },
    {
      key: 'annual',
      header: 'Annual',
      render: (row) => `${row.annualUsed} / ${row.annualEntitlement}`,
    },
    { key: 'sick', header: 'Sick', render: (row) => `${row.sickUsed} / ${row.sickEntitlement}` },
    {
      key: 'maternity',
      header: 'Maternity',
      render: (row) => `${row.maternityUsed} / ${row.maternityEntitlement}`,
    },
    {
      key: 'paternity',
      header: 'Paternity',
      render: (row) => `${row.paternityUsed} / ${row.paternityEntitlement}`,
    },
    { key: 'unpaid', header: 'Unpaid taken', render: (row) => row.unpaidUsed },
  ];

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle="Applications, section head recommendations, management decisions and balances"
        onAdd={() => setDrawerOpen(true)}
        addLabel="Apply for leave"
      />

      <div className="flex gap-1 mb-5 bg-surface2 p-1 rounded-full w-fit">
        {[
          { key: 'applications', label: 'Applications' },
          { key: 'balances', label: 'Balances' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-brand-red text-white' : 'text-ink/70 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'applications' ? (
        <DataTable
          columns={leaveColumns}
          rows={leaves}
          loading={loading}
          onRowClick={setViewing}
          emptyMessage="No leave applications yet"
        />
      ) : (
        <DataTable columns={balanceColumns} rows={balances} loading={loading} emptyMessage="No leave balances yet" />
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Apply for leave"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} loading={saving}>
              Submit application
            </Button>
          </div>
        }
      >
        <form onSubmit={handleApply}>
          <Field label="Employee" required>
            {isSelfService ? (
              <TextInput
                disabled
                value={
                  user?.employee
                    ? `${user.employee.firstName} ${user.employee.lastName} (you)`
                    : 'Not linked to an employee record'
                }
              />
            ) : (
              <Select required value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Leave type" required>
              <Select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                {leaveTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <div />
            <Field label="From" required>
              <TextInput
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="To" required>
              <TextInput
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Reason"
            hint={form.leaveType === 'Annual' ? 'Not required for annual leave' : 'Required'}
            required={form.leaveType !== 'Annual'}
          >
            <TextArea
              required={form.leaveType !== 'Annual'}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>

          <h4 className="text-sm font-semibold text-ink mt-2 mb-3 pb-2 border-b border-border">
            Duty handover / cover arrangement
          </h4>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Person taking over duties">
              <TextInput
                value={form.handoverPerson}
                onChange={(e) => setForm({ ...form, handoverPerson: e.target.value })}
              />
            </Field>
            <Field label="Their position / department">
              <TextInput
                value={form.handoverDepartment}
                onChange={(e) => setForm({ ...form, handoverDepartment: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Duties / responsibilities to be covered">
            <TextArea
              value={form.handoverDuties}
              onChange={(e) => setForm({ ...form, handoverDuties: e.target.value })}
            />
          </Field>
          <Field label="Contact address while on leave">
            <TextInput
              value={form.contactAddress}
              onChange={(e) => setForm({ ...form, contactAddress: e.target.value })}
            />
          </Field>
        </form>
      </Drawer>

      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Leave application"
        subtitle={viewing ? `${viewing.employee?.firstName} ${viewing.employee?.lastName} · ${viewing.leaveType}` : ''}
      >
        {viewing && (
          <div className="space-y-6">
            <div className="card divide-y divide-border">
              <DetailRow label="Dates" value={`${viewing.startDate.slice(0, 10)} → ${viewing.endDate.slice(0, 10)}`} />
              <DetailRow label="Duration" value={`${viewing.days} day(s)`} />
              <DetailRow label="Reason" value={viewing.reason} />
              <DetailRow
                label="Balance before"
                value={viewing.balanceBeforeDays != null ? `${viewing.balanceBeforeDays} days` : 'N/A for this type'}
              />
              <DetailRow
                label="Balance after"
                value={
                  viewing.status === 'Approved'
                    ? viewing.balanceAfterDays != null
                      ? `${viewing.balanceAfterDays} days`
                      : 'N/A for this type'
                    : 'Pending approval'
                }
              />
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Duty handover / cover arrangement
              </h4>
              <div className="card divide-y divide-border">
                <DetailRow label="Covering" value={viewing.handoverPerson} />
                <DetailRow label="Their dept/position" value={viewing.handoverDepartment} />
                <DetailRow label="Duties to cover" value={viewing.handoverDuties} />
                <DetailRow label="Contact while away" value={viewing.contactAddress} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Part B — Section Head
              </h4>
              <div className="card divide-y divide-border">
                <DetailRow
                  label="Recommendation"
                  value={
                    viewing.sectionHeadReview?.decision && viewing.sectionHeadReview.decision !== 'Pending' ? (
                      <Badge tone={viewing.sectionHeadReview.decision === 'Recommended' ? 'green' : 'red'}>
                        {viewing.sectionHeadReview.decision}
                      </Badge>
                    ) : (
                      'Not yet reviewed'
                    )
                  }
                />
                <DetailRow label="Comments" value={viewing.sectionHeadReview?.comments} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Part C — Management (final)
              </h4>
              <div className="card divide-y divide-border">
                <DetailRow label="Decision" value={<Badge>{viewing.status}</Badge>} />
                <DetailRow label="Notes" value={viewing.decisionNotes} />
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-medium text-right">{value || '—'}</span>
    </div>
  );
}
