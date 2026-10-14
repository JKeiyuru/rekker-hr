// client/src/pages/payroll/TemplateEditor.jsx
// The accountant's control room for the payroll sheet: add / rename / reorder
// columns, give them formulas, decide what shows on payslips.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, RotateCcw, Save, Sparkles, Trash2, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Button from '../../components/Button';
import { Spinner } from '../../components/Feedback';
import { TextInput, Select, Checkbox, Field } from '../../components/Fields';
import PayslipCard from '../../components/PayslipCard';
import { KIND_LABEL, PRESETS, buildPreview, errMsg, newColumn, slugify } from './shared';

const FUNCS = ['IF', 'MIN', 'MAX', 'SUM', 'ROUND', 'ABS', 'FLOOR', 'CEIL'];
const unknownRefs = (formula, keys) =>
  (String(formula || '').match(/[A-Za-z_][A-Za-z0-9_]*(?!\s*\()/g) || [])
    .map((x) => x.toLowerCase())
    .filter((x) => !FUNCS.map((f) => f.toLowerCase()).includes(x) && !keys.includes(x));

function ColumnRow({ col, index, total, all, expanded, onToggle, onChange, onMove, onRemove }) {
  const keys = all.filter((c) => !c.archived && c.key !== col.key).map((c) => c.key);
  const bad = col.formula ? unknownRefs(col.formula, keys) : [];
  const isSystem = col.kind === 'gross' || col.kind === 'net';
  return (
    <div className={`rounded-2xl border ${expanded ? 'border-brand-red/40 bg-surface' : 'border-border bg-surface'} transition-colors`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="text-muted hover:text-ink disabled:opacity-25" aria-label="Move up"><ArrowUp size={14} /></button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="text-muted hover:text-ink disabled:opacity-25" aria-label="Move down"><ArrowDown size={14} /></button>
        </div>
        <input
          value={col.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="focus-ring min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold text-ink hover:bg-surface2 focus:bg-surface2"
          aria-label="Column name"
        />
        <span className="hidden sm:inline-block rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-medium text-muted whitespace-nowrap">
          {col.type === 'formula' ? 'Formula' : col.type === 'text' ? 'Text' : 'Number'}
        </span>
        <span className={`hidden md:inline-block rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${col.kind === 'earning' ? 'bg-brand-green/10 text-brand-green' : col.kind === 'deduction' ? 'bg-brand-red/10 text-brand-red' : 'bg-surface2 text-muted'}`}>
          {col.kind === 'earning' ? 'Earning' : col.kind === 'deduction' ? 'Deduction' : col.kind === 'gross' ? 'Gross' : col.kind === 'net' ? 'Net' : 'Reference'}
        </span>
        <button
          type="button"
          onClick={() => onChange({ showOnPayslip: !col.showOnPayslip })}
          title={col.showOnPayslip ? 'Shown on payslips' : 'Hidden from payslips'}
          className={`rounded-full p-2 transition-colors ${col.showOnPayslip ? 'bg-brand-green/10 text-brand-green' : 'bg-surface2 text-muted'}`}
        >
          {col.showOnPayslip ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button type="button" onClick={onToggle} className="rounded-full p-2 text-muted hover:bg-surface2" aria-label="More options">
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 grid gap-x-4 sm:grid-cols-2 animate-fadeIn">
          <Field label="Band above the header" hint="Groups columns, e.g. DEDUCTIONS or ALLOWANCES">
            <TextInput value={col.group} onChange={(e) => onChange({ group: e.target.value.toUpperCase() })} />
          </Field>
          {!isSystem && (
            <Field label="What it holds">
              <Select value={col.type} onChange={(e) => onChange({ type: e.target.value })}>
                <option value="number">Number the accountant types</option>
                <option value="text">Text (e.g. bank, notes)</option>
                <option value="formula">Calculated from other columns</option>
              </Select>
            </Field>
          )}
          {!isSystem && col.type !== 'text' && (
            <Field label="How it affects pay">
              <Select value={col.kind} onChange={(e) => onChange({ kind: e.target.value })}>
                <option value="earning">{KIND_LABEL.earning}</option>
                <option value="deduction">{KIND_LABEL.deduction}</option>
                <option value="info">{KIND_LABEL.info}</option>
              </Select>
            </Field>
          )}
          <Field label="Name on the payslip" hint="Leave blank to use the column name">
            <TextInput value={col.payslipLabel} onChange={(e) => onChange({ payslipLabel: e.target.value })} placeholder={col.label} />
          </Field>

          {(col.type === 'formula' || isSystem) && (
            <div className="sm:col-span-2">
              <Field
                label={isSystem ? 'Custom formula (optional)' : 'Formula'}
                hint={isSystem ? (col.kind === 'gross' ? 'Empty = the sum of every "Adds to gross pay" column.' : 'Empty = gross pay minus every "Comes off net pay" column.') : 'Use + − × ÷ and brackets. Click a column below to insert it.'}
              >
                <TextInput
                  value={col.formula}
                  onChange={(e) => onChange({ formula: e.target.value })}
                  placeholder={isSystem ? 'Automatic' : 'e.g. basic_salary * 5%'}
                  className="font-mono"
                />
              </Field>
              {bad.length > 0 && <p className="-mt-2 mb-3 text-xs text-brand-red">Unknown column: {bad.join(', ')}</p>}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {all.filter((c) => !c.archived && c.key !== col.key && c.type !== 'text').map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onChange({ formula: `${col.formula ? col.formula + ' ' : ''}${c.key}` })}
                    className="rounded-full border border-border bg-surface2 px-2.5 py-1 text-xs text-ink hover:border-brand-red/50 hover:text-brand-red"
                    title={c.key}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-x-6">
            <Checkbox label="Copy into next month's run" checked={col.carryForward} onChange={(e) => onChange({ carryForward: e.target.checked })} />
            {col.type !== 'text' && <Checkbox label="Include in totals rows" checked={col.inTotals} onChange={(e) => onChange({ inTotals: e.target.checked })} />}
          </div>
          <div className="sm:col-span-2">
            <Field label="Other names this column has in Excel files" hint="Comma separated. Used when you upload a workbook, so the column maps itself.">
              <TextInput value={(col.aliases || []).join(', ')} onChange={(e) => onChange({ aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </Field>
          </div>
          {!isSystem && (
            <div className="sm:col-span-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={onRemove} className="text-brand-red">
                Remove column
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TemplateEditor({ runType, canManage, sampleEntry, onSaved, addSignal }) {
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState([]);
  const [sections, setSections] = useState([]);
  const [payslip, setPayslip] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [newSection, setNewSection] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get(`/payroll/template/${runType}`)
      .then((r) => {
        setCols(r.data.columns);
        setSections(r.data.sections || []);
        setPayslip(r.data.payslip || {});
        setDirty(false);
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [runType]);

  const set = (fn) => { setCols(fn); setDirty(true); };
  const active = useMemo(() => cols.map((c, i) => ({ ...c, _i: i })).filter((c) => !c.archived), [cols]);

  const insertAt = (col) =>
    set((prev) => {
      const used = new Set(prev.map((c) => c.key));
      let key = slugify(col.label);
      const base = key;
      for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
      const at = prev.findIndex((c) => c.kind === 'gross' && !c.archived);
      const next = [...prev];
      next.splice(at < 0 ? next.length : at, 0, { ...col, key });
      return next;
    });

  const addColumn = () => {
    const at = cols.findIndex((c) => c.kind === 'gross' && !c.archived);
    insertAt(newColumn());
    setOpen(at < 0 ? cols.length : at);
  };
  useEffect(() => { if (addSignal) addColumn(); /* eslint-disable-next-line */ }, [addSignal]);

  const applyPreset = (preset) => {
    set((prev) => {
      let next = [...prev];
      for (const def of preset.build(next)) {
        const key = slugify(def.label);
        const idx = next.findIndex((c) => c.key === key);
        if (idx >= 0) next[idx] = { ...next[idx], ...def, key, archived: false };
        else {
          const at = next.findIndex((c) => c.kind === 'gross' && !c.archived);
          next.splice(at < 0 ? next.length : at, 0, newColumn({ ...def, key }));
        }
      }
      return next;
    });
    setPresetOpen(false);
    toast.success(`${preset.label.split(' - ')[0]} added - review it, then Save template`);
  };

  const move = (i, d) => set((prev) => {
    const a = [...prev];
    // move among active columns only
    const act = a.map((c, idx) => idx).filter((idx) => !a[idx].archived);
    const pos = act.indexOf(i);
    const target = act[pos + d];
    if (target === undefined) return prev;
    [a[i], a[target]] = [a[target], a[i]];
    return a;
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/payroll/template/${runType}`, { columns: cols, sections, payslip });
      toast.success('Template saved. Draft runs have been recalculated.');
      load();
      onSaved?.();
    } catch (e) {
      toast.error(errMsg(e), { duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => buildPreview(cols, sampleEntry, payslip), [cols, sampleEntry, payslip]);

  if (loading) return <Spinner />;
  const archived = cols.map((c, i) => ({ ...c, _i: i })).filter((c) => c.archived);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="card p-4 flex gap-3 items-start mb-4 bg-brand-yellow/10 border-brand-yellow/30">
          <Info size={18} className="text-yellow-700 dark:text-brand-yellow mt-0.5 shrink-0" />
          <p className="text-sm text-ink leading-relaxed">
            <b>How the maths works:</b> Gross pay is the total of every column marked <i>Adds to gross pay</i>. Net pay is gross minus every column marked <i>Comes off net pay</i>.
            For anything else, add a column and give it a formula, e.g. <code className="rounded bg-surface2 px-1.5 py-0.5 text-xs">basic_salary * 2.75%</code>. You can also type
            sums straight into a cell, like <code className="rounded bg-surface2 px-1.5 py-0.5 text-xs">=5500+4100</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button icon={Plus} onClick={addColumn} disabled={!canManage}>Add column</Button>
          <div className="relative">
            <Button variant="secondary" icon={Sparkles} onClick={() => setPresetOpen(!presetOpen)} disabled={!canManage}>Statutory deductions</Button>
            {presetOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPresetOpen(false)} />
                <div className="absolute left-0 top-12 z-20 w-80 card p-1.5 shadow-floating animate-riseIn">
                  {PRESETS.map((p) => (
                    <button key={p.id} onClick={() => applyPreset(p)} className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-surface2">{p.label}</button>
                  ))}
                  <p className="px-3 py-2 text-xs text-muted">Standard Kenyan rates - confirm against current KRA, SHA and NSSF notices.</p>
                </div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-brand-red font-medium">Unsaved changes</span>}
            {dirty && <Button variant="ghost" icon={RotateCcw} onClick={load}>Discard</Button>}
            <Button icon={Save} onClick={save} loading={saving} disabled={!dirty || !canManage}>Save template</Button>
          </div>
        </div>

        <div className="space-y-2">
          {active.map((c, n) => (
            <ColumnRow
              key={c.key + c._i}
              col={c}
              index={n}
              total={active.length}
              all={cols}
              expanded={open === c._i}
              onToggle={() => setOpen(open === c._i ? null : c._i)}
              onChange={(patch) => set((prev) => prev.map((x, i) => (i === c._i ? { ...x, ...patch } : x)))}
              onMove={(d) => move(c._i, d)}
              onRemove={() => {
                if (window.confirm(`Remove "${c.label}"? Past runs keep their figures; the column just stops appearing.`)) {
                  set((prev) => prev.map((x, i) => (i === c._i ? { ...x, archived: true } : x)));
                  setOpen(null);
                }
              }}
            />
          ))}
        </div>

        {archived.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setShowArchived(!showArchived)} className="text-sm text-muted hover:text-ink">
              {showArchived ? 'Hide' : 'Show'} removed columns ({archived.length})
            </button>
            {showArchived && (
              <div className="mt-2 flex flex-wrap gap-2">
                {archived.map((c) => (
                  <button key={c.key} onClick={() => set((prev) => prev.map((x, i) => (i === c._i ? { ...x, archived: false } : x)))} className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand-green hover:text-brand-green">
                    Restore {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="card p-5 mt-6">
          <h3 className="font-semibold text-ink">Row groups</h3>
          <p className="text-sm text-muted mt-0.5">Staff are grouped on the sheet, like Store, Shop or Bellagio.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sections.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-surface2 pl-3 pr-1.5 py-1 text-sm">
                {s}
                <button onClick={() => { setSections(sections.filter((x) => x !== s)); setDirty(true); }} className="rounded-full p-1 text-muted hover:bg-border hover:text-ink" aria-label={`Remove ${s}`}><X size={12} /></button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = newSection.trim();
                if (v && !sections.includes(v)) { setSections([...sections, v]); setDirty(true); }
                setNewSection('');
              }}
              className="flex gap-2"
            >
              <TextInput value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Add a group" className="!w-40 !py-1.5" />
            </form>
          </div>
        </div>
      </div>

      <div className="xl:sticky xl:top-2 self-start space-y-4">
        <div className="card p-5">
          <h3 className="font-semibold text-ink">What employees see</h3>
          <p className="text-sm text-muted mt-0.5 mb-3">The eye on each column controls whether it appears on the payslip.</p>
          <Field label="Company name"><TextInput value={payslip.companyName || ''} onChange={(e) => { setPayslip({ ...payslip, companyName: e.target.value }); setDirty(true); }} /></Field>
          <Field label="Footer note"><TextInput value={payslip.footerNote || ''} onChange={(e) => { setPayslip({ ...payslip, footerNote: e.target.value }); setDirty(true); }} /></Field>
          <Checkbox label="Show bank / account" checked={!!payslip.showBankDetails} onChange={(e) => { setPayslip({ ...payslip, showBankDetails: e.target.checked }); setDirty(true); }} />
          <Checkbox label="Show KRA PIN and NSSF number" checked={!!payslip.showStatutoryNumbers} onChange={(e) => { setPayslip({ ...payslip, showStatutoryNumbers: e.target.checked }); setDirty(true); }} />
          <Checkbox label="Hide lines that are zero" checked={!!payslip.hideZeroLines} onChange={(e) => { setPayslip({ ...payslip, hideZeroLines: e.target.checked }); setDirty(true); }} />
        </div>
        <p className="text-xs text-muted px-1">Live preview{sampleEntry?.employee ? ` - ${sampleEntry.employee.firstName}'s row` : ''}</p>
        <PayslipCard slip={{ ...preview, periodLabel: 'Preview', runType, status: 'Approved' }} compact />
      </div>
    </div>
  );
}
