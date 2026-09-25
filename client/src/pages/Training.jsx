// client/src/pages/Training.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { Field, TextInput, Select, TextArea, Checkbox } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const emptyForm = {
  title: '',
  provider: '',
  skillsCovered: '',
  startDate: '',
  endDate: '',
  cost: '',
  status: 'Planned',
  notes: '',
  attendeeIds: [],
};

export default function Training() {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();
  const { can } = useAuth();
  const canManage = can('admin', 'hr', 'director', 'manager', 'department_manager');

  const load = () => {
    setLoading(true);
    api
      .get('/training')
      .then((res) => setTrainings(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleAttendee = (id) => {
    setForm((f) => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id) ? f.attendeeIds.filter((a) => a !== id) : [...f.attendeeIds, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/training', {
        ...form,
        cost: Number(form.cost) || 0,
        skillsCovered: form.skillsCovered
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        attendees: form.attendeeIds.map((employee) => ({ employee })),
      });
      toast.success('Training program created');
      setDrawerOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'title', header: 'Program' },
    { key: 'provider', header: 'Provider' },
    {
      key: 'skillsCovered',
      header: 'Skills',
      render: (row) => (row.skillsCovered || []).join(', ') || '—',
    },
    {
      key: 'attendees',
      header: 'Attendees',
      render: (row) =>
        (row.attendees || [])
          .map((a) => (a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : null))
          .filter(Boolean)
          .join(', ') || '—',
    },
    { key: 'cost', header: 'Cost', render: (row) => `KES ${Number(row.cost || 0).toLocaleString()}` },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Training"
        subtitle={canManage ? 'Programs, certifications and skills development' : 'Training the company has enrolled you in'}
        onAdd={canManage ? () => setDrawerOpen(true) : undefined}
        addLabel="New program"
      />

      <DataTable
        columns={columns}
        rows={trainings}
        loading={loading}
        emptyMessage={canManage ? 'No training programs yet' : "You haven't been enrolled in any training yet"}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New training program"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save program
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Program title" required>
            <TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Provider">
            <TextInput value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </Field>
          <Field label="Skills covered" hint="Comma-separated">
            <TextInput
              value={form.skillsCovered}
              onChange={(e) => setForm({ ...form, skillsCovered: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Start date">
              <TextInput
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End date">
              <TextInput
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Cost (KES)">
            <TextInput type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['Planned', 'Ongoing', 'Completed', 'Cancelled'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>

          <Field label="Attendees" hint="Only people you have visibility over are listed here">
            <div className="card p-3 max-h-48 overflow-y-auto space-y-0.5">
              {employees.length === 0 ? (
                <p className="text-xs text-muted px-1 py-1">No employees available</p>
              ) : (
                employees.map((emp) => (
                  <Checkbox
                    key={emp._id}
                    label={`${emp.firstName} ${emp.lastName} · ${emp.department}`}
                    checked={form.attendeeIds.includes(emp._id)}
                    onChange={() => toggleAttendee(emp._id)}
                  />
                ))
              )}
            </div>
          </Field>

          <Field label="Notes">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
