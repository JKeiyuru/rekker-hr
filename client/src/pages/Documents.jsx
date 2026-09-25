// client/src/pages/Documents.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { Field, TextInput, Select } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { FileText, Download, AlertCircle, RefreshCw, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const categories = ['Contract', 'ID Copy', 'Certificate', 'Warning Letter', 'Appraisal', 'Payslip', 'Company Policy', 'Other'];

const emptyForm = { employee: '', category: 'Contract', title: '', expiryDate: '' };

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviseDoc, setReviseDoc] = useState(null); // document being replaced
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();
  const { user, can } = useAuth();
  const canManage = can('admin', 'hr', 'director', 'manager', 'department_manager');

  useEffect(() => {
    if (!canManage && user?.employee?._id) {
      setForm((f) => ({ ...f, employee: user.employee._id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/documents'), api.get('/documents/expiring')])
      .then(([d, e]) => {
        setDocs(d.data);
        setExpiring(e.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a file to upload');
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => v && data.append(k, v));
      data.append('file', file);
      await api.post('/documents', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded');
      setDrawerOpen(false);
      setFile(null);
      setForm((f) => ({ ...emptyForm, employee: canManage ? '' : f.employee }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRevise = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a replacement file');
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const { data: revision } = await api.post(`/documents/${reviseDoc._id}/revise`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(
        revision.status === 'Approved' ? 'Document replaced' : 'Replacement submitted — waiting for approval'
      );
      setReviseDoc(null);
      setFile(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit replacement');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (doc, decision) => {
    try {
      await api.put(`/documents/${doc._id}/${decision}`, {});
      toast.success(decision === 'approve' ? 'Revision approved' : 'Revision rejected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const isOwnDoc = (row) => row.employee?._id === user?.employee?._id;

  const columns = [
    {
      key: 'title',
      header: 'Document',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-surface2 flex items-center justify-center text-muted shrink-0">
            <FileText size={15} />
          </span>
          <div>
            <p className="font-medium text-ink">{row.title}</p>
            {row.revisionOf && <p className="text-xs text-muted">Replacement upload</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`,
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="neutral">{row.category}</Badge> },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'expiryDate', header: 'Expires', render: (row) => (row.expiryDate ? row.expiryDate.slice(0, 10) : '—') },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-brand-red"
            title="Download"
          >
            <Download size={16} />
          </a>
          {row.status === 'Approved' && (canManage || isOwnDoc(row)) && (
            <button
              onClick={() => setReviseDoc(row)}
              className="text-muted hover:text-brand-red"
              title="Upload a replacement"
            >
              <RefreshCw size={15} />
            </button>
          )}
          {row.status === 'Pending Review' && canManage && (
            <>
              <button
                onClick={() => decide(row, 'approve')}
                className="focus-ring rounded-full p-1 bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                title="Approve"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => decide(row, 'reject')}
                className="focus-ring rounded-full p-1 bg-brand-red/10 text-brand-red hover:bg-brand-red/20"
                title="Reject"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle={
          canManage
            ? 'Central repository for contracts, IDs, certificates and policies'
            : 'Your documents — edits need approval before they replace the original'
        }
        onAdd={() => setDrawerOpen(true)}
        addLabel="Upload document"
      />

      {expiring.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm text-yellow-700 dark:text-brand-yellow bg-brand-yellow/10 border border-brand-yellow/25 rounded-xl px-4 py-2.5">
          <AlertCircle size={15} />
          {expiring.length} document{expiring.length > 1 ? 's are' : ' is'} expiring within 30 days.
        </div>
      )}

      <DataTable columns={columns} rows={docs} loading={loading} emptyMessage="No documents uploaded yet" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Upload a document"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Upload
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Employee" required>
            {canManage ? (
              <Select required value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                disabled
                value={
                  user?.employee
                    ? `${user.employee.firstName} ${user.employee.lastName} (you)`
                    : 'Not linked to an employee record'
                }
              />
            )}
          </Field>
          <Field label="Document title" required>
            <TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Expiry date" hint="Leave blank if not applicable">
            <TextInput
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </Field>
          <Field label="File" required>
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-surface2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-border/60"
            />
          </Field>
        </form>
      </Drawer>

      <Drawer
        open={!!reviseDoc}
        onClose={() => {
          setReviseDoc(null);
          setFile(null);
        }}
        title="Upload a replacement"
        subtitle={reviseDoc?.title}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setReviseDoc(null);
                setFile(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRevise} loading={saving}>
              Submit
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted mb-4">
          {canManage
            ? 'As a manager/HR/admin, this replacement takes effect immediately.'
            : "This will stay pending until your manager, HR or an admin approves it — the current document remains active until then."}
        </p>
        <Field label="Replacement file" required>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-surface2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-border/60"
          />
        </Field>
      </Drawer>
    </div>
  );
}
