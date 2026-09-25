// client/src/pages/Payroll.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import { Field, TextInput, Select } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { Download, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`;

const emptyForm = {
  employee: '',
  period: currentPeriod(),
  basicSalary: '',
  allowances: [],
  deductions: [],
  overtimeHours: 0,
  overtimeRate: 0,
  bonuses: [],
  advances: [],
  status: 'Draft',
};

export default function Payroll() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentPeriod());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();

  const load = () => {
    setLoading(true);
    api
      .get('/payroll', { params: { period } })
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [period]);

  const addLine = (field) =>
    setForm({ ...form, [field]: [...form[field], { name: '', amount: 0 }] });

  const updateLine = (field, idx, key, value) => {
    const items = [...form[field]];
    items[idx] = { ...items[idx], [key]: key === 'amount' ? Number(value) : value };
    setForm({ ...form, [field]: items });
  };

  const removeLine = (field, idx) =>
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/payroll', { ...form, basicSalary: Number(form.basicSalary) });
      toast.success('Payroll record created');
      setDrawerOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save record');
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    window.open(`/api/payroll/export/${period}`, '_blank');
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
            <p className="text-xs text-muted">{row.employee?.department}</p>
          </div>
        </div>
      ),
    },
    { key: 'basicSalary', header: 'Basic', render: (row) => fmt(row.basicSalary) },
    { key: 'grossPay', header: 'Gross', render: (row) => fmt(row.grossPay) },
    { key: 'totalDeductions', header: 'Deductions', render: (row) => fmt(row.totalDeductions) },
    { key: 'netPay', header: 'Net pay', render: (row) => <span className="font-semibold">{fmt(row.netPay)}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll support"
        subtitle="Basic pay, allowances, deductions and advances by period"
        onAdd={() => setDrawerOpen(true)}
        addLabel="New record"
        actions={
          <Button variant="secondary" icon={Download} onClick={exportExcel}>
            Export .xlsx
          </Button>
        }
      />

      <div className="mb-4">
        <TextInput type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto" />
      </div>

      <DataTable columns={columns} rows={records} loading={loading} emptyMessage="No payroll records for this period yet" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New payroll record"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save record
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
          </div>
          <Field label="Basic salary (KES)" required>
            <TextInput
              type="number"
              required
              value={form.basicSalary}
              onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Overtime hours">
              <TextInput
                type="number"
                value={form.overtimeHours}
                onChange={(e) => setForm({ ...form, overtimeHours: Number(e.target.value) })}
              />
            </Field>
            <Field label="Overtime rate (per hour)">
              <TextInput
                type="number"
                value={form.overtimeRate}
                onChange={(e) => setForm({ ...form, overtimeRate: Number(e.target.value) })}
              />
            </Field>
          </div>

          <LineItemEditor
            title="Allowances"
            items={form.allowances}
            onAdd={() => addLine('allowances')}
            onUpdate={(i, k, v) => updateLine('allowances', i, k, v)}
            onRemove={(i) => removeLine('allowances', i)}
          />
          <LineItemEditor
            title="Deductions"
            items={form.deductions}
            onAdd={() => addLine('deductions')}
            onUpdate={(i, k, v) => updateLine('deductions', i, k, v)}
            onRemove={(i) => removeLine('deductions', i)}
          />
          <LineItemEditor
            title="Bonuses"
            items={form.bonuses}
            onAdd={() => addLine('bonuses')}
            onUpdate={(i, k, v) => updateLine('bonuses', i, k, v)}
            onRemove={(i) => removeLine('bonuses', i)}
          />

          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['Draft', 'Processed', 'Exported', 'Paid'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </form>
      </Drawer>
    </div>
  );
}

function LineItemEditor({ title, items, onAdd, onUpdate, onRemove }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring flex items-center gap-1 text-xs font-medium text-brand-red hover:text-brand-redDark"
        >
          <Plus size={13} /> Add line
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">None added</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <TextInput
                placeholder="Description"
                value={item.name}
                onChange={(e) => onUpdate(i, 'name', e.target.value)}
              />
              <TextInput
                type="number"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => onUpdate(i, 'amount', e.target.value)}
                className="!w-32"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="focus-ring shrink-0 text-muted hover:text-brand-red p-1.5"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
