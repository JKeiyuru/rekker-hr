// server/services/payslip.js
// Builds payslip data from a pay-run row and renders it as a PDF.
// What appears on the payslip is controlled by the accountant: each template
// column has a "show on payslip" switch, plus company/footer/bank settings.
const PDFDocument = require('pdfkit');
const PayrollEntry = require('../models/PayrollEntry');
const PayrollRun = require('../models/PayrollRun');
const svc = require('./payrollService');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const periodLabel = (p) => `${MONTH_NAMES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const money = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const maskAccount = (s) => (s && String(s).length > 4 ? `${'•'.repeat(Math.max(0, String(s).length - 4))}${String(s).slice(-4)}` : s || '');

function buildPayslip({ entry, run, template, employee }) {
  const columns = svc.columnsForRun(run, template);
  const cfg = (run && run.snapshot && run.snapshot.payslip) || (template.payslip.toObject ? template.payslip.toObject() : template.payslip);
  const vis = columns.filter((c) => !c.archived && c.showOnPayslip);
  const val = (c) => (entry.computed ? entry.computed[c.key] : undefined);
  const labelOf = (c) => c.payslipLabel || c.label;
  const keep = (v) => !cfg.hideZeroLines || (typeof v === 'number' ? v !== 0 : !!v);
  const earnings = vis.filter((c) => c.kind === 'earning').map((c) => ({ label: labelOf(c), amount: Number(val(c)) || 0 })).filter((l) => keep(l.amount));
  const deductions = vis.filter((c) => c.kind === 'deduction').map((c) => ({ label: labelOf(c), amount: Number(val(c)) || 0 })).filter((l) => keep(l.amount));
  const details = vis
    .filter((c) => c.kind === 'info')
    .map((c) => ({ label: labelOf(c), value: c.type === 'text' ? val(c) || '' : Number(val(c)) || 0, text: c.type === 'text' }))
    .filter((d) => (d.text ? !!d.value : keep(d.value)));
  const grossCol = vis.find((c) => c.kind === 'gross');
  const netCol = vis.find((c) => c.kind === 'net');
  return {
    cfg,
    period: entry.period,
    periodLabel: periodLabel(entry.period),
    runType: entry.runType,
    status: run ? run.status : 'Draft',
    employee: {
      name: `${employee.firstName} ${employee.lastName}`,
      employeeId: employee.employeeId,
      department: employee.department,
      role: employee.role,
      kraPin: employee.kraPin,
      nssfNumber: employee.nssfNumber,
      bank: [entry.computed && entry.computed.acc_type, entry.computed && entry.computed.acc_no].filter(Boolean).join(' '),
      accType: (entry.computed && entry.computed.acc_type) || employee.bankName || '',
      accNo: (entry.computed && entry.computed.acc_no) || employee.bankAccount || '',
    },
    earnings,
    deductions,
    details,
    gross: entry.gross,
    grossLabel: grossCol ? labelOf(grossCol) : 'Gross Pay',
    totalDeductions: entry.totalDeductions,
    net: entry.net,
    netLabel: netCol ? labelOf(netCol) : 'Net Pay',
    showGross: !!grossCol,
    showNet: true,
  };
}

// Loads the payslips for one employee across a range of periods.
async function payslipsFor({ employeeId, from, to, runType = 'End-Month', includeDrafts = false, guard = false }) {
  const q = { employee: employeeId, runType, period: { $gte: from, $lte: to } };
  const entries = await PayrollEntry.find(q).sort({ period: 1 }).populate('employee');
  const template = await svc.getTemplate(runType);
  const out = [];
  // guard: self-service view - skip rows that pay another employee's bank account
  const { loadAccountOwners, foreignAccountOwners } = require('../utils/payrollLinks');
  const owners = guard ? await loadAccountOwners() : null;
  for (const e of entries) {
    if (guard && foreignAccountOwners(e, employeeId, owners)) continue;
    const run = await PayrollRun.findOne({ period: e.period, runType: e.runType });
    if (!run) continue;
    if (!includeDrafts && run.status === 'Draft') continue;
    out.push(buildPayslip({ entry: e, run, template, employee: e.employee }));
  }
  return out;
}

// ---- PDF -------------------------------------------------------------------------------
const RED = '#D60821';
const INK = '#1a1a1c';
const MUTED = '#6c6c72';
const LINE = '#e3e3e7';
const SOFT = '#f6f6f8';

function drawPayslip(doc, p) {
  const L = 44;
  const W = doc.page.width - L * 2;
  // header band
  doc.rect(0, 0, doc.page.width, 92).fill(RED);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20).text(p.cfg.companyName || 'REKKER LIMITED', L, 30, { width: W * 0.6 });
  doc.font('Helvetica').fontSize(10).fillColor('#ffd9de').text(p.cfg.title || 'PAYSLIP', L, 56);
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#fff').text(p.periodLabel, L, 30, { width: W, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#ffd9de').text(p.runType === 'Mid-Month' ? 'Mid-month statement' : 'Monthly salary', L, 52, { width: W, align: 'right' });
  doc.rect(0, 92, doc.page.width, 4).fill('#F0AD14');

  // employee block
  let y = 120;
  const info = [
    ['Employee', p.employee.name],
    ['Employee no.', p.employee.employeeId],
    ['Department', p.employee.department],
    ['Position', p.employee.role],
  ];
  if (p.cfg.showStatutoryNumbers) {
    info.push(['KRA PIN', p.employee.kraPin || '—'], ['NSSF no.', p.employee.nssfNumber || '—']);
  }
  if (p.cfg.showBankDetails && (p.employee.accType || p.employee.accNo)) {
    info.push(['Paid via', `${p.employee.accType || ''} ${maskAccount(p.employee.accNo)}`.trim()]);
  }
  const colW = W / 2;
  info.forEach(([k, v], i) => {
    const x = L + (i % 2) * colW;
    const yy = y + Math.floor(i / 2) * 36;
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k.toUpperCase(), x, yy, { width: colW - 10 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(String(v || '—'), x, yy + 12, { width: colW - 10 });
  });
  y += Math.ceil(info.length / 2) * 36 + 10;

  const table = (title, rows, totalLabel, total) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(title.toUpperCase(), L, y);
    y += 16;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor(LINE).lineWidth(1).stroke();
    y += 6;
    if (!rows.length) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text('None this period', L, y + 2);
      y += 24;
    }
    rows.forEach((r) => {
      doc.font('Helvetica').fontSize(11).fillColor(INK).text(r.label, L, y, { width: W * 0.62 });
      doc.text(r.text !== undefined ? r.text : money(r.amount), L + W * 0.62, y, { width: W * 0.38, align: 'right' });
      y += 22;
      doc.moveTo(L, y - 5).lineTo(L + W, y - 5).strokeColor(LINE).lineWidth(0.5).stroke();
    });
    if (totalLabel) {
      doc.rect(L, y, W, 26).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(totalLabel, L + 8, y + 7, { width: W * 0.6 });
      doc.text(money(total), L + W * 0.62, y + 7, { width: W * 0.38 - 8, align: 'right' });
      y += 38;
    } else y += 8;
  };

  table('Earnings', p.earnings, p.showGross ? p.grossLabel : 'Total earnings', p.gross);
  table('Deductions', p.deductions, 'Total deductions', p.totalDeductions);
  if (p.details.length) {
    table('Details', p.details.map((d) => ({ label: d.label, text: d.text ? d.value : money(d.value) })));
  }

  // net pay highlight
  doc.roundedRect(L, y, W, 54, 10).fill(INK);
  doc.font('Helvetica').fontSize(10).fillColor('#bdbdc4').text(p.netLabel.toUpperCase(), L + 18, y + 11);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#fff').text(`KES ${money(p.net)}`, L + 18, y + 24, { width: W - 36 });
  y += 74;

  if (p.status === 'Draft') {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('DRAFT - not yet approved', L, y);
    y += 16;
  }
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(p.cfg.footerNote || '', L, doc.page.height - 70, { width: W, align: 'center' });
}

function drawSummary(doc, slips) {
  const L = 44;
  const W = doc.page.width - L * 2;
  const first = slips[0];
  doc.rect(0, 0, doc.page.width, 92).fill(RED);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20).text(first.cfg.companyName || 'REKKER LIMITED', L, 30);
  doc.font('Helvetica').fontSize(10).fillColor('#ffd9de').text('PAY SUMMARY', L, 56);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#fff').text(`${first.periodLabel} - ${slips[slips.length - 1].periodLabel}`, L, 34, { width: W, align: 'right' });
  doc.rect(0, 92, doc.page.width, 4).fill('#F0AD14');
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(first.employee.name, L, 118);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`${first.employee.role || ''} · ${first.employee.department || ''}`, L, 136);

  let y = 170;
  const cols = [0, 0.4, 0.6, 0.8];
  const head = ['Month', 'Gross', 'Deductions', 'Net'];
  doc.rect(L, y - 6, W, 24).fill(SOFT);
  head.forEach((h, i) => doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(h, L + W * cols[i] + (i ? 0 : 8), y, { width: (i ? W * 0.2 : W * 0.4) - 10, align: i ? 'right' : 'left' }));
  y += 26;
  const tot = { g: 0, d: 0, n: 0 };
  slips.forEach((s) => {
    tot.g += s.gross; tot.d += s.totalDeductions; tot.n += s.net;
    const cells = [s.periodLabel, money(s.gross), money(s.totalDeductions), money(s.net)];
    cells.forEach((c, i) => doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(c, L + W * cols[i] + (i ? 0 : 8), y, { width: (i ? W * 0.2 : W * 0.4) - 10, align: i ? 'right' : 'left' }));
    y += 22;
    doc.moveTo(L, y - 5).lineTo(L + W, y - 5).strokeColor(LINE).lineWidth(0.5).stroke();
  });
  doc.rect(L, y, W, 28).fill(INK);
  ['Total', money(tot.g), money(tot.d), money(tot.n)].forEach((c, i) =>
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff').text(c, L + W * cols[i] + (i ? 0 : 8), y + 8, { width: (i ? W * 0.2 : W * 0.4) - 10, align: i ? 'right' : 'left' })
  );
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(first.cfg.footerNote || '', L, doc.page.height - 70, { width: W, align: 'center' });
}

// slips: array from payslipsFor(); writes a PDF into `stream`.
function renderPdf(slips, stream, { summary = true } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Payslip', Author: 'Rekker Limited' } });
  doc.pipe(stream);
  slips.forEach((s, i) => {
    if (i) doc.addPage();
    drawPayslip(doc, s);
  });
  if (summary && slips.length > 1) { doc.addPage(); drawSummary(doc, slips); }
  doc.end();
}

module.exports = { buildPayslip, payslipsFor, renderPdf, periodLabel };
