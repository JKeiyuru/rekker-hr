// client/src/pages/payroll/Reports.jsx
// Year view: every month side by side, per-column totals (handy for SHIF / NSSF
// remittance), totals per group, and the activity log.
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api/axios';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { EmptyState, Spinner } from '../../components/Feedback';
import { Select } from '../../components/Fields';
import { fetchFile, money, MONTHS, periodLabel } from './shared';

export function Reports({ runType }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get('/payroll/summary', { params: { year, runType } }).then((r) => setData(r.data));
  }, [year, runType]);

  const years = [0, 1, 2].map((i) => new Date().getFullYear() - i);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-32">
          {years.map((y) => <option key={y}>{y}</option>)}
        </Select>
        <p className="text-sm text-muted">{runType === 'Mid-Month' ? 'Mid-month' : 'Salary'} runs, {year}</p>
        <Button className="ml-auto" variant="secondary" icon={Download} onClick={() => fetchFile('/payroll/summary/export', { year, runType })}>Download year summary (.xlsx)</Button>
      </div>

      {!data ? <Spinner /> : data.periods.length === 0 ? (
        <div className="card"><EmptyState title="No runs this year yet" description="Once you start or import a run, its totals appear here." /></div>
      ) : (
        <>
          <div className="card p-5 mb-5">
            <h3 className="font-semibold text-ink mb-4">Gross vs net by month</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.periods.map((p) => ({ month: MONTHS[Number(p.period.slice(5)) - 1].slice(0, 3), Gross: Math.round(p.gross), Net: Math.round(p.net) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'rgb(var(--color-text-muted))' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'rgb(var(--color-text-muted))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={44} />
                  <Tooltip formatter={(v) => `KES ${money(v)}`} contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--color-border))', background: 'rgb(var(--color-surface))' }} />
                  <Legend />
                  <Bar dataKey="Gross" fill="#F0AD14" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Net" fill="#1B8A41" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden mb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface2/60 text-xs text-muted">
                    <th className="sticky left-0 bg-surface2 text-left px-4 py-3">Month</th>
                    <th className="px-3 py-3 text-right">Status</th>
                    <th className="px-3 py-3 text-right">Staff</th>
                    {data.columns.map((c) => <th key={c.key} className="px-3 py-3 text-right whitespace-nowrap">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.periods.map((p) => (
                    <tr key={p.period} className="border-t border-border">
                      <td className="sticky left-0 bg-surface px-4 py-2.5 font-medium whitespace-nowrap">{periodLabel(p.period)}</td>
                      <td className="px-3 py-2.5 text-right"><Badge>{p.status || 'Draft'}</Badge></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.count}</td>
                      {data.columns.map((c) => <td key={c.key} className={`px-3 py-2.5 text-right tabular-nums ${c.kind === 'net' || c.kind === 'gross' ? 'font-semibold' : ''}`}>{p.columns[c.key] ? money(p.columns[c.key], 2) : '—'}</td>)}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-surface2/60 font-semibold">
                    <td className="sticky left-0 bg-surface2 px-4 py-3">Year total</td>
                    <td /><td />
                    {data.columns.map((c) => <td key={c.key} className="px-3 py-3 text-right tabular-nums">{money(data.periods.reduce((s, p) => s + (p.columns[c.key] || 0), 0), 2)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-ink mb-3">Net pay by group</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-muted"><th className="text-left py-2">Group</th>{data.periods.map((p) => <th key={p.period} className="text-right px-3 py-2">{MONTHS[Number(p.period.slice(5)) - 1].slice(0, 3)}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(data.sections).map(([name, byP]) => (
                    <tr key={name} className="border-t border-border">
                      <td className="py-2.5 font-medium">{name}</td>
                      {data.periods.map((p) => <td key={p.period} className="text-right px-3 tabular-nums">{byP[p.period] ? money(byP[p.period].net) : '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Activity() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/payroll/audit').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Spinner />;
  if (!rows.length) return <div className="card"><EmptyState title="No activity yet" description="Approvals, imports and template changes are logged here." /></div>;
  return (
    <div className="card divide-y divide-border">
      {rows.map((r) => (
        <div key={r._id} className="flex items-start justify-between gap-4 px-5 py-3">
          <div>
            <p className="text-sm text-ink">{r.summary || r.action}</p>
            <p className="text-xs text-muted mt-0.5">{r.userName || 'System'}{r.period ? ` · ${periodLabel(r.period)} ${r.runType || ''}` : ''}</p>
          </div>
          <p className="text-xs text-muted whitespace-nowrap">{new Date(r.at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
      ))}
    </div>
  );
}
