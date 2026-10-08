// client/src/pages/Payroll.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import { Field, TextInput, Select, TextArea, Checkbox } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`;

const ALLOWANCE_PRESETS = ['Transport', 'Lunch', 'House', 'Airtime'];
const DEDUCTION_PRESETS = ['PAYE', 'NSSF', 'SHIF', 'Loan Repayment'];

const emptyForm = (runType = 'End-Month') => ({
  employee: '',
  period: currentPeriod(),
  runType,
  basicSalary: '',
  allowances: [],
  deductions: [],
  bonuses: [],
  expenseReimbursements: [],
  overtimeHours: 0,
  overtimeRate: 0,
  overtimeAmount: '',
  notes: '',
  status: 'Draft',
});

export default function Payroll() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentPeriod());
  const [runType, setRunType] = useState('End-Month');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const { employees } = useEmployees();

  const load = () => {
    setLoading(true);
    api
      .get('/payroll', { params: { period, runType } })
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [period, runType]);

  const addLine = (field, name = '') => setForm((f) => ({ ...f, [field]: [...f[field], { name, description: name, amount: 0 }] }));
  const updateLine = (field, idx, key, value) =>
    setForm((f) => {
      const items = [...f[field]];
      items[idx] = { ...items[idx], [key]: key === 'amount' ? Number(value) : value };
      return { ...f, [field]: items };
    });
  const removeLine = (field, idx) => setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        basicSalary: Number(form.basicSalary) || 0,
        overtimeAmount: form.overtimeAmount === '' ? undefined : Number(form.overtimeAmount),
      };
      await api.post('/payroll', payload);
      toast.success('Payroll record saved');
      setDrawerOpen(false);
      setForm(emptyForm(runType));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save record');
    } finally {
      setSaving(false);
    }
  };

  // The export route needs the auth token, so a plain window.open (which
  // can't send an Authorization header) would 401 - fetch it as a blob.
  const exportExcel = async () => {
    try {
      const res = await api.get(`/payroll/export/${period}`, { params: { runType }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${period}-${runType}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
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

  const totalNet = records.reduce((s, r) => s + (r.netPay || 0), 0);

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Mid-month and end-month runs, allowances, deductions, reimbursements and history"
        onAdd={() => {
          setForm(emptyForm(runType));
          setDrawerOpen(true);
        }}
        addLabel="New record"
        actions={
          <>
            <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
              Import history
            </Button>
            <Button variant="secondary" icon={Download} onClick={exportExcel}>
              Export .xlsx
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <TextInput type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto" />
        <div className="flex gap-1 bg-surface2 p-1 rounded-full w-fit">
          {['Mid-Month', 'End-Month'].map((t) => (
            <button
              key={t}
              onClick={() => setRunType(t)}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                runType === t ? 'bg-brand-red text-white' : 'text-ink/70 hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted ml-auto">
          {records.length} records · Net total <b className="text-ink">{fmt(totalNet)}</b>
        </span>
      </div>

      <DataTable columns={columns} rows={records} loading={loading} emptyMessage="No payroll records for this period/run yet" />

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
          <div className="grid grid-cols-3 gap-x-4">
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
              <TextInput type="month" required value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </Field>
            <Field label="Run">
              <Select value={form.runType} onChange={(e) => setForm({ ...form, runType: e.target.value })}>
                <option>Mid-Month</option>
                <option>End-Month</option>
              </Select>
            </Field>
          </div>
          <Field label="Basic salary (KES)" hint="Leave 0 for a mid-month run that only pays allowances/reimbursements">
            <TextInput type="number" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
          </Field>

          <div className="grid grid-cols-3 gap-x-4">
            <Field label="Overtime hours">
              <TextInput type="number" value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: Number(e.target.value) })} />
            </Field>
            <Field label="Overtime rate / hr">
              <TextInput type="number" value={form.overtimeRate} onChange={(e) => setForm({ ...form, overtimeRate: Number(e.target.value) })} />
            </Field>
            <Field label="OR overtime lump sum" hint="Overrides hours × rate">
              <TextInput type="number" value={form.overtimeAmount} onChange={(e) => setForm({ ...form, overtimeAmount: e.target.value })} />
            </Field>
          </div>

          <Lines title="Allowances (transport, lunch…)" items={form.allowances} presets={ALLOWANCE_PRESETS}
            nameKey="name" onAdd={(n) => addLine('allowances', n)} onUpdate={(i, k, v) => updateLine('allowances', i, k, v)} onRemove={(i) => removeLine('allowances', i)} />
          <Lines title="Expense reimbursements" items={form.expenseReimbursements} presets={['First half of month', 'Second half of month']}
            nameKey="description" onAdd={(n) => addLine('expenseReimbursements', n)} onUpdate={(i, k, v) => updateLine('expenseReimbursements', i, k, v)} onRemove={(i) => removeLine('expenseReimbursements', i)} />
          <Lines title="Bonuses" items={form.bonuses} presets={[]} nameKey="name"
            onAdd={(n) => addLine('bonuses', n)} onUpdate={(i, k, v) => updateLine('bonuses', i, k, v)} onRemove={(i) => removeLine('bonuses', i)} />
          <Lines title="Deductions (tax, statutory, advances…)" items={form.deductions} presets={[...DEDUCTION_PRESETS, 'Advance']}
            nameKey="name" onAdd={(n) => addLine('deductions', n)} onUpdate={(i, k, v) => updateLine('deductions', i, k, v)} onRemove={(i) => removeLine('deductions', i)} />

          <Field label="Notes">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['Draft', 'Processed', 'Exported', 'Paid'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </form>
      </Drawer>

      <ImportDrawer open={importOpen} onClose={() => setImportOpen(false)} employees={employees} onDone={load} />
    </div>
  );
}

function Lines({ title, items, presets, nameKey, onAdd, onUpdate, onRemove }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        <div className="flex flex-wrap gap-2 justify-end">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onAdd(p)}
              className="focus-ring text-xs rounded-full border border-border px-2.5 py-1 text-muted hover:text-brand-red hover:border-brand-red/40">
              + {p}
            </button>
          ))}
          <button type="button" onClick={() => onAdd('')}
            className="focus-ring flex items-center gap-1 text-xs font-medium text-brand-red hover:text-brand-redDark">
            <Plus size={13} /> Custom
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">None added</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <TextInput placeholder="Description" value={item[nameKey] || ''} onChange={(e) => onUpdate(i, nameKey, e.target.value)} />
              <TextInput type="number" placeholder="Amount" value={item.amount} onChange={(e) => onUpdate(i, 'amount', e.target.value)} className="!w-32" />
              <button type="button" onClick={() => onRemove(i)} className="focus-ring shrink-0 text-muted hover:text-brand-red p-1.5">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Upload a past payroll sheet -> review/correct employee matches -> commit.
function ImportDrawer({ open, onClose, employees, onDone }) {
  const [format, setFormat] = useState('end-month');
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [sheet, setSheet] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null); setSheets([]); setSheet(''); setRows(null);
  };

  const pickFile = async (f) => {
    setFile(f); setRows(null);
    if (!f) return;
    const data = new FormData();
    data.append('file', f);
    try {
      const res = await api.post('/payroll/import/sheets', data);
      setSheets(res.data.sheets);
      setSheet(res.data.sheets[0] || '');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not read that file');
    }
  };

  const preview = async () => {
    if (!file) return toast.error('Choose a file first');
    setBusy(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('format', format);
      data.append('sheet', sheet);
      const res = await api.post('/payroll/import/preview', data);
      setRows(
        res.data.rows.map((r) => ({
          ...r,
          employeeId: r.matchedEmployeeId || '',
          createEmployee: false,
        }))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not parse that sheet');
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const unresolved = rows ? rows.filter((r) => !r.employeeId && !r.createEmployee).length : 0;

  const commit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/payroll/import/commit', {
        period,
        runType: format === 'mid-month' ? 'Mid-Month' : 'End-Month',
        importLabel: `${file?.name} / ${sheet} (${period})`,
        rows: rows.filter((r) => r.employeeId || r.createEmployee),
      });
      const { created, newEmployees, errors } = res.data;
      toast.success(`${created} records imported, ${newEmployees} new employees added`);
      if (errors.length) toast.error(`${errors.length} rows had problems - see console`, { duration: 6000 });
      if (errors.length) console.warn('Import problems:', errors);
      onDone();
      reset();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import payroll history"
      subtitle="Upload a past payroll sheet, check who each row is, then import"
      wide
      footer={
        rows ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{unresolved} row(s) have no employee chosen and will be skipped</span>
            <Button onClick={commit} loading={busy}>Import {rows.length - unresolved} records</Button>
          </div>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Sheet type">
          <Select value={format} onChange={(e) => { setFormat(e.target.value); setRows(null); }}>
            <option value="end-month">Full end-month payroll (salary sheet)</option>
            <option value="mid-month">Mid-month expenses / transport sheet</option>
          </Select>
        </Field>
        <Field label="Which month is it for?" required>
          <TextInput type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
      </div>
      <Field label="Excel file (.xlsx)" required>
        <input type="file" accept=".xlsx" onChange={(e) => pickFile(e.target.files[0])}
          className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-surface2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink" />
      </Field>
      {sheets.length > 1 && (
        <Field label="Sheet / tab in that file" hint="A workbook with one tab per month: pick the tab for the month above">
          <Select value={sheet} onChange={(e) => { setSheet(e.target.value); setRows(null); }}>
            {sheets.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
      )}
      <Button variant="secondary" onClick={preview} loading={busy} className="mb-5">Read sheet &amp; preview</Button>

      {rows && (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const paid =
              format === 'mid-month'
                ? (r.expenseReimbursements || []).reduce((s, x) => s + x.amount, 0)
                : r.basicSalary + (r.overtimeAmount || 0) + (r.allowances || []).reduce((s, x) => s + x.amount, 0);
            return (
              <div key={i} className="card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{r.rawName}</p>
                    <p className="text-xs text-muted">Gross {fmt(paid)}{r.deductions?.length ? ` · deductions ${fmt(r.deductions.reduce((s, x) => s + x.amount, 0))}` : ''}</p>
                  </div>
                  <Select
                    value={r.createEmployee ? '__new' : r.employeeId}
                    onChange={(e) =>
                      e.target.value === '__new'
                        ? setRow(i, { employeeId: '', createEmployee: true })
                        : setRow(i, { employeeId: e.target.value, createEmployee: false })
                    }
                    className="!w-56"
                  >
                    <option value="">— choose employee —</option>
                    <option value="__new">＋ Add as new employee (no login)</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
