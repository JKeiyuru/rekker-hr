// client/src/components/PayslipCard.jsx
// On-screen payslip. Takes the same shape the server builds for the PDF.
import { money, periodLabel } from '../pages/payroll/shared';

function Block({ title, rows, total, totalLabel }) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>
      <div className="mt-2 border-t border-border">
        {rows.length === 0 && <p className="py-3 text-sm text-muted italic">None this period</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between gap-4 py-2.5 text-sm border-b border-border">
            <span className="text-ink">{r.label}</span>
            <span className="tabular-nums text-ink">{r.text !== undefined ? r.text : money(r.amount, 2)}</span>
          </div>
        ))}
      </div>
      {totalLabel && (
        <div className="mt-2 flex justify-between rounded-lg bg-surface2 px-3 py-2.5 text-sm font-semibold">
          <span>{totalLabel}</span>
          <span className="tabular-nums">{money(total, 2)}</span>
        </div>
      )}
    </div>
  );
}

export default function PayslipCard({ slip, compact = false }) {
  if (!slip) return null;
  const e = slip.employee;
  const cfg = slip.cfg || {};
  const info = [
    ['Employee', e.name],
    ['Employee no.', e.employeeId],
    ['Department', e.department],
    ['Position', e.role],
  ];
  if (cfg.showStatutoryNumbers) info.push(['KRA PIN', e.kraPin || '—'], ['NSSF no.', e.nssfNumber || '—']);
  if (cfg.showBankDetails && (e.accType || e.accNo)) info.push(['Paid via', `${e.accType || ''} ${e.accNo ? '•••' + String(e.accNo).slice(-4) : ''}`]);

  return (
    <div className="card overflow-hidden">
      <div className="bg-brand-red text-white px-6 py-5 flex items-start justify-between">
        <div>
          <p className="text-lg font-bold leading-tight">{cfg.companyName || 'REKKER LIMITED'}</p>
          <p className="text-xs text-white/80 mt-1">{cfg.title || 'PAYSLIP'}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{slip.periodLabel || periodLabel(slip.period) || 'Month Year'}</p>
          <p className="text-xs text-white/80 mt-1">{slip.runType === 'Mid-Month' ? 'Mid-month statement' : 'Monthly salary'}</p>
        </div>
      </div>
      <div className="h-1 bg-brand-yellow" />
      <div className={compact ? 'p-5' : 'p-6'}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {info.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted">{k}</p>
              <p className="text-sm font-semibold text-ink truncate">{v || '—'}</p>
            </div>
          ))}
        </div>
        <Block title="Earnings" rows={slip.earnings} total={slip.gross} totalLabel={slip.showGross ? slip.grossLabel : 'Total earnings'} />
        <Block title="Deductions" rows={slip.deductions} total={slip.totalDeductions} totalLabel="Total deductions" />
        {slip.details?.length > 0 && (
          <Block title="Details" rows={slip.details.map((d) => ({ label: d.label, text: d.text ? d.value : money(d.value, 2) }))} />
        )}
        <div className="mt-6 rounded-2xl bg-ink text-bg px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide opacity-70">{slip.netLabel || 'Net Pay'}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">KES {money(slip.net, 2)}</p>
        </div>
        {slip.status === 'Draft' && <p className="mt-3 text-xs font-semibold text-brand-red">DRAFT - not yet approved</p>}
        {cfg.footerNote && <p className="mt-5 text-center text-xs text-muted">{cfg.footerNote}</p>}
      </div>
    </div>
  );
}
