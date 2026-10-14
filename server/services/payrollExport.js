// server/services/payrollExport.js
// Excel exports: the payroll sheet in template layout (with live formulas, so
// it keeps working if the accountant edits it), the bank payment schedule, and
// the year summary.
const ExcelJS = require('exceljs');
const PayrollEntry = require('../models/PayrollEntry');
const svc = require('./payrollService');
const { periodLabel } = require('./payslip');

const colLetter = (n) => {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
const MONEY = '#,##0.00;-#,##0.00;"-"';
const RED = 'FFD60821';

// formula text (column keys) -> Excel formula for one row
function toExcel(formula, letterOf, row) {
  return String(formula)
    .replace(/^\s*=/, '')
    .replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id, off, str) => {
      const after = str.slice(off + id.length).trimStart()[0];
      if (after === '(') return id.toUpperCase();
      const l = letterOf[id.toLowerCase()];
      return l ? `${l}${row}` : '0';
    })
    .replace(/==/g, '=')
    .replace(/!=/g, '<>');
}

async function exportRunXlsx(period, runType) {
  const { run, columns, entries } = await svc.loadRun(period, runType);
  const active = columns.filter((c) => !c.archived);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rekker HR';
  const ws = wb.addWorksheet(periodLabel(period).toUpperCase(), { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });

  const firstCol = 3;
  const letterOf = {};
  active.forEach((c, i) => { letterOf[c.key] = colLetter(firstCol + i); });
  const lastLetter = colLetter(firstCol + active.length - 1);

  ws.getCell('A1').value = 'REKKER LIMITED';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: RED } };
  ws.getCell('A2').value = `${periodLabel(period)} - ${runType === 'Mid-Month' ? 'MID-MONTH' : 'PAYROLL'}`;
  ws.getCell('A2').font = { bold: true };

  // band row (3) and header row (4)
  ws.getCell(4, 1).value = 'NO.';
  ws.getCell(4, 2).value = 'STAFF';
  active.forEach((c, i) => {
    ws.getCell(4, firstCol + i).value = c.label;
    ws.getCell(3, firstCol + i).value = c.group || null;
    ws.getColumn(firstCol + i).width = c.type === 'text' ? 18 : 14;
  });
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  [3, 4].forEach((r) => ws.getRow(r).eachCell((cell) => { cell.font = { bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }));
  ws.getRow(4).eachCell({ includeEmpty: true }, (cell, n) => {
    if (n > firstCol + active.length - 1) return;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } };
    cell.border = { bottom: { style: 'medium', color: { argb: RED } } };
  });

  const grossCol = active.find((c) => c.kind === 'gross');
  const sectionOrder = [];
  entries.forEach((e) => { if (!sectionOrder.includes(e.section || '')) sectionOrder.push(e.section || ''); });

  let r = 5;
  let n = 0;
  const subtotalRows = [];
  const numericTotals = active.filter((c) => c.type !== 'text' && c.inTotals !== false);

  for (const sec of sectionOrder) {
    if (sec) {
      ws.getCell(r, 1).value = sec.toUpperCase();
      ws.getCell(r, 1).font = { bold: true, color: { argb: RED } };
      r++;
    }
    const start = r;
    for (const e of entries.filter((x) => (x.section || '') === sec)) {
      ws.getCell(r, 1).value = ++n;
      ws.getCell(r, 2).value = (e.payrollName || (e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '')).toUpperCase();
      active.forEach((c, i) => {
        const cell = ws.getCell(r, firstCol + i);
        const typed = e.values && e.values[c.key];
        const hasTyped = typed !== undefined && typed !== null && typed !== '';
        if (c.type === 'text') { cell.value = e.computed[c.key] || null; return; }
        cell.numFmt = MONEY;
        if (hasTyped) { cell.value = e.cellFormulas && e.cellFormulas[c.key] ? { formula: e.cellFormulas[c.key].replace(/^=/, ''), result: Number(typed) } : Number(typed); return; }
        let f = null;
        if (c.kind === 'gross' && !c.formula) f = active.filter((x) => x.kind === 'earning').map((x) => `${letterOf[x.key]}${r}`).join('+') || '0';
        else if (c.kind === 'net' && !c.formula) f = `${letterOf[grossCol.key]}${r}${active.filter((x) => x.kind === 'deduction').map((x) => `-${letterOf[x.key]}${r}`).join('')}`;
        else if (c.formula) f = toExcel(c.formula, letterOf, r);
        cell.value = f ? { formula: f, result: e.computed[c.key] || 0 } : null;
      });
      r++;
    }
    if (sec || sectionOrder.length > 1) {
      ws.getCell(r, 2).value = `${(sec || 'OTHER').toUpperCase()} TOTAL`;
      ws.getCell(r, 2).font = { bold: true };
      numericTotals.forEach((c) => {
        const l = letterOf[c.key];
        const cell = ws.getCell(r, firstCol + active.indexOf(c));
        cell.value = { formula: `SUM(${l}${start}:${l}${r - 1})` };
        cell.numFmt = MONEY;
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' } };
      });
      subtotalRows.push(r);
      r += 2;
    }
  }
  // grand total
  ws.getCell(r, 2).value = 'GROSS TOTALS';
  ws.getCell(r, 2).font = { bold: true, color: { argb: RED } };
  numericTotals.forEach((c) => {
    const l = letterOf[c.key];
    const cell = ws.getCell(r, firstCol + active.indexOf(c));
    cell.value = subtotalRows.length ? { formula: subtotalRows.map((x) => `${l}${x}`).join('+') } : { formula: `SUM(${l}5:${l}${r - 1})` };
    cell.numFmt = MONEY;
    cell.font = { bold: true, color: { argb: RED } };
    cell.border = { top: { style: 'medium', color: { argb: RED } } };
  });
  ws.autoFilter = undefined;
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return wb.xlsx.writeBuffer();
}

async function bankSchedule(period, runType) {
  const { entries } = await svc.loadRun(period, runType);
  const rows = entries
    .filter((e) => e.net > 0)
    .map((e) => ({
      name: e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '',
      bank: (e.computed && e.computed.acc_type) || (e.employee && e.employee.bankName) || 'UNSPECIFIED',
      account: (e.computed && e.computed.acc_no) || (e.employee && e.employee.bankAccount) || '',
      net: e.net,
    }))
    .sort((a, b) => a.bank.localeCompare(b.bank) || a.name.localeCompare(b.name));
  return rows;
}

async function exportBankXlsx(period, runType) {
  const rows = await bankSchedule(period, runType);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payment schedule');
  ws.addRow([`REKKER LIMITED - ${runType} payment schedule - ${periodLabel(period)}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const h = ws.addRow(['BANK / CHANNEL', 'ACCOUNT NO', 'NAME', 'AMOUNT (KES)']);
  h.font = { bold: true };
  h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } }; });
  let bank = null;
  let start = 4;
  const subs = [];
  const flush = (endRow) => {
    if (bank === null) return;
    const t = ws.addRow([`${bank} total`, '', '', { formula: `SUM(D${start}:D${endRow})` }]);
    t.font = { bold: true };
    t.getCell(4).numFmt = MONEY;
    subs.push(t.number);
    ws.addRow([]);
  };
  for (const r of rows) {
    if (r.bank !== bank) { flush(ws.rowCount); bank = r.bank; start = ws.rowCount + 1; }
    const x = ws.addRow([r.bank, String(r.account), r.name.toUpperCase(), r.net]);
    x.getCell(4).numFmt = MONEY;
  }
  flush(ws.rowCount);
  const g = ws.addRow(['TOTAL TO PAY', '', '', subs.length ? { formula: subs.map((s) => `D${s}`).join('+') } : 0]);
  g.font = { bold: true, color: { argb: RED } };
  g.getCell(4).numFmt = MONEY;
  [22, 24, 32, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return wb.xlsx.writeBuffer();
}

async function yearSummary({ year, runType = 'End-Month' }) {
  const template = await svc.getTemplate(runType);
  const entries = await PayrollEntry.find({ runType, period: new RegExp(`^${year}-`) }).lean();
  const runs = await svc.listRuns({ year, runType });
  const statusOf = Object.fromEntries(runs.map((r) => [r.period, r.status]));
  const cols = template.columns.filter((c) => !c.archived && c.type !== 'text').map((c) => ({ key: c.key, label: c.label, kind: c.kind, group: c.group }));
  const periods = {};
  const sections = {};
  for (const e of entries) {
    const p = (periods[e.period] = periods[e.period] || { period: e.period, status: statusOf[e.period], count: 0, gross: 0, net: 0, totalDeductions: 0, columns: {} });
    p.count++; p.gross += e.gross; p.net += e.net; p.totalDeductions += e.totalDeductions;
    for (const c of cols) p.columns[c.key] = (p.columns[c.key] || 0) + (Number(e.computed && e.computed[c.key]) || 0);
    const s = (sections[e.section || 'Other'] = sections[e.section || 'Other'] || {});
    const sp = (s[e.period] = s[e.period] || { count: 0, gross: 0, net: 0 });
    sp.count++; sp.gross += e.gross; sp.net += e.net;
  }
  return { year, runType, columns: cols, periods: Object.values(periods).sort((a, b) => a.period.localeCompare(b.period)), sections };
}

async function exportYearXlsx({ year, runType }) {
  const s = await yearSummary({ year, runType });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${runType} ${year}`);
  ws.addRow([`REKKER LIMITED - ${runType} payroll summary ${year}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const head = ws.addRow(['', ...s.periods.map((p) => periodLabel(p.period)), 'TOTAL']);
  head.font = { bold: true };
  const add = (label, get, bold) => {
    const row = ws.addRow([label, ...s.periods.map(get), { formula: `SUM(B${ws.rowCount + 1}:${colLetter(s.periods.length + 1)}${ws.rowCount + 1})` }]);
    row.eachCell((c, n) => { if (n > 1) c.numFmt = MONEY; });
    if (bold) row.font = { bold: true };
  };
  add('Staff paid', (p) => p.count);
  s.columns.forEach((c) => add(c.label, (p) => p.columns[c.key] || 0, c.kind === 'gross' || c.kind === 'net'));
  ws.getColumn(1).width = 28;
  for (let i = 2; i <= s.periods.length + 2; i++) ws.getColumn(i).width = 16;
  return wb.xlsx.writeBuffer();
}

module.exports = { exportRunXlsx, exportBankXlsx, bankSchedule, yearSummary, exportYearXlsx };
