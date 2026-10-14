// client/src/pages/payroll/ImportWizard.jsx
// Upload an Excel payroll workbook. Two ways in:
//   1. Review one sheet: see how its columns map to the template and who each
//      row is, fix anything, then import.
//   2. Import several month-sheets automatically.
// If the sheet has a column the template doesn't, create it right here
// ("prime" the template) and map to it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { Spinner } from '../../components/Feedback';
import { Checkbox, Select, TextInput } from '../../components/Fields';
import { errMsg, newColumn, periodLabel, slugify } from './shared';

const STATUS_HELP = {
  Draft: 'Review it in the grid first (recommended for a new month)',
  Approved: 'Approved: employees can see their payslips',
  Paid: 'Paid: closed and locked (use for history)',
};

export default function ImportWizard({ open, onClose, runType: initialRunType, period: initialPeriod, onDone }) {
  const [step, setStep] = useState('file');
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [runType, setRunType] = useState(initialRunType);
  const [status, setStatus] = useState('Draft');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [period, setPeriod] = useState(initialPeriod);
  const [mapping, setMapping] = useState([]);
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [replace, setReplace] = useState(true);
  const [remember, setRemember] = useState(true);
  const [newCols, setNewCols] = useState({});
  const [result, setResult] = useState(null);
  const [auto, setAuto] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStep('file'); setFile(null); setSheets([]); setSelected([]); setPreview(null); setResult(null); setAuto(null);
      setRunType(initialRunType); setPeriod(initialPeriod); setStatus('Draft');
    }
  }, [open]);

  const send = (url, extra = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    return api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  const pick = async (f) => {
    if (!f) return;
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const { data } = await api.post('/payroll/import/sheets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSheets(data.sheets);
      const ok = data.sheets.filter((s) => s.importable);
      // sensible default: the sheet for the period being viewed, otherwise the last importable one
      const match = ok.find((s) => s.period === initialPeriod) || ok[ok.length - 1];
      setSelected(match ? [match.name] : []);
      setStep('sheets');
    } catch (e) { toast.error(errMsg(e)); setFile(null); }
    finally { setBusy(false); }
  };

  const loadPreview = async (sheetName) => {
    setBusy(true);
    try {
      const [{ data }, st] = await Promise.all([send('/payroll/import/preview', { sheet: sheetName, runType }), api.get('/payroll/staff')]);
      if (!data.ok) { toast.error(data.reason); return; }
      setStaff(st.data);
      setPreview(data);
      setPeriod(data.period || initialPeriod);
      setMapping(data.columns);
      setRows(data.rows.map((r) => ({ ...r, employee: r.match.id ? r.match.id : 'new' })));
      setNewCols({});
      setStep('review');
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  const runAuto = async () => {
    setBusy(true);
    try {
      const { data } = await send('/payroll/import/auto', { runType, status, sheets: JSON.stringify(selected) });
      setAuto(data.results);
      setStep('auto');
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  const tcols = preview?.templateColumns || [];
  const byKey = useMemo(() => Object.fromEntries(tcols.map((c) => [c.key, c])), [tcols]);

  const setMap = (index, patch) => setMapping((m) => m.map((x) => (x.index === index ? { ...x, ...patch } : x)));

  const onTarget = (m, value) => {
    if (value === '__new') { setNewCols({ ...newCols, [m.index]: { label: m.header.toUpperCase(), kind: 'earning', type: 'number' } }); return; }
    const t = byKey[value];
    let mode = 'input';
    if (!value || value === '__name') mode = 'skip';
    else if (t && (t.kind === 'gross' || t.kind === 'net')) mode = 'skip';
    else if (t && t.type === 'formula') mode = 'override';
    setMap(m.index, { target: value || null, mode });
    const c = { ...newCols }; delete c[m.index]; setNewCols(c);
  };

  const createColumn = async (m) => {
    const spec = newCols[m.index];
    try {
      const { data: tpl } = await api.get(`/payroll/template/${runType}`);
      const key = (() => { let k = slugify(spec.label); const used = new Set(tpl.columns.map((c) => c.key)); for (let n = 2; used.has(k); n++) k = `${slugify(spec.label)}_${n}`; return k; })();
      const col = newColumn({
        key, label: spec.label.trim(), type: spec.type === 'text' ? 'text' : 'number',
        kind: spec.type === 'text' ? 'info' : spec.kind, showOnPayslip: spec.type !== 'text', aliases: [m.header],
      });
      const at = tpl.columns.findIndex((c) => c.kind === 'gross' && !c.archived);
      const cols = [...tpl.columns];
      cols.splice(at < 0 ? cols.length : at, 0, col);
      await api.put(`/payroll/template/${runType}`, { columns: cols });
      setPreview((p) => ({ ...p, templateColumns: [...p.templateColumns.filter((c) => c.kind !== 'gross' && c.kind !== 'net' ? true : true), { ...col }] }));
      setMap(m.index, { target: key, mode: 'input' });
      const c = { ...newCols }; delete c[m.index]; setNewCols(c);
      toast.success(`Column "${col.label}" added to the template`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const payload = {
        period, runType, status, replace, remember, source: file?.name,
        mapping: mapping.map(({ index, target, mode, header }) => ({ index, target, mode, header })),
        rows: rows.map((r) => ({ name: r.name, section: r.section, cells: r.cells, employee: r.employee === 'skip' ? null : r.employee })),
      };
      const { data } = await api.post('/payroll/import/commit', payload);
      setResult(data);
      setStep('done');
      onDone?.(period, runType);
    } catch (e) { toast.error(errMsg(e), { duration: 7000 }); }
    finally { setBusy(false); }
  };

  if (!open) return null;

  const mappedTargets = new Set(mapping.filter((m) => m.target && m.target !== '__name').map((m) => m.target));
  const needsCheck = rows.filter((r) => r.match.score > 0 && r.match.score < 85).length;
  const newPeople = rows.filter((r) => r.employee === 'new').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col card shadow-floating animate-riseIn overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'file' && step !== 'done' && step !== 'auto' && (
              <button onClick={() => setStep(step === 'review' ? 'sheets' : 'file')} className="rounded-full p-2 text-muted hover:bg-surface2" aria-label="Back"><ArrowLeft size={16} /></button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-ink">Import from Excel</h2>
              <p className="text-sm text-muted">{file ? file.name : 'Upload your payroll workbook (.xlsx)'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface2" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {busy && <Spinner className="!py-10" />}

          {!busy && step === 'file' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
              className="rounded-2xl border-2 border-dashed border-border p-12 text-center"
            >
              <FileSpreadsheet size={36} className="mx-auto text-muted" strokeWidth={1.5} />
              <p className="mt-3 font-medium text-ink">Drop your Excel file here</p>
              <p className="text-sm text-muted mt-1 max-w-md mx-auto">Works with the standard September layout and with older month sheets. Columns are matched by their heading, not their position. If your file has a column the template doesn't, you'll be able to add it in the next step.</p>
              <Button className="mt-5" icon={Upload} onClick={() => inputRef.current?.click()}>Choose file</Button>
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => pick(e.target.files[0])} />
            </div>
          )}

          {!busy && step === 'sheets' && (
            <>
              <div className="flex flex-wrap gap-4 mb-5">
                <label className="text-sm">
                  <span className="block font-medium mb-1.5">This is a</span>
                  <Select value={runType} onChange={(e) => setRunType(e.target.value)} className="!w-56">
                    <option value="End-Month">End-month salary run</option>
                    <option value="Mid-Month">Mid-month (allowances / expenses)</option>
                  </Select>
                </label>
                <label className="text-sm">
                  <span className="block font-medium mb-1.5">After importing, set as</span>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-72">
                    {Object.keys(STATUS_HELP).map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </label>
              </div>
              <p className="text-xs text-muted -mt-3 mb-4">{STATUS_HELP[status]}</p>
              <p className="text-sm font-medium mb-2">Sheets in this file</p>
              <div className="space-y-1.5">
                {sheets.map((s) => (
                  <label key={s.name} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.importable ? 'border-border cursor-pointer hover:bg-surface2/60' : 'border-border opacity-50'} `}>
                    <input type="checkbox" disabled={!s.importable} checked={selected.includes(s.name)} onChange={(e) => setSelected(e.target.checked ? [...selected, s.name] : selected.filter((x) => x !== s.name))} className="h-4 w-4 accent-[rgb(var(--color-red))]" />
                    <span className="flex-1 font-medium text-sm text-ink">{s.name}</span>
                    <span className="text-xs text-muted">{s.period ? periodLabel(s.period) : 'Month not detected'}</span>
                    <span className="text-xs text-muted w-20 text-right">{s.importable ? `${s.rows} rows` : 'No header row'}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {!busy && step === 'review' && preview && (
            <>
              <div className="flex flex-wrap items-end gap-4 mb-5">
                <label className="text-sm">
                  <span className="block font-medium mb-1.5">Pay month</span>
                  <TextInput type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-44" />
                </label>
                <label className="text-sm">
                  <span className="block font-medium mb-1.5">After importing, set as</span>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-56">
                    {Object.keys(STATUS_HELP).map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </label>
                <div className="pb-1">
                  <Checkbox label="Replace what's already in this month's draft" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                  <Checkbox label="Remember my column choices for next time" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                </div>
              </div>

              {preview.unmapped.length > 0 && (
                <div className="mb-4 flex gap-3 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 p-4 text-sm">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-yellow-700 dark:text-brand-yellow" />
                  <p><b>{preview.unmapped.map((u) => u.header).join(', ')}</b> {preview.unmapped.length > 1 ? 'have' : 'has'} figures but {preview.unmapped.length > 1 ? "don't" : "doesn't"} match a template column. Choose a column below, or pick "Add as new column" to add it to the template.</p>
                </div>
              )}

              <h3 className="font-semibold text-ink mb-2">1. Match columns</h3>
              <div className="rounded-2xl border border-border overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-surface2/60 text-xs text-muted"><tr><th className="text-left px-4 py-2.5">Column in your Excel</th><th className="text-left px-4 py-2.5">Example</th><th className="text-left px-4 py-2.5">Goes into</th></tr></thead>
                  <tbody>
                    {mapping.filter((m) => m.target !== '__name').map((m) => {
                      const sample = rows.map((r) => r.cells[m.index]).find((v) => v !== undefined && v !== null && v !== 0);
                      const t = byKey[m.target];
                      const unmappedWithData = !m.target && preview.unmapped.some((u) => u.index === m.index);
                      return (
                        <tr key={m.index} className={`border-t border-border ${unmappedWithData ? 'bg-brand-yellow/5' : ''}`}>
                          <td className="px-4 py-2.5 font-medium text-ink">{m.header}</td>
                          <td className="px-4 py-2.5 text-muted tabular-nums">{sample !== undefined ? String(sample) : '—'}</td>
                          <td className="px-4 py-2">
                            {newCols[m.index] ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <TextInput value={newCols[m.index].label} onChange={(e) => setNewCols({ ...newCols, [m.index]: { ...newCols[m.index], label: e.target.value } })} className="!w-40 !py-1.5" />
                                <Select value={newCols[m.index].type === 'text' ? 'text' : newCols[m.index].kind} onChange={(e) => setNewCols({ ...newCols, [m.index]: e.target.value === 'text' ? { ...newCols[m.index], type: 'text' } : { ...newCols[m.index], type: 'number', kind: e.target.value } })} className="!w-44 !py-1.5">
                                  <option value="earning">Adds to gross pay</option>
                                  <option value="deduction">Comes off net pay</option>
                                  <option value="info">Reference number</option>
                                  <option value="text">Text</option>
                                </Select>
                                <Button size="sm" onClick={() => createColumn(m)}>Add column</Button>
                                <Button size="sm" variant="ghost" onClick={() => { const c = { ...newCols }; delete c[m.index]; setNewCols(c); }}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Select value={m.target || ''} onChange={(e) => onTarget(m, e.target.value)} className="!py-1.5 !w-64">
                                  <option value="">Ignore this column</option>
                                  {tcols.map((c) => <option key={c.key} value={c.key}>{c.label}{c.group ? ` (${c.group.toLowerCase()})` : ''}</option>)}
                                  <option value="__new">+ Add as new column…</option>
                                </Select>
                                {t && t.type === 'formula' && t.kind !== 'gross' && t.kind !== 'net' && (
                                  <Select value={m.mode} onChange={(e) => setMap(m.index, { mode: e.target.value })} className="!py-1.5 !w-60">
                                    <option value="skip">Recalculate (ignore Excel)</option>
                                    <option value="override">Use Excel's figure</option>
                                  </Select>
                                )}
                                {t && (t.kind === 'gross' || t.kind === 'net') && <span className="text-xs text-muted">System calculates; Excel figure used to double-check</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h3 className="font-semibold text-ink mb-1">2. Check who is who</h3>
              <p className="text-sm text-muted mb-3">
                {rows.length} rows. {needsCheck > 0 && <span className="text-yellow-700 dark:text-brand-yellow font-medium">{needsCheck} need a quick look. </span>}
                {newPeople > 0 && <span>{newPeople} will be added as new employees (no login).</span>}
              </p>
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface2/60 text-xs text-muted"><tr><th className="text-left px-4 py-2.5">Name in Excel</th><th className="text-left px-4 py-2.5">Group</th><th className="text-left px-4 py-2.5">Employee in the system</th><th /></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2 font-medium text-ink">{r.name}</td>
                        <td className="px-4 py-2 text-muted">{r.section || '—'}</td>
                        <td className="px-4 py-1.5">
                          <Select value={r.employee} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, employee: e.target.value } : x)))} className="!py-1.5 !w-64">
                            <option value="new">➕ Add as new employee</option>
                            <option value="skip">Skip this row</option>
                            {staff.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>)}
                          </Select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.employee !== 'new' && r.employee !== 'skip' && r.match.score >= 85 && <Badge tone="green">{r.match.how}</Badge>}
                          {r.employee !== 'new' && r.employee !== 'skip' && r.match.score > 0 && r.match.score < 85 && <Badge tone="yellow">check</Badge>}
                          {r.employee === 'new' && r.match.ambiguous && <Badge tone="yellow">ambiguous</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!busy && step === 'auto' && auto && (
            <>
              <h3 className="font-semibold text-ink mb-3">Import finished</h3>
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface2/60 text-xs text-muted"><tr><th className="text-left px-4 py-2.5">Sheet</th><th className="text-left px-4 py-2.5">Month</th><th className="text-right px-4 py-2.5">Rows</th><th className="text-right px-4 py-2.5">New staff</th><th className="text-left px-4 py-2.5">Notes</th></tr></thead>
                  <tbody>
                    {auto.map((r) => (
                      <tr key={r.sheet} className="border-t border-border align-top">
                        <td className="px-4 py-2 font-medium">{r.sheet}</td>
                        <td className="px-4 py-2">{r.period ? periodLabel(r.period) : '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.imported ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.createdEmployees?.length ?? '—'}</td>
                        <td className="px-4 py-2 text-xs">
                          {r.error && <span className="text-brand-red">{r.error}</span>}
                          {r.skipped && <span className="text-muted">{r.skipped}</span>}
                          {r.warnings?.slice(0, 3).map((w, i) => <div key={i} className="text-muted">{w}</div>)}
                          {r.unmapped?.length > 0 && <div className="text-yellow-700 dark:text-brand-yellow">Not imported: {r.unmapped.join(', ')}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auto.some((r) => r.createdEmployees?.length) && (
                <p className="text-sm text-muted mt-4"><b className="text-ink">New employees added (no login):</b> {[...new Set(auto.flatMap((r) => r.createdEmployees || []))].join(', ')}. Complete their profiles under Employees when you can.</p>
              )}
            </>
          )}

          {!busy && step === 'done' && result && (
            <div className="text-center py-6">
              <CheckCircle2 size={44} className="mx-auto text-brand-green" strokeWidth={1.5} />
              <h3 className="mt-3 text-lg font-semibold text-ink">{result.imported} rows imported into {periodLabel(result.period)}</h3>
              {result.createdEmployees.length > 0 && <p className="text-sm text-muted mt-2">{result.createdEmployees.length} new employee(s) added: {result.createdEmployees.join(', ')}</p>}
              {result.skipped.length > 0 && <p className="text-sm text-muted mt-1">Skipped: {result.skipped.join(', ')}</p>}
              {result.warnings.length > 0 && (
                <div className="mt-4 mx-auto max-w-xl text-left rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 p-4 text-sm">
                  <p className="font-medium mb-1">Worth a look</p>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted max-h-40 overflow-auto">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-muted">{step === 'review' ? `${mappedTargets.size} columns mapped` : ''}</p>
          <div className="flex gap-2">
            {(step === 'done' || step === 'auto') && <Button onClick={onClose}>Close</Button>}
            {step === 'sheets' && selected.length === 1 && <Button variant="secondary" onClick={() => loadPreview(selected[0])}>Review &amp; map first</Button>}
            {step === 'sheets' && selected.length > 0 && <Button onClick={selected.length === 1 ? runAuto : runAuto}>{selected.length === 1 ? 'Import now' : `Import ${selected.length} months automatically`}</Button>}
            {step === 'review' && <Button onClick={commit} loading={busy} disabled={!period}>Import {rows.filter((r) => r.employee !== 'skip').length} rows</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
