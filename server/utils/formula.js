// server/utils/formula.js
//
// A small, safe formula engine for payroll columns. It never uses eval():
// formulas are tokenised and parsed by hand, then evaluated against a map of
// column keys -> numbers.
//
// Supported:
//   numbers            1000   2.5   15%   (15% = 0.15)
//   operators          +  -  *  /  and parentheses, unary minus
//   comparisons        >  <  >=  <=  ==  !=   (used inside IF)
//   functions          IF(cond, a, b)  MIN(..)  MAX(..)  SUM(..)  ROUND(x, n)
//                      ABS(x)  FLOOR(x)  CEIL(x)
//   references         column keys, e.g.  basic_salary * 0.0275
//
// Division by zero yields 0 rather than an error, so one empty cell can never
// break a whole payroll run.

class FormulaError extends Error {}

const FUNCS = {
  if: (a) => (a[0] ? a[1] : a[2] === undefined ? 0 : a[2]),
  min: (a) => (a.length ? Math.min(...a) : 0),
  max: (a) => (a.length ? Math.max(...a) : 0),
  sum: (a) => a.reduce((s, v) => s + v, 0),
  round: (a) => {
    const f = Math.pow(10, a[1] || 0);
    return Math.round((a[0] + Number.EPSILON) * f) / f;
  },
  abs: (a) => Math.abs(a[0]),
  floor: (a) => Math.floor(a[0]),
  ceil: (a) => Math.ceil(a[0]),
};

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = String(src).replace(/^\s*=/, '');
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      if (!/^\d*\.?\d+$|^\d+\.?$/.test(raw)) throw new FormulaError(`Bad number "${s.slice(i, j)}"`);
      tokens.push({ t: 'num', v: parseFloat(raw) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      tokens.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '<>'].includes(two)) {
      tokens.push({ t: 'op', v: two === '<>' ? '!=' : two });
      i += 2;
      continue;
    }
    if ('+-*/(),<>%='.includes(ch)) {
      tokens.push({ t: 'op', v: ch === '=' ? '==' : ch });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected character "${ch}"`);
  }
  return tokens;
}

// Recursive-descent parser -> AST
function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v) => {
    const t = toks[p];
    if (!t || (v && t.v !== v)) throw new FormulaError(v ? `Expected "${v}"` : 'Unexpected end of formula');
    p++;
    return t;
  };
  const isOp = (...vs) => peek() && peek().t === 'op' && vs.includes(peek().v);

  function comparison() {
    let left = additive();
    while (isOp('>', '<', '>=', '<=', '==', '!=')) {
      const op = eat().v;
      left = { k: 'bin', op, l: left, r: additive() };
    }
    return left;
  }
  function additive() {
    let left = term();
    while (isOp('+', '-')) {
      const op = eat().v;
      left = { k: 'bin', op, l: left, r: term() };
    }
    return left;
  }
  function term() {
    let left = unary();
    while (isOp('*', '/')) {
      const op = eat().v;
      left = { k: 'bin', op, l: left, r: unary() };
    }
    return left;
  }
  function unary() {
    if (isOp('-')) { eat(); return { k: 'neg', v: unary() }; }
    if (isOp('+')) { eat(); return unary(); }
    return postfix();
  }
  function postfix() {
    let n = primary();
    while (isOp('%')) { eat(); n = { k: 'bin', op: '/', l: n, r: { k: 'num', v: 100 } }; }
    return n;
  }
  function primary() {
    const t = peek();
    if (!t) throw new FormulaError('Unexpected end of formula');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === 'id') {
      p++;
      if (isOp('(')) {
        if (!FUNCS[t.v]) throw new FormulaError(`Unknown function ${t.v.toUpperCase()}`);
        eat('(');
        const args = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) { eat(); args.push(comparison()); }
        }
        eat(')');
        return { k: 'fn', name: t.v, args };
      }
      return { k: 'ref', name: t.v };
    }
    if (isOp('(')) { eat(); const e = comparison(); eat(')'); return e; }
    throw new FormulaError(`Unexpected "${t.v}"`);
  }

  if (!toks.length) throw new FormulaError('Formula is empty');
  const ast = comparison();
  if (p < toks.length) throw new FormulaError(`Unexpected "${toks[p].v}"`);
  return ast;
}

function refsOf(ast, out = new Set()) {
  if (!ast) return out;
  if (ast.k === 'ref') out.add(ast.name);
  else if (ast.k === 'bin') { refsOf(ast.l, out); refsOf(ast.r, out); }
  else if (ast.k === 'neg') refsOf(ast.v, out);
  else if (ast.k === 'fn') ast.args.forEach((a) => refsOf(a, out));
  return out;
}

function run(ast, get) {
  switch (ast.k) {
    case 'num': return ast.v;
    case 'ref': return Number(get(ast.name)) || 0;
    case 'neg': return -run(ast.v, get);
    case 'fn': return FUNCS[ast.name](ast.args.map((a) => run(a, get)));
    case 'bin': {
      const a = run(ast.l, get);
      const b = run(ast.r, get);
      switch (ast.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? 0 : a / b;
        case '>': return a > b ? 1 : 0;
        case '<': return a < b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
        default: throw new FormulaError('Bad operator');
      }
    }
    default: throw new FormulaError('Bad expression');
  }
}

const cache = new Map();
function compile(src) {
  const key = String(src);
  if (!cache.has(key)) {
    if (cache.size > 500) cache.clear();
    const ast = parse(key);
    cache.set(key, { ast, refs: refsOf(ast) });
  }
  return cache.get(key);
}

// evaluate('basic*0.1', { basic: 25000 }) -> 2500
function evaluate(src, vars = {}) {
  const { ast } = compile(src);
  const out = run(ast, (name) => vars[name]);
  return Number.isFinite(out) ? out : 0;
}

function references(src) {
  return [...compile(src).refs];
}

// Returns null when valid, otherwise a human-readable error.
function check(src, knownKeys) {
  try {
    const refs = references(src);
    if (knownKeys) {
      const unknown = refs.filter((r) => !knownKeys.includes(r));
      if (unknown.length) return `Unknown column: ${unknown.join(', ')}`;
    }
    return null;
  } catch (e) {
    return e.message;
  }
}

module.exports = { evaluate, references, check, compile, FormulaError };
