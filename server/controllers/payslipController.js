// server/controllers/payslipController.js
// Employee-facing payslips. Everyone sees ONLY their own; payroll roles may
// pass ?employee=<id> to view someone else's.
const asyncHandler = require('express-async-handler');
const PayrollEntry = require('../models/PayrollEntry');
const PayrollRun = require('../models/PayrollRun');
const slip = require('../services/payslip');
const { PAYROLL_VIEW_ROLES, PAYROLL_MANAGE_ROLES } = require('../config/roles');
const { loadAccountOwners, foreignAccountOwners } = require('../utils/payrollLinks');

// Who's payslips to show. `self` is true when the person is looking at their
// OWN payslips (everyone, always, unless a payroll role explicitly asks for
// someone else). Self views get a safety check, see foreignRow().
function targetEmployee(req, res) {
  const own = req.user.employee && req.user.employee._id;
  const asked = req.query.employee;
  if (asked && PAYROLL_VIEW_ROLES.includes(req.user.role)) {
    // ?simulate=1 (used by the admin's "what does this login see" view) applies
    // the same safety check the employee's own view gets.
    return { id: asked, self: req.query.simulate === '1' || (!!own && String(asked) === String(own)) };
  }
  if (!own) { res.status(404); throw new Error('Your account is not linked to an employee record, so there are no payslips to show.'); }
  return { id: own, self: true };
}

// Safety net: a payroll row whose bank account belongs to a DIFFERENT employee
// is misfiled (e.g. imported onto the wrong one of two people with the same
// name). Never show it to the person it is filed under - an admin sees it
// flagged in Payroll Links and can fix it.
async function foreignRow(entry, employeeId, owners) {
  const bad = foreignAccountOwners(entry, employeeId, owners);
  if (bad) console.warn(`[payslips] withheld ${entry.period} ${entry.runType} from employee ${employeeId}: row pays an account owned by ${bad.join(',')}`);
  return !!bad;
}

// Which payslips exist for me, newest first, plus the default (latest salary month).
const mine = asyncHandler(async (req, res) => {
  const { id: employee, self } = targetEmployee(req, res);
  let entries = await PayrollEntry.find({ employee }).sort({ period: -1 }).lean();
  if (self) {
    const owners = await loadAccountOwners();
    const keep = [];
    for (const e of entries) if (!(await foreignRow(e, employee, owners))) keep.push(e);
    entries = keep;
  }
  const runs = await PayrollRun.find({ period: { $in: [...new Set(entries.map((e) => e.period))] } }).select('period runType status').lean();
  const status = Object.fromEntries(runs.map((r) => [`${r.period}|${r.runType}`, r.status]));
  const list = entries
    .filter((e) => status[`${e.period}|${e.runType}`] && status[`${e.period}|${e.runType}`] !== 'Draft')
    .map((e) => ({ period: e.period, runType: e.runType, gross: e.gross, net: e.net, totalDeductions: e.totalDeductions, status: status[`${e.period}|${e.runType}`] }));
  const latest = list.find((l) => l.runType === 'End-Month') || list[0] || null;
  res.json({ latest: latest && latest.period, payslips: list });
});

// One payslip as JSON (for the on-screen card)
const data = asyncHandler(async (req, res) => {
  const { id: employee, self } = targetEmployee(req, res);
  const { period, runType = 'End-Month' } = req.query;
  const draft = PAYROLL_MANAGE_ROLES.includes(req.user.role) && req.query.draft === '1';
  const slips = await slip.payslipsFor({ employeeId: employee, from: period, to: period, runType, includeDrafts: draft, guard: self });
  if (!slips.length) { res.status(404); throw new Error('No payslip for that period yet.'); }
  res.json(slips[0]);
});

// PDF for one month or a range. Defaults to the latest approved salary month.
const pdf = asyncHandler(async (req, res) => {
  const { id: employee, self } = targetEmployee(req, res);
  let { from, to, runType = 'End-Month' } = req.query;
  const draft = PAYROLL_MANAGE_ROLES.includes(req.user.role) && req.query.draft === '1';
  if (!from) {
    const entries = await PayrollEntry.find({ employee, runType }).sort({ period: -1 }).lean();
    const owners = self ? await loadAccountOwners() : null;
    for (const e of entries) {
      if (self && (await foreignRow(e, employee, owners))) continue;
      const run = await PayrollRun.findOne({ period: e.period, runType });
      if (run && (draft || run.status !== 'Draft')) { from = e.period; break; }
    }
    if (!from) { res.status(404); throw new Error('No payslips available yet.'); }
  }
  to = to || from;
  if (to < from) [from, to] = [to, from];
  const types = runType === 'both' ? ['End-Month', 'Mid-Month'] : [runType];
  let slips = [];
  for (const t of types) slips = slips.concat(await slip.payslipsFor({ employeeId: employee, from, to, runType: t, includeDrafts: draft, guard: self }));
  slips.sort((a, b) => a.period.localeCompare(b.period) || a.runType.localeCompare(b.runType));
  if (!slips.length) { res.status(404); throw new Error('No payslips found for that period.'); }
  const name = slips[0].employee.name.replace(/[^A-Za-z0-9]+/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="Payslip-${name}-${from}${to !== from ? `-to-${to}` : ''}.pdf"`);
  slip.renderPdf(slips, res);
});

module.exports = { mine, data, pdf };
