// client/src/pages/PayrollLinks.jsx
// Admin only. Checks that every login is linked to the right employee record
// and that the payroll rows under that record really belong to that person -
// and shows exactly which payslips each login can see, so nobody has to log in
// as an employee to find out.
import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import PayslipCard from '../components/PayslipCard';
import { Select } from '../components/Fields';
import { Spinner } from '../components/Feedback';
import useEmployees from '../hooks/useEmployees';
import { money, periodLabel } from './payroll/shared';
import { ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS = {
  wrong: { label: 'Wrong', tone: 'red' },
  review: { label: 'Needs a check', tone: 'yellow' },
  ok: { label: 'Correct', tone: 'green' },
  no_payroll: { label: 'No payroll yet', tone: 'neutral' },
  unlinked: { label: 'Not linked', tone: 'neutral' },
};
const FILTERS = [
  ['all', 'All'],
  ['wrong', 'Wrong'],
  ['review', 'Needs a check'],
  ['ok', 'Correct'],
  ['other', 'No payroll / not linked'],
];

const empLabel = (e) => `${e.firstName} ${e.lastName} — ${e.department || '?'} — ${e.employeeId || ''} — ${e.email || ''}`;

export default function PayrollLinks() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const { employees } = useEmployees();

  const load = () =>
    api
      .get('/payroll-links')
      .then((r) => setData(r.data))
      .catch((e) => toast.error(e.response?.data?.message || 'Could not run the check'));
  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => filter === 'all' || r.status === filter || (filter === 'other' && ['no_payroll', 'unlinked'].includes(r.status)));
  }, [data, filter]);
  const open = data?.rows.find((r) => r.userId === openId);

  if (!data) return <Spinner />;
  const count = (k) => (k === 'all' ? data.rows.length : k === 'other' ? (data.summary.no_payroll || 0) + (data.summary.unlinked || 0) : data.summary[k] || 0);

  const columns = [
    {
      key: 'login',
      header: 'Login',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.name}</p>
          <p className="text-xs text-muted">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Linked employee record',
      render: (r) =>
        r.employee ? (
          <div>
            <p className="text-ink">{r.employee.name}</p>
            <p className="text-xs text-muted">{[r.employee.department, r.employee.employeeId, r.employee.bank].filter(Boolean).join(' · ')}</p>
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'payslips',
      header: 'Payslips they can see',
      render: (r) => (
        <span className="text-ink">
          {r.payslips.count}
          {r.payslips.withheld ? <span className="text-brand-red"> (+{r.payslips.withheld} hidden)</span> : null}
        </span>
      ),
    },
    { key: 'status', header: 'Check', render: (r) => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll Links"
        subtitle="Makes sure every login sees only its own payslips. Click a login to see exactly what it sees."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            Re-run check
          </Button>
        }
      />

      <div className="card p-4 mb-5 flex gap-3 text-sm text-ink/80">
        <ShieldCheck size={18} className="text-brand-green shrink-0 mt-0.5" />
        <p>
          A login shows the payslips of the employee record it is linked to. This check compares each login’s email, and the name and bank account on every
          payroll row, with that employee. A payslip whose bank account belongs to a different employee is automatically hidden from the person it is filed under.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === k ? 'border-brand-red bg-brand-red/10 text-brand-red' : 'border-border text-ink/70 hover:text-ink'
            }`}
          >
            {label} · {count(k)}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={rows.map((r) => ({ ...r, _id: r.userId }))} onRowClick={(r) => setOpenId(r.userId)} emptyMessage="Nothing in this group" />

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name || ''} subtitle={open?.email} wide>
        {open && <Detail key={open.userId} row={open} employees={employees} onChanged={load} />}
      </Drawer>
    </div>
  );
}

function Detail({ row, employees, onChanged }) {
  const [list, setList] = useState(null);
  const [slip, setSlip] = useState(null);
  const [relink, setRelink] = useState('');
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState({}); // issue index -> employee id

  useEffect(() => {
    if (!row.employee) return;
    api
      .get('/payslips/mine', { params: { employee: row.employee.id, simulate: 1 } })
      .then((r) => setList(r.data.payslips))
      .catch(() => setList([]));
  }, [row.employee?.id, row.payslips.count]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(okMsg(r?.data));
      await onChanged();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };
  const relinkTo = (employeeId) => act(() => api.put(`/users/${row.userId}`, { employee: employeeId }), () => 'Login re-linked');
  const moveRows = (issue, to) =>
    act(
      () => api.post('/payroll-links/move', { from: row.employee.id, to, payrollNames: issue.payrollNames || [issue.payrollName] }),
      (d) => `Moved ${d.moved.length} payroll row(s)${d.skipped.length ? `, skipped ${d.skipped.length}` : ''}`
    );
  const openSlip = (p) =>
    api
      .get('/payslips/data', { params: { employee: row.employee.id, period: p.period, runType: p.runType, simulate: 1 } })
      .then((r) => setSlip(r.data))
      .catch(() => toast.error('Could not load that payslip'));

  const tone = { wrong: 'border-brand-red/30 bg-brand-red/5', review: 'border-brand-yellow/40 bg-brand-yellow/10', info: 'border-border bg-surface2/50' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
        <span className="text-sm text-muted capitalize">Login role: {row.role}</span>
      </div>

      {row.issues.length > 0 && (
        <div className="space-y-3">
          {row.issues.map((issue, i) => (
            <div key={i} className={`rounded-xl border p-4 text-sm ${tone[issue.level]}`}>
              <p className="flex gap-2 text-ink">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-brand-red" /> {issue.message}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {issue.code === 'wrong-employee' && issue.suggestEmployee && (
                  <Button size="sm" loading={busy} onClick={() => relinkTo(issue.suggestEmployee.id)}>
                    Link this login to {issue.suggestEmployee.name} ({issue.suggestEmployee.department})
                  </Button>
                )}
                {(issue.code === 'foreign-account' || issue.code === 'name-mismatch') && (
                  <>
                    <Select className="max-w-xs !py-1.5" value={moveTo[i] ?? issue.suggestEmployee?.id ?? ''} onChange={(e) => setMoveTo({ ...moveTo, [i]: e.target.value })}>
                      <option value="">Move these payroll rows to…</option>
                      {employees.filter((e) => e._id !== row.employee?.id).map((e) => (
                        <option key={e._id} value={e._id}>
                          {empLabel(e)}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" variant="secondary" loading={busy} disabled={!(moveTo[i] ?? issue.suggestEmployee?.id)} onClick={() => moveRows(issue, moveTo[i] ?? issue.suggestEmployee.id)}>
                      Move rows
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold text-ink mb-2">Linked employee record</h3>
        <div className="card p-4 text-sm">
          {row.employee ? (
            <>
              <p className="font-medium text-ink">{row.employee.name}</p>
              <p className="text-muted">{[row.employee.jobTitle, row.employee.department, row.employee.employeeId].filter(Boolean).join(' · ')}</p>
              <p className="text-muted">Bank: {row.employee.bank || 'not on file'}</p>
            </>
          ) : (
            <p className="text-muted">This login is not linked to an employee record.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Select className="max-w-sm !py-1.5" value={relink} onChange={(e) => setRelink(e.target.value)}>
              <option value="">Change linked employee…</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {empLabel(e)}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" disabled={!relink} loading={busy} onClick={() => relinkTo(relink)}>
              Re-link
            </Button>
          </div>
        </div>
      </section>

      {row.employee && (
        <section>
          <h3 className="text-sm font-semibold text-ink">What this login sees</h3>
          <p className="text-xs text-muted mb-2">Their payslips page, exactly as they get it. Click one to preview it (read-only).</p>
          {!list ? (
            <Spinner />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted">No approved payslips are visible to this login.</p>
          ) : (
            <div className="card divide-y divide-border">
              {list.map((p) => (
                <button key={`${p.runType}${p.period}`} onClick={() => openSlip(p)} className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-surface2/60">
                  <span className="text-ink">
                    {periodLabel(p.period)} <span className="text-xs text-muted">{p.runType === 'Mid-Month' ? 'mid-month' : 'salary'}</span>
                  </span>
                  <span className="tabular-nums text-ink">KES {money(p.net, 2)}</span>
                </button>
              ))}
            </div>
          )}
          {slip && (
            <div className="mt-4">
              <PayslipCard slip={slip} />
            </div>
          )}
        </section>
      )}

      {row.payrollNames.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink mb-2">Names on the payroll sheets filed under this employee</h3>
          <div className="flex flex-wrap gap-2">
            {row.payrollNames.map((n) => (
              <Badge key={n.name} tone="neutral">
                {n.name || '(blank)'} × {n.count}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
