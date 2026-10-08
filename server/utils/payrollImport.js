// server/utils/payrollImport.js
//
// Parses the two real payroll spreadsheet shapes Rekker actually uses, and
// fuzzy-matches each row's name against existing Employee records so the
// import preview can show a best guess while still letting a human (who
// actually knows the staff) confirm or correct every row before anything
// is written to the database.
const ExcelJS = require('exceljs');
const Employee = require('../models/Employee');

// --- Name matching -----------------------------------------------------

const normalize = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Scores how well a raw spreadsheet name matches one employee record.
// Exact full-name match scores highest; any shared word (a first name, a
// surname, or a branch/shop tag riding along with the name, e.g. "DAN
// CORNELS") scores lower but is still offered as a candidate.
function scoreMatch(rawName, employee) {
  const raw = normalize(rawName);
  const full = normalize(`${employee.firstName} ${employee.lastName}`);
  if (!raw || !full) return 0;
  if (raw === full) return 100;

  const rawTokens = raw.split(' ');
  const empTokens = full.split(' ');
  if (rawTokens[0] === empTokens[0] && rawTokens.includes(empTokens[empTokens.length - 1])) return 90;
  if (rawTokens[0] === empTokens[0] || rawTokens.includes(empTokens[empTokens.length - 1])) return 60;
  const shared = rawTokens.filter((t) => empTokens.includes(t));
  if (shared.length) return 30 + shared.length * 5;
  return 0;
}

async function matchEmployee(rawName) {
  const employees = await Employee.find().select('firstName lastName department role employeeId');
  const scored = employees
    .map((e) => ({ employee: e, score: scoreMatch(rawName, e) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  return {
    matchedEmployeeId: best && best.score >= 90 ? best.employee._id : null,
    confidence: best ? (best.score >= 90 ? 'high' : best.score >= 60 ? 'medium' : 'low') : 'none',
    candidates: scored.slice(0, 4).map((s) => ({
      employeeId: s.employee._id,
      name: `${s.employee.firstName} ${s.employee.lastName}`,
      department: s.employee.department,
      score: s.score,
    })),
  };
}

// --- Sheet readers -------------------------------------------------------

async function loadWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

const cellText = (cell) => (cell && cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '');
const cellNum = (cell) => {
  const v = cell ? cell.value : null;
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'object' && v.result !== undefined ? v.result : v;
  const parsed = Number(n);
  return Number.isNaN(parsed) ? 0 : parsed;
};

// Rekker's full end-month payroll sheet: a header row containing "STAFF",
// a run of daily overtime columns, then OVERTIME / BASIC SALARY /
// LUNCH/TRANSPORT / GROSS PAY / ADVANCE / NET PAY totals. The exact number
// of daily columns differs month to month (different days in the month),
// so columns are found by matching header text, never by fixed letter.
async function parseEndMonthSheet(filePath, sheetName) {
  const workbook = await loadWorkbook(filePath);
  const sheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];
  if (!sheet) throw new Error('Could not find a sheet to read in that file');

  // Find the header row: the row containing a cell that says "STAFF".
  let headerRow = null;
  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
    const row = sheet.getRow(r);
    if (row.values.some((v) => String(v || '').trim().toUpperCase() === 'STAFF')) {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) throw new Error('Could not find a "STAFF" column header in this sheet');

  const aboveRow = sheet.getRow(headerRow - 1);
  const row = sheet.getRow(headerRow);
  const colOf = (...labels) => {
    for (let c = 1; c <= sheet.columnCount; c++) {
      const text = (cellText(row.getCell(c)) || cellText(aboveRow.getCell(c))).toUpperCase();
      if (labels.some((label) => text === label)) return c;
    }
    return null;
  };

  const nameCol = colOf('STAFF', 'NAME');
  const overtimeCol = colOf('OVERTIME');
  const basicCol = colOf('BASIC SALARY', 'BASIC');
  const lunchTransportCol = colOf('LUNCH/TRANSPORT', 'LUNCH / TRANSPORT');
  const advanceCol = colOf('ADVANCE');
  if (!nameCol || !basicCol) {
    throw new Error('Could not find expected columns (STAFF, BASIC SALARY) in this sheet');
  }

  const rows = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const dataRow = sheet.getRow(r);
    const rawName = cellText(dataRow.getCell(nameCol));
    if (!rawName) continue;

    const basicSalary = cellNum(dataRow.getCell(basicCol));
    const overtimeAmount = overtimeCol ? cellNum(dataRow.getCell(overtimeCol)) : 0;
    const lunchTransport = lunchTransportCol ? cellNum(dataRow.getCell(lunchTransportCol)) : 0;
    const advance = advanceCol ? cellNum(dataRow.getCell(advanceCol)) : 0;

    const match = await matchEmployee(rawName);
    rows.push({
      rawName,
      basicSalary,
      overtimeAmount,
      allowances: lunchTransport ? [{ name: 'Lunch/Transport', amount: lunchTransport }] : [],
      deductions: advance ? [{ name: 'Advance', amount: advance }] : [],
      ...match,
    });
  }
  return rows;
}

// Rekker's mid-month sheet: NAME, first-half amount, second-half amount,
// TOTAL, and an optional free-text note about what was purchased.
async function parseMidMonthSheet(filePath, sheetName) {
  const workbook = await loadWorkbook(filePath);
  const sheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];
  if (!sheet) throw new Error('Could not find a sheet to read in that file');

  const header = sheet.getRow(1);
  const period1Label = cellText(header.getCell(2)) || 'First half';
  const period2Label = cellText(header.getCell(3)) || 'Second half';

  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const dataRow = sheet.getRow(r);
    const rawName = cellText(dataRow.getCell(1));
    if (!rawName || ['TOTAL', 'TOTAL EXPENSES', 'TRAN'].includes(rawName.toUpperCase())) continue;

    const firstHalf = cellNum(dataRow.getCell(2));
    const secondHalf = cellNum(dataRow.getCell(3));
    const notes = cellText(dataRow.getCell(5));

    const match = await matchEmployee(rawName);
    rows.push({
      rawName,
      expenseReimbursements: [
        ...(firstHalf ? [{ description: period1Label, amount: firstHalf }] : []),
        ...(secondHalf ? [{ description: period2Label, amount: secondHalf }] : []),
      ],
      notes: notes || undefined,
      ...match,
    });
  }
  return rows;
}

async function listSheetNames(filePath) {
  const workbook = await loadWorkbook(filePath);
  return workbook.worksheets.map((ws) => ws.name);
}

module.exports = { parseEndMonthSheet, parseMidMonthSheet, listSheetNames, matchEmployee };
