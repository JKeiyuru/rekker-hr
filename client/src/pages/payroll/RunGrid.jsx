// client/src/pages/payroll/RunGrid.jsx
// The payroll sheet itself: one row per employee, one column per template
// column. Behaves like Excel - click a cell, type, press Enter to drop down,
// paste a block of cells from a spreadsheet, type =1000+500 for a quick sum.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, CheckCircle2, ChevronDown, ChevronRight, Columns3, Download, FileSpreadsheet, FileText, MoreHorizontal,
  Plus, RefreshCw, Search, Trash2, Undo2, Upload, UserPlus, Wallet, Users as UsersIcon, TrendingDown, Coins,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Drawer from '../../components/Drawer';
import StatCard from '../../components/StatCard';
import { EmptyState, Spinner } from '../../components/Feedback';
import { Field, Select, TextInput } from '../../components/Fields';
import { errMsg, fetchFile, money, periodLabel } from './shared';

const fmtCell = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('en-KE', { maximumFractionDigits: 2 }));

function Cell({ entry, col, r, c, editable, onSave }) {
  const typed = entry.values?.[col.key];
  const hasTyped = typed !== undefined && typed !== null && typed !== '';
  const computed = entry.computed?.[col.key];
  const expr = entry.cellFormulas?.[col.key];
  const isCalc = col.type === 'formula' || col.kind === 'gross' || col.kind === 'net';
  const isText = col.type === 'text';
  const shown = isText ? computed || '' : isCalc ? (hasTyped ? typed : computed) : typed;
  const initial = isText ? String(shown || '') : expr || (shown === undefined || shown === null || shown === '' ? '' : String(shown));
  const [draft, setDraft] = useState(null);
  const strong = col.kind === 'gross' || col.kind === 'net';

  const commit = () => {
    if (draft !== null && draft.trim() !== initial.trim()) {
      // calculated cell reset to its computed value = clear the override
      onSave(entry, col.key, draft.trim() === String(computed) && isCalc ? '' : draft);
    }
    setDraft(null);
  };

  if (!editable) {
    return <span className={`block px-2.5 py-2 whitespace-nowrap ${isText ? 'text-left' : 'text-right tabular-nums'} ${strong ? 'font-semibold' : ''}`}>{isText ? shown : isCalc && !hasTyped && !strong && Number(shown) === 0 ? '' : fmtCell(shown)}</span>;
  }
  return (
    <div className="relative">
      <input
        data-cell={`${r}:${c}`}
        data-r={r}
        data-c={c}
        value={draft !== null ? draft : isText ? String(shown || '') : isCalc && !hasTyped && !strong && Number(shown) === 0 ? '' : fmtCell(shown)}
        title={expr ? `Typed as ${expr}` : isCalc && !hasTyped ? 'Calculated. Type a number to override it, clear the cell to go back to the formula.' : undefined}
        onFocus={(e) => { setDraft(initial); requestAnimationFrame(() => e.target.select()); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          const move = (dr, dc = 0) => {
            const next = document.querySelector(`[data-cell="${r + dr}:${c + dc}"]`);
            if (next) { e.preventDefault(); next.focus(); }
          };
          if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); const n = document.querySelector(`[data-cell="${r + 1}:${c}"]`); n?.focus(); }
          else if (e.key === 'ArrowDown') move(1);
          else if (e.key === 'ArrowUp') move(-1);
          else if (e.key === 'Escape') { setDraft(null); e.target.blur(); }
        }}
        className={`focus-ring w-full ${isText ? 'min-w-[150px]' : 'min-w-[84px]'} bg-transparent px-2.5 py-2 text-sm outline-none focus:bg-brand-yellow/10 focus:ring-1 focus:ring-inset focus:ring-brand-red/60 ${isText ? 'text-left' : 'text-right tabular-nums'} ${strong ? 'font-semibold' : ''} ${isCalc && !hasTyped ? 'text-muted' : 'text-ink'}`}
        inputMode={isText ? 'text' : 'decimal'}
      />
      {isCalc && hasTyped && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand-yellow" title="Manually set" />}
      {expr && !isCalc && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand-green" title={expr} />}
    </div>
  );
}

function AddStaffDrawer({ open, onClose, sections, existingIds, period, onAdd }) {
  const [staff, setStaff] = useState([]);
  const [q, setQ] = useState('');
  const [section, setSection] = useState(sections[0] || '');
  const [mode, setMode] = useState('existing');
  const [form, setForm] = useState({ name: '', bankName: '', bankAccount: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/payroll/staff').then((r) => setStaff(r.data));
      setSection((s) => s || sections[0] || '');
    }
  }, [open]);

  const list = staff
    .filter((s) => !existingIds.has(s._id))
    .filter((s) => `${s.firstName} ${s.lastName} ${s.department}`.toLowerCase().includes(q.toLowerCase()));

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/payroll/staff', { ...form, section, period });
      await onAdd(data._id, section);
      setForm({ name: '', bankName: '', bankAccount: '' });
      toast.success(`${data.firstName} ${data.lastName} added to the system and this run`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Add staff to this run" subtitle="Pick someone already in the system, or add a new person.">
      <Field label="Put them in group">
        <Select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">No group</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
      <div className="flex gap-1 rounded-full bg-surface2 p-1 mb-4">
        {[['existing', 'In the system'], ['new', 'New person']].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${mode === k ? 'bg-surface shadow-sm text-ink' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {mode === 'existing' ? (
        <>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or department" className="mb-3" autoFocus />
          <div className="space-y-1">
            {list.slice(0, 80).map((s) => (
              <button key={s._id} onClick={() => onAdd(s._id, section)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-surface2">
                <span>
                  <span className="block text-sm font-medium text-ink">{s.firstName} {s.lastName}</span>
                  <span className="block text-xs text-muted">{s.department} · {s.role}</span>
                </span>
                <Plus size={16} className="text-brand-red" />
              </button>
            ))}
            {list.length === 0 && <p className="text-sm text-muted py-6 text-center">Everyone matching is already in this run.</p>}
          </div>
        </>
      ) : (
        <form onSubmit={create}>
          <p className="text-sm text-muted mb-4">For people on payroll who don't use the system (store, shop, site staff). They get an employee record but no login.</p>
          <Field label="Full name" required><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Bank / channel"><TextInput value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="COOP, KCB, MPESA..." /></Field>
          <Field label="Account number"><TextInput value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></Field>
          <Button type="submit" loading={busy} icon={UserPlus} className="w-full">Add to system and run</Button>
        </form>
      )}
    </Drawer>
  );
}

export default function RunGrid({ period, runType, meta, onAddColumn, onImport, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const tableRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/payroll/runs/${period}/${runType}`).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [period, runType]);
  useEffect(load, [load, refreshKey]);

  const status = data?.run?.status;
  const editable = meta.canManage && status === 'Draft';
  const columns = useMemo(() => (data ? data.columns.filter((c) => !c.archived) : []), [data]);

  const replaceEntries = (list) => setData((d) => ({ ...d, entries: d.entries.map((e) => list.find((n) => n._id === e._id) || e) }));

  const saveCell = async (entry, key, raw) => {
    try {
      const { data: updated } = await api.patch(`/payroll/entries/${entry._id}`, { values: { [key]: raw } });
      replaceEntries([updated]);
    } catch (e) { toast.error(errMsg(e)); }
  };

  // sections in template order, then any others
  const groups = useMemo(() => {
    if (!data) return [];
    const order = data.template.sections || [];
    const filtered = data.entries.filter((e) => {
      const name = `${e.payrollName || ''} ${e.employee?.firstName || ''} ${e.employee?.lastName || ''}`.toLowerCase();
      return name.includes(q.toLowerCase());
    });
    const names = [...new Set([...order, ...filtered.map((e) => e.section || '')])];
    return names
      .map((name) => ({ name, rows: filtered.filter((e) => (e.section || '') === name) }))
      .filter((g) => g.rows.length);
  }, [data, q]);

  const flat = useMemo(() => groups.flatMap((g) => (collapsed[g.name] ? [] : g.rows)), [groups, collapsed]);
  const rowIndex = useMemo(() => Object.fromEntries(flat.map((e, i) => [e._id, i])), [flat]);

  const sumOf = (rows, col) => rows.reduce((s, e) => s + (Number(e.computed?.[col.key]) || 0), 0);

  // Paste a block from Excel
  const onPaste = async (ev) => {
    const cell = ev.target.closest?.('[data-cell]');
    const text = ev.clipboardData.getData('text');
    if (!cell || !editable || !/[\t\n]/.test(text.trim())) return;
    ev.preventDefault();
    const r0 = Number(cell.dataset.r);
    const c0 = Number(cell.dataset.c);
    const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1);
    const updates = [];
    lines.forEach((line, i) => {
      const entry = flat[r0 + i];
      if (!entry) return;
      const values = {};
      line.split('\t').forEach((v, j) => {
        const col = columns[c0 + j];
        if (!col || col.type === 'formula' || col.kind === 'gross' || col.kind === 'net') return;
        values[col.key] = v.trim();
      });
      if (Object.keys(values).length) updates.push({ id: entry._id, values });
    });
    if (!updates.length) return;
    try {
      const { data: res } = await api.patch('/payroll/entries/bulk', { updates });
      replaceEntries(res);
      toast.success(`Pasted into ${res.length} row${res.length === 1 ? '' : 's'}`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const startRun = async (prefill) => {
    try {
      const { data: r } = await api.post('/payroll/runs', { period, runType, prefill });
      toast.success(prefill === 'previous' ? `Run started with ${r.copied} staff carried forward` : 'Blank run started');
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const setStatus = async (to, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.put(`/payroll/runs/${period}/${runType}/status`, { status: to });
      toast.success(`Run ${to === 'Draft' ? 'reopened' : to.toLowerCase()}`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const addEntry = async (employee, section) => {
    try {
      const { data: e } = await api.post(`/payroll/runs/${period}/${runType}/entries`, { employee, section });
      setData((d) => ({ ...d, entries: [...d.entries, e] }));
    } catch (err) { toast.error(errMsg(err)); }
  };

  const removeRow = async (e) => {
    if (!window.confirm(`Remove ${e.employee?.firstName} ${e.employee?.lastName} from this run?`)) return;
    try {
      await api.delete(`/payroll/entries/${e._id}`);
      setData((d) => ({ ...d, entries: d.entries.filter((x) => x._id !== e._id) }));
    } catch (err) { toast.error(errMsg(err)); }
  };

  const moveRow = async (e, section) => {
    try {
      const { data: u } = await api.patch(`/payroll/entries/${e._id}`, { section });
      replaceEntries([u]);
    } catch (err) { toast.error(errMsg(err)); }
  };

  if (loading && !data) return <Spinner />;
  if (!data) return null;

  if (!data.run) {
    return (
      <div className="card">
        <EmptyState
          icon={Wallet}
          title={`No ${runType === 'Mid-Month' ? 'mid-month' : 'salary'} run for ${periodLabel(period)} yet`}
          description="Start from last month's staff list (basic salary, bank details and fixed deductions carry over), begin blank, or import an Excel file."
          action={
            meta.canManage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => startRun('previous')} icon={Plus}>Start from last month</Button>
                <Button variant="secondary" onClick={() => startRun('none')}>Start blank</Button>
                <Button variant="secondary" icon={Upload} onClick={onImport}>Import Excel</Button>
              </div>
            ) : null
          }
        />
      </div>
    );
  }

  const totals = {
    count: data.entries.length,
    gross: data.entries.reduce((s, e) => s + e.gross, 0),
    ded: data.entries.reduce((s, e) => s + e.totalDeductions, 0),
    net: data.entries.reduce((s, e) => s + e.net, 0),
  };
  const bands = [];
  columns.forEach((c) => {
    const last = bands[bands.length - 1];
    if (last && last.group === c.group) last.span++;
    else bands.push({ group: c.group, span: 1 });
  });
  const totalCols = columns.filter((c) => c.type !== 'text' && c.inTotals !== false);
  const existingIds = new Set(data.entries.map((e) => String(e.employee?._id)));

  const flow = [
    ['Draft', 'Draft'],
    ['Approved', 'Approved'],
    ['Paid', 'Paid'],
  ];

  return (
    <div onPaste={onPaste}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        <StatCard label="Staff paid" value={totals.count} icon={UsersIcon} />
        <StatCard label="Gross pay" value={money(totals.gross)} icon={Coins} tone="yellow" hint="KES" />
        <StatCard label="Deductions" value={money(totals.ded)} icon={TrendingDown} tone="red" hint="KES" />
        <StatCard label="Net pay" value={money(totals.net)} icon={Banknote} tone="green" hint="KES to be paid" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a name" className="focus-ring w-44 rounded-full border border-border bg-surface2/60 pl-9 pr-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface2 p-1" title="Run lifecycle">
          {flow.map(([s], i) => (
            <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>{i + 1}. {s}</span>
          ))}
        </div>
        {data.frozen && <Badge tone="neutral">Layout frozen</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editable && <Button size="sm" icon={UserPlus} onClick={() => setAddOpen(true)}>Add staff</Button>}
          {editable && <Button size="sm" variant="secondary" icon={Columns3} onClick={onAddColumn}>Add column</Button>}
          {meta.canManage && status === 'Draft' && <Button size="sm" variant="secondary" icon={Upload} onClick={onImport}>Import Excel</Button>}
          <div className="relative">
            <Button size="sm" variant="secondary" icon={Download} onClick={() => setExportOpen(!exportOpen)}>Export</Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-64 card p-1.5 shadow-floating animate-riseIn">
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-surface2" onClick={() => { setExportOpen(false); fetchFile(`/payroll/export/${period}/${runType}`); }}><FileSpreadsheet size={15} /> Payroll sheet (.xlsx)</button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-surface2" onClick={() => { setExportOpen(false); fetchFile(`/payroll/bank/${period}/${runType}`); }}><Banknote size={15} /> Payment schedule by bank (.xlsx)</button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-surface2" onClick={() => { setExportOpen(false); fetchFile(`/payroll/bank/${period}/${runType}`, { format: 'csv' }); }}><FileText size={15} /> Payment list (.csv)</button>
                </div>
              </>
            )}
          </div>
          {editable && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={async () => { await api.post(`/payroll/runs/${period}/${runType}/recalculate`); load(); toast.success('Recalculated'); }}>Recalculate</Button>}
          {meta.canApprove && status === 'Draft' && <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => setStatus('Approved', `Approve ${runType} ${periodLabel(period)}? Employees will be able to see their payslips and the layout is frozen.`)}>Approve run</Button>}
          {meta.canApprove && status === 'Approved' && <Button size="sm" variant="success" icon={Banknote} onClick={() => setStatus('Paid', 'Mark this run as paid?')}>Mark as paid</Button>}
          {meta.canApprove && status === 'Approved' && <Button size="sm" variant="secondary" icon={Undo2} onClick={() => setStatus('Draft', 'Reopen this run for editing? Employees will no longer see these payslips until it is approved again.')}>Reopen</Button>}
          {status === 'Paid' && meta.canReopenPaid && <Button size="sm" variant="secondary" icon={Undo2} onClick={() => setStatus('Approved', 'Reopen a PAID run?')}>Reopen</Button>}
          {editable && data.entries.length === 0 && <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { await api.delete(`/payroll/runs/${period}/${runType}`); load(); }}>Delete run</Button>}
        </div>
      </div>

      {status !== 'Draft' && (
        <p className="mb-3 text-sm text-muted">This run is <b className="text-ink">{status}</b>, so it's locked. {meta.canApprove ? 'Use Reopen to make changes.' : ''}</p>
      )}

      {data.entries.length === 0 ? (
        <div className="card"><EmptyState title="No staff in this run yet" description="Add staff one by one, or import an Excel file." action={editable && <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add staff</Button>} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div ref={tableRef} className="overflow-auto max-h-[calc(100vh-380px)] min-h-[320px]">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-surface2 w-10" />
                  <th className="sticky left-10 z-30 bg-surface2" />
                  {bands.map((b, i) => (
                    <th key={i} colSpan={b.span} className="bg-surface2 px-2 pt-2 text-center text-[10px] font-semibold tracking-widest text-muted">{b.group}</th>
                  ))}
                  <th className="bg-surface2" />
                </tr>
                <tr>
                  <th className="sticky left-0 z-30 bg-surface2 border-b border-border px-2 py-2.5 text-left text-xs font-medium text-muted">#</th>
                  <th className="sticky left-10 z-30 bg-surface2 border-b border-r border-border px-3 py-2.5 text-left text-xs font-medium text-muted min-w-[190px]">STAFF</th>
                  {columns.map((c) => (
                    <th key={c.key} className="bg-surface2 border-b border-border px-2.5 py-2.5 text-right text-xs font-semibold text-ink whitespace-nowrap">{c.label}</th>
                  ))}
                  <th className="bg-surface2 border-b border-border w-10" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const hide = collapsed[g.name];
                  return (
                    <GroupBlock key={g.name || 'none'} g={g} hide={hide} onToggle={() => setCollapsed({ ...collapsed, [g.name]: !hide })} columns={columns} totalCols={totalCols} sumOf={sumOf}>
                      {g.rows.map((e) => (
                        <tr key={e._id} className="group hover:bg-surface2/50">
                          <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface2 border-b border-border px-2 text-xs text-muted">{rowIndex[e._id] + 1}</td>
                          <td className="sticky left-10 z-10 bg-surface group-hover:bg-surface2 border-b border-r border-border px-3 py-1.5 whitespace-nowrap">
                            <span className="block text-sm font-medium text-ink">{e.payrollName || `${e.employee?.firstName} ${e.employee?.lastName}`}</span>
                            {e.payrollName && e.employee && <span className="block text-[11px] text-muted">{e.employee.firstName} {e.employee.lastName}</span>}
                          </td>
                          {columns.map((c, ci) => (
                            <td key={c.key} className={`border-b border-border p-0 ${c.kind === 'gross' || c.kind === 'net' ? 'bg-surface2/40' : ''}`}>
                              <Cell entry={e} col={c} r={rowIndex[e._id]} c={ci} editable={editable} onSave={saveCell} />
                            </td>
                          ))}
                          <td className="border-b border-border px-1 relative">
                            <button className="rounded-full p-1.5 text-muted hover:bg-surface2" onClick={() => setMenu(menu === e._id ? null : e._id)} aria-label="Row actions"><MoreHorizontal size={15} /></button>
                            {menu === e._id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                                <div className="absolute right-8 top-0 z-40 w-52 card p-1.5 shadow-floating animate-riseIn text-left">
                                  <button className="w-full rounded-lg px-3 py-2 text-sm text-left hover:bg-surface2" onClick={() => { setMenu(null); fetchFile('/payslips/pdf', { employee: e.employee._id, from: period, to: period, runType, draft: 1 }, { open: true }); }}>View payslip (PDF)</button>
                                  {editable && (data.template.sections || []).filter((s) => s !== (e.section || '')).map((s) => (
                                    <button key={s} className="w-full rounded-lg px-3 py-2 text-sm text-left hover:bg-surface2" onClick={() => { setMenu(null); moveRow(e, s); }}>Move to {s}</button>
                                  ))}
                                  {editable && <button className="w-full rounded-lg px-3 py-2 text-sm text-left text-brand-red hover:bg-brand-red/10" onClick={() => { setMenu(null); removeRow(e); }}>Remove from run</button>}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </GroupBlock>
                  );
                })}
                <tr className="sticky bottom-0 z-20">
                  <td className="sticky left-0 bg-ink" />
                  <td className="sticky left-10 bg-ink px-3 py-3 text-sm font-semibold text-bg">TOTAL</td>
                  {columns.map((c) => (
                    <td key={c.key} className="bg-ink px-2.5 py-3 text-right text-sm font-semibold tabular-nums text-bg">
                      {c.type !== 'text' && c.inTotals !== false ? fmtCell(sumOf(data.entries, c)) : ''}
                    </td>
                  ))}
                  <td className="bg-ink" />
                </tr>
              </tbody>
            </table>
          </div>
          {editable && <p className="px-4 py-2.5 text-xs text-muted border-t border-border">Tip: press Enter to move down, paste cells straight from Excel, or type a sum like <code>=5500+4100</code>. Grey figures are calculated - type over one to override it.</p>}
        </div>
      )}

      <AddStaffDrawer open={addOpen} onClose={() => setAddOpen(false)} sections={data.template.sections || []} existingIds={existingIds} period={period} onAdd={addEntry} />
    </div>
  );
}

function GroupBlock({ g, hide, onToggle, columns, totalCols, sumOf, children }) {
  return (
    <>
      {g.name && (
        <tr className="bg-surface2/60">
          <td colSpan={columns.length + 3} className="sticky left-0 border-b border-border px-3 py-2">
            <button onClick={onToggle} className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-red">
              {hide ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              {g.name.toUpperCase()} <span className="font-normal text-muted">· {g.rows.length}</span>
            </button>
          </td>
        </tr>
      )}
      {!hide && children}
      {!hide && g.name && (
        <tr>
          <td className="sticky left-0 bg-surface" />
          <td className="sticky left-10 bg-surface border-r border-border px-3 py-2 text-xs font-semibold text-muted">{g.name.toUpperCase()} TOTAL</td>
          {columns.map((c) => (
            <td key={c.key} className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-muted">
              {totalCols.includes(c) ? fmtCell(sumOf(g.rows, c)) : ''}
            </td>
          ))}
          <td />
        </tr>
      )}
    </>
  );
}
