// server/utils/importPayrollHistory.js
// Loads every month-sheet of the Jan-Sep 2026 payroll workbook into the
// payroll module (as Paid, locked runs).
//
//   npm run seed:payroll                      imports data/PAYROLL_2026_1.xlsx
//   npm run seed:payroll -- path/to/file.xlsx imports another workbook
//   npm run seed:payroll -- --reset           first deletes any existing runs for
//                                             the months in the file, then imports
//
// People on the sheets who aren't in the system yet (store, shop, Bellagio,
// Saffron/Cornells staff, the directors) are created as employees with no
// login. Safe to re-run with --reset.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const PayrollRun = require('../models/PayrollRun');
const PayrollEntry = require('../models/PayrollEntry');
const imp = require('../services/payrollImport');
const svc = require('../services/payrollService');

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const file = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'data', 'PAYROLL_2026_1.xlsx');

(async () => {
  await connectDB();
  await svc.getTemplate('End-Month');
  await svc.getTemplate('Mid-Month');
  const wb = await imp.loadWorkbook(file);

  if (reset) {
    for (const ws of wb.worksheets) {
      const period = imp.guessPeriod(ws);
      if (!period) continue;
      const del = await PayrollEntry.deleteMany({ period, runType: 'End-Month' });
      const run = await PayrollRun.deleteOne({ period, runType: 'End-Month' });
      if (del.deletedCount || run.deletedCount) console.log(`Reset ${period}: removed ${del.deletedCount} rows`);
    }
  }

  const systemUser = { _id: null, name: 'Payroll import script', role: 'admin' };
  const results = await imp.importWorkbookAuto(wb, { runType: 'End-Month', status: 'Paid', source: path.basename(file) }, systemUser);

  console.log('\nSheet                Month    Rows  New staff');
  for (const r of results) {
    console.log(`${String(r.sheet).padEnd(20)} ${String(r.period || '-').padEnd(8)} ${String(r.imported ?? '-').padStart(4)}  ${String(r.createdEmployees ? r.createdEmployees.length : '-').padStart(5)}  ${r.error || r.skipped || ''}`);
  }
  const created = [...new Set(results.flatMap((r) => r.createdEmployees || []))];
  if (created.length) console.log(`\nAdded ${created.length} employees from payroll (no logins):\n  ${created.join(', ')}`);
  const warns = results.flatMap((r) => (r.warnings || []).map((w) => `${r.sheet}: ${w}`));
  if (warns.length) console.log(`\nWarnings (${warns.length}):\n  ${warns.slice(0, 40).join('\n  ')}`);
  await mongoose.connection.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
