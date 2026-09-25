// client/src/pages/Performance.jsx
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
import { Plus, Trash2, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = {
  employee: '',
  period: new Date().toISOString().slice(0, 7),
  reviewType: 'Monthly',
  goals: [],
  managerRating: '',
  attendancePercent: '',
  strengths: '',
  areasForImprovement: '',
  improvementPlan: '',
  recognition: '',
  status: 'Draft',
};

export default function Performance() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    api
      .get('/performance')
      .then((res) => setReviews(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addGoal = () =>
    setForm({ ...form, goals: [...form.goals, { title: '', target: '', actual: '', unit: 'KES', weight: 100 }] });

  const updateGoal = (i, key, value) => {
    const goals = [...form.goals];
    goals[i] = { ...goals[i], [key]: ['target', 'actual', 'weight'].includes(key) ? Number(value) : value };
    setForm({ ...form, goals });
  };

  const removeGoal = (i) => setForm({ ...form, goals: form.goals.filter((_, idx) => idx !== i) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/performance', {
        ...form,
        managerRating: form.managerRating ? Number(form.managerRating) : undefined,
        attendancePercent: form.attendancePercent ? Number(form.attendancePercent) : undefined,
      });
      toast.success('Performance review created');
      setDrawerOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save review');
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-xs text-muted">{row.employee?.role}</p>
          </div>
        </div>
      ),
    },
    { key: 'period', header: 'Period' },
    { key: 'achievementPercent', header: 'Achievement', render: (row) => `${row.achievementPercent || 0}%` },
    { key: 'attendancePercent', header: 'Attendance', render: (row) => `${row.attendancePercent || 0}%` },
    {
      key: 'managerRating',
      header: 'Rating',
      render: (row) =>
        row.managerRating ? (
          <span className="flex items-center gap-1 text-brand-yellow font-medium">
            <Star size={13} fill="currentColor" /> {row.managerRating}/5
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle="KPIs, reviews, goals and recognition"
        onAdd={can('admin', 'hr', 'director', 'manager', 'department_manager') ? () => setDrawerOpen(true) : undefined}
        addLabel="New review"
      />

      <DataTable columns={columns} rows={reviews} loading={loading} emptyMessage="No performance reviews yet" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New performance review"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save review
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Employee" required>
              <Select required value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Period" required>
              <TextInput
                type="month"
                required
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </Field>
            <Field label="Review type">
              <Select value={form.reviewType} onChange={(e) => setForm({ ...form, reviewType: e.target.value })}>
                {['Monthly', 'Quarterly', 'Annual'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Attendance %">
              <TextInput
                type="number"
                min="0"
                max="100"
                value={form.attendancePercent}
                onChange={(e) => setForm({ ...form, attendancePercent: e.target.value })}
              />
            </Field>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink">KPIs / goals</span>
              <button
                type="button"
                onClick={addGoal}
                className="focus-ring flex items-center gap-1 text-xs font-medium text-brand-red hover:text-brand-redDark"
              >
                <Plus size={13} /> Add goal
              </button>
            </div>
            {form.goals.length === 0 ? (
              <p className="text-xs text-muted">e.g. Monthly sales target: KES 500,000</p>
            ) : (
              <div className="space-y-2">
                {form.goals.map((g, i) => (
                  <div key={i} className="card p-3 grid grid-cols-12 gap-2 items-center">
                    <TextInput
                      placeholder="Goal title"
                      value={g.title}
                      onChange={(e) => updateGoal(i, 'title', e.target.value)}
                      className="col-span-5"
                    />
                    <TextInput
                      type="number"
                      placeholder="Target"
                      value={g.target}
                      onChange={(e) => updateGoal(i, 'target', e.target.value)}
                      className="col-span-3"
                    />
                    <TextInput
                      type="number"
                      placeholder="Actual"
                      value={g.actual}
                      onChange={(e) => updateGoal(i, 'actual', e.target.value)}
                      className="col-span-3"
                    />
                    <button
                      type="button"
                      onClick={() => removeGoal(i)}
                      className="focus-ring col-span-1 text-muted hover:text-brand-red p-1.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Manager rating (1–5)">
            <TextInput
              type="number"
              min="1"
              max="5"
              value={form.managerRating}
              onChange={(e) => setForm({ ...form, managerRating: e.target.value })}
            />
          </Field>
          <Field label="Strengths">
            <TextArea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
          </Field>
          <Field label="Areas for improvement">
            <TextArea
              value={form.areasForImprovement}
              onChange={(e) => setForm({ ...form, areasForImprovement: e.target.value })}
            />
          </Field>
          <Field label="Improvement plan">
            <TextArea
              value={form.improvementPlan}
              onChange={(e) => setForm({ ...form, improvementPlan: e.target.value })}
            />
          </Field>
          <Field label="Recognition / commendation">
            <TextArea value={form.recognition} onChange={(e) => setForm({ ...form, recognition: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['Draft', 'Submitted', 'Acknowledged', 'Finalized'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
