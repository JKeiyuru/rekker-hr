// client/src/pages/payroll/shared.js
import api from '../../api/axios';
import toast from 'react-hot-toast';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const currentPeriod = () => new Date().toISOString().slice(0, 7);
export const periodLabel = (p) => (p ? `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}` : '');
export const shiftPeriod = (p, delta) => {
  const d = new Date(Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};
export const money = (n, dp = 0) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: dp, maximumFractionDigits: dp === 0 ? 2 : dp });
export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';

// Downloads / opens a file that needs the auth header (so a plain <a href> can't be used).
export async function fetchFile(url, params, { open = false, filename } = {}) {
  try {
    const res = await api.get(url, { params, responseType: 'blob' });
    const blob = res.data;
    const objectUrl = URL.createObjectURL(blob);
    if (open) {
      window.open(objectUrl, '_blank');
      return;
    }
    let name = filename;
    const cd = res.headers['content-disposition'];
    if (!name && cd) name = (cd.match(/filename="?([^"]+)"?/) || [])[1];
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch (e) {
    // blob error bodies need decoding to show the server's message
    let msg = errMsg(e);
    try {
      const text = await e.response.data.text();
      msg = JSON.parse(text).message || msg;
    } catch (_) { /* keep msg */ }
    toast.error(msg);
  }
}

export const KIND_LABEL = { earning: 'Adds to gross pay', deduction: 'Comes off net pay', info: 'Reference only', gross: 'Gross pay (automatic)', net: 'Net pay (automatic)' };

// Same rules the server uses for payslips, so the template editor can preview changes before saving.
export function buildPreview(columns, entry, cfg) {
  const vis = columns.filter((c) => !c.archived && c.showOnPayslip);
  const val = (c) => entry?.computed?.[c.key];
  const lbl = (c) => c.payslipLabel || c.label;
  const keep = (v) => !cfg.hideZeroLines || (typeof v === 'number' ? v !== 0 : !!v);
  const pick = (kind) => vis.filter((c) => c.kind === kind).map((c) => ({ label: lbl(c), amount: Number(val(c)) || 0 })).filter((l) => keep(l.amount));
  return {
    cfg,
    earnings: pick('earning'),
    deductions: pick('deduction'),
    details: vis
      .filter((c) => c.kind === 'info')
      .map((c) => ({ label: lbl(c), value: c.type === 'text' ? val(c) || '' : Number(val(c)) || 0, text: c.type === 'text' }))
      .filter((d) => (d.text ? !!d.value : keep(d.value))),
    gross: entry?.gross || 0,
    totalDeductions: entry?.totalDeductions || 0,
    net: entry?.net || 0,
    grossLabel: lbl(columns.find((c) => c.kind === 'gross') || { label: 'Gross Pay' }),
    netLabel: lbl(columns.find((c) => c.kind === 'net') || { label: 'Net Pay' }),
    showGross: vis.some((c) => c.kind === 'gross'),
    employee: {
      name: entry?.employee ? `${entry.employee.firstName} ${entry.employee.lastName}` : 'Employee name',
      employeeId: entry?.employee?.employeeId || 'REK-0000',
      department: entry?.employee?.department || '',
      role: entry?.employee?.role || '',
      kraPin: entry?.employee?.kraPin || '',
      nssfNumber: entry?.employee?.nssfNumber || '',
      accType: entry?.computed?.acc_type || '',
      accNo: entry?.computed?.acc_no || '',
    },
  };
}

// Statutory column bundles the accountant can add with one click. Rates are the
// commonly used Kenyan ones - always confirm against current KRA / SHA / NSSF notices.
// If a column with the same name already exists it is switched to the formula
// (typed amounts already in a run stay as manual overrides).
export const PRESETS = [
  { id: 'shif', label: 'SHIF - 2.75% of gross (min 300)', build: () => [{ label: 'SHIF', kind: 'deduction', type: 'formula', group: 'DEDUCTIONS', formula: 'MAX(300, ROUND(gross_pay*2.75%, 0))', showOnPayslip: true }] },
  { id: 'housing', label: 'Affordable Housing Levy - 1.5% of gross', build: () => [{ label: 'HOUSING LEVY', kind: 'deduction', type: 'formula', group: 'DEDUCTIONS', formula: 'ROUND(gross_pay*1.5%, 0)', showOnPayslip: true }] },
  { id: 'nssf', label: 'NSSF - 6% of pay, capped at 72,000', build: () => [{ label: 'NSSF', kind: 'deduction', type: 'formula', group: 'PENSION', formula: 'ROUND(MIN(gross_pay, 72000)*6%, 0)', showOnPayslip: true }] },
  {
    id: 'paye',
    label: 'PAYE - graduated bands, 2,400 relief',
    build: (cols) => {
      const pre = ['nssf', 'nssf_tier1', 'shif', 'housing_levy'].filter((k) => cols.some((c) => c.key === k && !c.archived));
      return [
        { label: 'TAXABLE PAY', kind: 'info', type: 'formula', group: 'PAYE', formula: `MAX(0, gross_pay${pre.map((k) => ` - ${k}`).join('')})` },
        {
          label: 'PAYE', kind: 'deduction', type: 'formula', group: 'PAYE', showOnPayslip: true,
          formula: 'MAX(0, 10%*MIN(taxable_pay,24000) + 25%*MIN(MAX(taxable_pay-24000,0),8333) + 30%*MIN(MAX(taxable_pay-32333,0),467667) + 32.5%*MIN(MAX(taxable_pay-500000,0),300000) + 35%*MAX(taxable_pay-800000,0) - 2400)',
        },
      ];
    },
  },
];

export const slugify = (label) =>
  String(label || 'column').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'c_$1') || 'column';

export const newColumn = (over = {}) => ({
  key: '', label: 'NEW COLUMN', group: '', type: 'number', kind: 'earning', formula: '', system: false,
  showOnPayslip: true, payslipLabel: '', carryForward: false, inTotals: true, aliases: [], archived: false, ...over,
});
