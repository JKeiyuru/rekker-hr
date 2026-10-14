// client/src/pages/Payslips.jsx
// Everyone's own payslips. Opens on the latest salary month; pick another
// month or a range (e.g. January to June) and download it as a PDF.
import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Receipt } from 'lucide-react';
import api from '../api/axios';
import Button from '../components/Button';
import Badge from '../components/Badge';
import PayslipCard from '../components/PayslipCard';
import { EmptyState, Spinner } from '../components/Feedback';
import { Checkbox, Select } from '../components/Fields';
import { errMsg, fetchFile, money, periodLabel } from './payroll/shared';

export default function Payslips() {
  const [list, setList] = useState(null);
  const [latest, setLatest] = useState(null);
  const [period, setPeriod] = useState('');
  const [runType, setRunType] = useState('End-Month');
  const [slip, setSlip] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [withMid, setWithMid] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/payslips/mine').then((r) => {
      setList(r.data.payslips);
      setLatest(r.data.latest);
      setPeriod(r.data.latest || '');
      const salary = r.data.payslips.filter((p) => p.runType === 'End-Month');
      if (salary.length) { setTo(salary[0].period); setFrom(salary[Math.min(salary.length, 6) - 1].period); }
    }).catch((e) => setErr(errMsg(e)));
  }, []);

  useEffect(() => {
    if (!period) return;
    setSlip(null);
    api.get('/payslips/data', { params: { period, runType } }).then((r) => setSlip(r.data)).catch(() => setSlip(null));
  }, [period, runType]);

  const months = useMemo(() => [...new Set((list || []).filter((p) => p.runType === 'End-Month').map((p) => p.period))], [list]);

  if (err) return <div className="card"><EmptyState title="No payslips to show" description={err} /></div>;
  if (!list) return <Spinner />;
  if (!list.length) return <div className="card"><EmptyState icon={Receipt} title="No payslips yet" description="Your payslip appears here as soon as payroll for the month is approved." /></div>;

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My payslips</h1>
          <p className="text-sm text-muted mt-1">Showing {periodLabel(period)}{period === latest ? ' (your latest)' : ''}.</p>
        </div>
        <Button icon={Download} onClick={() => fetchFile('/payslips/pdf', { from: period, to: period, runType })}>Download this payslip</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>{slip ? <PayslipCard slip={slip} /> : <Spinner />}</div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-ink">View another month</h3>
            <Select className="mt-3" value={`${runType}|${period}`} onChange={(e) => { const [rt, p] = e.target.value.split('|'); setRunType(rt); setPeriod(p); }}>
              {list.map((p) => <option key={`${p.runType}${p.period}`} value={`${p.runType}|${p.period}`}>{periodLabel(p.period)}{p.runType === 'Mid-Month' ? ' (mid-month)' : ''}</option>)}
            </Select>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-ink">Download a range</h3>
            <p className="text-sm text-muted mt-0.5 mb-3">One PDF with a payslip per month and a summary page, e.g. January to June.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">From
                <Select className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)}>{[...months].reverse().map((m) => <option key={m} value={m}>{periodLabel(m)}</option>)}</Select>
              </label>
              <label className="text-xs text-muted">To
                <Select className="mt-1" value={to} onChange={(e) => setTo(e.target.value)}>{[...months].reverse().map((m) => <option key={m} value={m}>{periodLabel(m)}</option>)}</Select>
              </label>
            </div>
            <div className="mt-3"><Checkbox label="Include mid-month statements" checked={withMid} onChange={(e) => setWithMid(e.target.checked)} /></div>
            <Button className="w-full mt-2" variant="secondary" icon={FileText} onClick={() => fetchFile('/payslips/pdf', { from, to, runType: withMid ? 'both' : 'End-Month' })}>Download PDF</Button>
          </div>

          <div className="card divide-y divide-border">
            <p className="px-5 py-3 text-sm font-semibold text-ink">History</p>
            {list.map((p) => (
              <button key={`${p.runType}${p.period}`} onClick={() => { setRunType(p.runType); setPeriod(p.period); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-surface2/60">
                <span>
                  <span className="block text-sm font-medium text-ink">{periodLabel(p.period)}</span>
                  <span className="block text-xs text-muted">{p.runType === 'Mid-Month' ? 'Mid-month' : 'Salary'}</span>
                </span>
                <span className="text-sm tabular-nums text-ink">KES {money(p.net, 2)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
