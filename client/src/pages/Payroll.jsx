// client/src/pages/Payroll.jsx
// Payroll workspace for the accountant (and read access for HR / directors).
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import Badge from '../components/Badge';
import RunGrid from './payroll/RunGrid';
import TemplateEditor from './payroll/TemplateEditor';
import ImportWizard from './payroll/ImportWizard';
import { Activity, Reports } from './payroll/Reports';
import { currentPeriod, periodLabel, shiftPeriod } from './payroll/shared';

const TABS = [
  ['run', 'Pay run'],
  ['template', 'Template & payslip'],
  ['reports', 'Reports'],
  ['activity', 'Activity'],
];

export default function Payroll() {
  const [meta, setMeta] = useState({ canManage: false, canApprove: false, canReopenPaid: false });
  const [period, setPeriod] = useState(() => localStorage.getItem('rekker-payroll-period') || currentPeriod());
  const [runType, setRunType] = useState('End-Month');
  const [tab, setTab] = useState('run');
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addSignal, setAddSignal] = useState(0);
  const [sample, setSample] = useState(null);
  const [runs, setRuns] = useState([]);

  useEffect(() => { api.get('/payroll/meta').then((r) => setMeta(r.data)); }, []);
  useEffect(() => { try { localStorage.setItem('rekker-payroll-period', period); } catch (e) { /* ignore */ } }, [period]);
  useEffect(() => { api.get('/payroll/runs', { params: { runType } }).then((r) => setRuns(r.data)); }, [runType, refreshKey]);

  // a real row to drive the payslip preview in the template editor
  useEffect(() => {
    const latest = runs.find((r) => r.count > 0);
    if (!latest) { setSample(null); return; }
    api.get(`/payroll/runs/${latest.period}/${runType}`).then((r) => setSample(r.data.entries.find((e) => e.net > 0) || r.data.entries[0] || null));
  }, [runs, runType]);

  const thisRun = runs.find((r) => r.period === period);
  const goAddColumn = () => { setTab('template'); setAddSignal((n) => n + 1); };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Payroll</h1>
          <p className="text-sm text-muted mt-1">Run salaries and mid-month payments, manage the template, and publish payslips.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-border bg-surface">
            <button onClick={() => setPeriod(shiftPeriod(period, -1))} className="rounded-full p-2.5 text-muted hover:text-ink" aria-label="Previous month"><ChevronLeft size={16} /></button>
            <label className="relative px-1 text-sm font-semibold text-ink min-w-[132px] text-center cursor-pointer">
              {periodLabel(period)}
              <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Choose month" />
            </label>
            <button onClick={() => setPeriod(shiftPeriod(period, 1))} className="rounded-full p-2.5 text-muted hover:text-ink" aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="flex rounded-full bg-surface2 p-1">
            {[['End-Month', 'Salary'], ['Mid-Month', 'Mid-month']].map(([k, l]) => (
              <button key={k} onClick={() => setRunType(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${runType === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>{l}</button>
            ))}
          </div>
          {thisRun && <Badge>{thisRun.status}</Badge>}
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === k ? 'text-brand-red' : 'text-muted hover:text-ink'}`}>
            {l}
            {tab === k && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-red" />}
          </button>
        ))}
      </div>

      {tab === 'run' && <RunGrid period={period} runType={runType} meta={meta} refreshKey={refreshKey} onAddColumn={goAddColumn} onImport={() => setImportOpen(true)} />}
      {tab === 'template' && <TemplateEditor runType={runType} canManage={meta.canManage} sampleEntry={sample} addSignal={addSignal} onSaved={() => setRefreshKey((k) => k + 1)} />}
      {tab === 'reports' && <Reports runType={runType} />}
      {tab === 'activity' && <Activity />}

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        runType={runType}
        period={period}
        onDone={(p, rt) => { setPeriod(p); setRunType(rt); setTab('run'); setRefreshKey((k) => k + 1); }}
      />
    </div>
  );
}
