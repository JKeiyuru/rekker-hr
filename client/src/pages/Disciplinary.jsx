// client/src/pages/Disciplinary.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { Field, TextInput, Select, TextArea } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = {
  employee: '',
  category: 'Incident',
  incidentDate: '',
  description: '',
  employeeExplanation: '',
  actionTaken: 'None',
  status: 'Open',
  confidentialNotes: '',
};

export default function Disciplinary() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();

  const load = () => {
    setLoading(true);
    api
      .get('/disciplinary')
      .then((res) => setCases(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/disciplinary', form);
      toast.success('Case recorded');
      setDrawerOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save case');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'caseNumber', header: 'Case #' },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`,
    },
    { key: 'category', header: 'Category' },
    { key: 'incidentDate', header: 'Date', render: (row) => row.incidentDate?.slice(0, 10) },
    { key: 'actionTaken', header: 'Action taken' },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted bg-surface2/60 border border-border rounded-xl px-4 py-2.5 w-fit">
        <ShieldAlert size={15} className="text-brand-red" />
        Restricted to Admin and HR — confidential employee records.
      </div>

      <PageHeader
        title="Disciplinary / HR Cases"
        subtitle="Warnings, incidents and case management"
        onAdd={() => setDrawerOpen(true)}
        addLabel="Log a case"
      />

      <DataTable columns={columns} rows={cases} loading={loading} emptyMessage="No disciplinary cases on record" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Log a disciplinary case"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save case
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
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Warning', 'Incident', 'Misconduct', 'Grievance', 'Other'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Incident date" required>
            <TextInput
              type="date"
              required
              value={form.incidentDate}
              onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
            />
          </Field>
          <Field label="Description" required>
            <TextArea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Employee's explanation">
            <TextArea
              value={form.employeeExplanation}
              onChange={(e) => setForm({ ...form, employeeExplanation: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Action taken">
              <Select value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}>
                {['None', 'Verbal Warning', 'Written Warning', 'Final Warning', 'Suspension', 'Termination'].map(
                  (a) => (
                    <option key={a}>{a}</option>
                  )
                )}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['Open', 'Under Review', 'Closed'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Confidential HR notes" hint="Only visible to Admin/HR">
            <TextArea
              value={form.confidentialNotes}
              onChange={(e) => setForm({ ...form, confidentialNotes: e.target.value })}
            />
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
