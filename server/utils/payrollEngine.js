// server/utils/payrollEngine.js
//
// Turns "what the accountant typed" into "what the payslip says".
//
// A template column has a TYPE (number / text / formula) and a KIND that says
// how it affects pay:
//   earning    - added to gross pay
//   deduction  - taken off net pay
//   info       - reference only (bank details, weekly overtime inputs, notes)
//   gross      - system column: sum of every earning column (or its own formula)
//   net        - system column: gross minus every deduction column
//
// Any cell can be overridden by hand (even a formula cell), and any numeric
// cell can hold a constant expression such as =1000+1000 (kept in `cellFormulas`).
const { evaluate, references, check } = require('./formula');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const hasValue = (v) => v !== null && v !== undefined && v !== '';

// Parses what a human typed into a numeric cell. Returns { value, expr }.
// "1,500" -> 1500; "=695+5000" -> 5695 (expr kept); "" -> null.
function parseCellInput(raw) {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw === 'number') return { value: round2(raw) };
  const s = String(raw).trim();
  if (s === '') return { value: null };
  if (s.startsWith('=')) {
    if (references(s).length) throw new Error('A cell expression can only use numbers. To use other columns, set a column formula in the template.');
    return { value: round2(evaluate(s, {})), expr: s };
  }
  const cleaned = s.replace(/[,\s]|KES|Ksh/gi, '');
  if (/^[0-9.+\-*/()%]+$/.test(cleaned) && /[+\-*/]/.test(cleaned.replace(/^-/, ''))) {
    return { value: round2(evaluate(cleaned, {})), expr: `=${cleaned}` };
  }
  if (!/^-?\d*\.?\d+$/.test(cleaned)) throw new Error(`"${s}" is not a number`);
  return { value: round2(parseFloat(cleaned)) };
}

// Orders formula columns so each is computed after the columns it needs.
function orderColumns(columns) {
  const active = columns.filter((c) => !c.archived);
  const byKey = new Map(active.map((c) => [c.key, c]));
  const deps = new Map();
  for (const c of active) {
    let d = [];
    if (c.type === 'formula' && c.formula) d = references(c.formula).filter((k) => byKey.has(k));
    if (c.kind === 'gross' && !c.formula) d = active.filter((x) => x.kind === 'earning').map((x) => x.key);
    if (c.kind === 'net' && !c.formula) d = active.filter((x) => x.kind === 'deduction' || x.kind === 'gross').map((x) => x.key);
    deps.set(c.key, d.filter((k) => k !== c.key));
  }
  const order = [];
  const state = new Map();
  const visit = (k, trail) => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) throw new Error(`Circular formula: ${[...trail, k].join(' -> ')}`);
    state.set(k, 1);
    for (const d of deps.get(k) || []) visit(d, [...trail, k]);
    state.set(k, 2);
    order.push(byKey.get(k));
  };
  active.forEach((c) => visit(c.key, []));
  return order;
}

// Validates a column list (used when the accountant saves the template).
function validateColumns(columns) {
  const errors = [];
  const keys = columns.map((c) => c.key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) errors.push(`Duplicate column key "${dup}"`);
  const active = columns.filter((c) => !c.archived);
  if (active.filter((c) => c.kind === 'gross').length !== 1) errors.push('The template needs exactly one Gross Pay column.');
  if (active.filter((c) => c.kind === 'net').length !== 1) errors.push('The template needs exactly one Net Pay column.');
  for (const c of active) {
    if (!c.label || !String(c.label).trim()) errors.push('Every column needs a name.');
    if (c.type === 'formula' || (c.formula && c.formula.trim())) {
      const err = check(c.formula || '', active.map((x) => x.key));
      if (err) errors.push(`${c.label}: ${err}`);
    }
    if (c.type === 'formula' && !(c.formula && c.formula.trim())) errors.push(`${c.label}: add a formula or change the column type.`);
  }
  if (!errors.length) {
    try { orderColumns(columns); } catch (e) { errors.push(e.message); }
  }
  return errors;
}

// values: what was typed/imported, keyed by column key.
// Returns { computed, gross, net, totalDeductions }
function computeEntry(columns, values = {}, cellFormulas = {}) {
  const order = orderColumns(columns);
  const computed = {};
  const get = (k) => (typeof computed[k] === 'number' ? computed[k] : 0);

  for (const c of order) {
    const typed = values[c.key];
    if (c.type === 'text') { computed[c.key] = hasValue(typed) ? String(typed) : ''; continue; }

    let v;
    if (hasValue(typed)) {
      v = toNumber(typed); // typed value, or a manual override of a formula
    } else if (c.kind === 'gross' && !c.formula) {
      v = columns.filter((x) => !x.archived && x.kind === 'earning').reduce((s, x) => s + get(x.key), 0);
    } else if (c.kind === 'net' && !c.formula) {
      const g = columns.find((x) => !x.archived && x.kind === 'gross');
      v = get(g.key) - columns.filter((x) => !x.archived && x.kind === 'deduction').reduce((s, x) => s + get(x.key), 0);
    } else if (c.formula && c.formula.trim()) {
      v = evaluate(c.formula, computed);
    } else {
      v = 0;
    }
    computed[c.key] = round2(v);
  }

  const gk = columns.find((x) => !x.archived && x.kind === 'gross');
  const nk = columns.find((x) => !x.archived && x.kind === 'net');
  const gross = gk ? computed[gk.key] || 0 : 0;
  const net = nk ? computed[nk.key] || 0 : 0;
  return { computed, gross, net, totalDeductions: round2(gross - net) };
}

const slugify = (label) =>
  String(label || 'column')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'c_$1') || 'column';

module.exports = { computeEntry, orderColumns, validateColumns, parseCellInput, toNumber, round2, slugify, hasValue };
