// client/src/pages/Employees.jsx
import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import { Field, TextInput, Select, TextArea } from '../components/Fields';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: '',
  dateOfBirth: '',
  department: '',
  role: '',
  branch: '',
  employmentType: 'Full-Time',
  dateJoined: '',
  contractStatus: 'Probation',
  contractEndDate: '',
  status: 'Active',
  address: '',
  bankName: '',
  bankAccount: '',
  kraPin: '',
  emergencyContact: { name: '', relationship: '', phone: '' },
  nextOfKin: { name: '', relationship: '', phone: '', address: '' },
  notes: '',
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    api
      .get('/employees', { params: search ? { search } : {} })
      .then((res) => setEmployees(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (emp) => {
    setEditingId(emp._id);
    setForm({
      ...emptyForm,
      ...emp,
      dateOfBirth: emp.dateOfBirth?.slice(0, 10) || '',
      dateJoined: emp.dateJoined?.slice(0, 10) || '',
      contractEndDate: emp.contractEndDate?.slice(0, 10) || '',
      emergencyContact: emp.emergencyContact || emptyForm.emergencyContact,
      nextOfKin: emp.nextOfKin || emptyForm.nextOfKin,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/employees/${editingId}`, form);
        toast.success('Employee profile updated');
      } else {
        await api.post('/employees', form);
        toast.success('Employee added');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/employees/${toDelete._id}`);
      toast.success('Employee removed');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete');
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Employee',
        render: (row) => (
          <div className="flex items-center gap-3">
            <Avatar name={`${row.firstName} ${row.lastName}`} src={row.photoUrl} />
            <div className="min-w-0">
              <p className="font-medium text-ink truncate">
                {row.firstName} {row.lastName}
              </p>
              <p className="text-xs text-muted truncate">{row.employeeId}</p>
            </div>
          </div>
        ),
      },
      { key: 'role', header: 'Role' },
      { key: 'department', header: 'Department' },
      { key: 'branch', header: 'Branch' },
      { key: 'employmentType', header: 'Type' },
      { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} people across Rekker`}
        search={search}
        onSearchChange={setSearch}
        onAdd={can('admin', 'hr') ? openCreate : undefined}
        addLabel="Add employee"
      />

      <DataTable
        columns={columns}
        rows={employees}
        loading={loading}
        onRowClick={setViewing}
        onEdit={can('admin', 'hr') ? openEdit : undefined}
        onDelete={can('admin', 'hr') ? setToDelete : undefined}
        emptyMessage="No employees match your search"
      />

      {/* Create / Edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit employee' : 'Add employee'}
        subtitle={editingId ? form.employeeId : 'Create a new employee record'}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingId ? 'Save changes' : 'Add employee'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <SectionTitle>Personal details</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="First name" required>
              <TextInput
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name" required>
              <TextInput
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
            <Field label="Email" required>
              <TextInput
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone" required>
              <TextInput
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Date of birth">
              <TextInput
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Residential address">
            <TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>

          <SectionTitle>Employment</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Department" required>
              <TextInput
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </Field>
            <Field label="Job role / title" required>
              <TextInput required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Field>
            <Field label="Branch" required>
              <TextInput required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            </Field>
            <Field label="Employment type">
              <Select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
              >
                {['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Casual'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date joined" required>
              <TextInput
                type="date"
                required
                value={form.dateJoined}
                onChange={(e) => setForm({ ...form, dateJoined: e.target.value })}
              />
            </Field>
            <Field label="Employee status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['Active', 'On Leave', 'Suspended', 'Exited'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Contract status">
              <Select
                value={form.contractStatus}
                onChange={(e) => setForm({ ...form, contractStatus: e.target.value })}
              >
                {['Probation', 'Permanent', 'Fixed-Term', 'Expired', 'N/A'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Contract end date" hint="Leave blank for permanent staff">
              <TextInput
                type="date"
                value={form.contractEndDate}
                onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })}
              />
            </Field>
          </div>

          <SectionTitle>Emergency contact</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Name">
              <TextInput
                value={form.emergencyContact.name}
                onChange={(e) =>
                  setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })
                }
              />
            </Field>
            <Field label="Relationship">
              <TextInput
                value={form.emergencyContact.relationship}
                onChange={(e) =>
                  setForm({
                    ...form,
                    emergencyContact: { ...form.emergencyContact, relationship: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={form.emergencyContact.phone}
                onChange={(e) =>
                  setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })
                }
              />
            </Field>
          </div>

          <SectionTitle>Next of kin</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Name">
              <TextInput
                value={form.nextOfKin.name}
                onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, name: e.target.value } })}
              />
            </Field>
            <Field label="Relationship">
              <TextInput
                value={form.nextOfKin.relationship}
                onChange={(e) =>
                  setForm({ ...form, nextOfKin: { ...form.nextOfKin, relationship: e.target.value } })
                }
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={form.nextOfKin.phone}
                onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, phone: e.target.value } })}
              />
            </Field>
            <Field label="Address">
              <TextInput
                value={form.nextOfKin.address}
                onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, address: e.target.value } })}
              />
            </Field>
          </div>

          <SectionTitle>Payroll reference</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Bank name">
              <TextInput value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </Field>
            <Field label="Bank account">
              <TextInput
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              />
            </Field>
            <Field label="KRA PIN">
              <TextInput value={form.kraPin} onChange={(e) => setForm({ ...form, kraPin: e.target.value })} />
            </Field>
          </div>

          <Field label="Notes">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </form>
      </Drawer>

      {/* View profile drawer */}
      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.firstName} ${viewing.lastName}` : ''}
        subtitle={viewing?.employeeId}
      >
        {viewing && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={`${viewing.firstName} ${viewing.lastName}`} size="lg" src={viewing.photoUrl} />
              <div>
                <p className="font-semibold text-ink">
                  {viewing.firstName} {viewing.lastName}
                </p>
                <p className="text-sm text-muted">{viewing.role}</p>
                <Badge>{viewing.status}</Badge>
              </div>
            </div>

            <DetailGroup title="Employment">
              <DetailRow label="Department" value={viewing.department} />
              <DetailRow label="Branch" value={viewing.branch} />
              <DetailRow label="Employment type" value={viewing.employmentType} />
              <DetailRow label="Date joined" value={viewing.dateJoined?.slice(0, 10)} />
              <DetailRow label="Contract status" value={viewing.contractStatus} />
            </DetailGroup>

            <DetailGroup title="Contact">
              <DetailRow label="Email" value={viewing.email} />
              <DetailRow label="Phone" value={viewing.phone} />
              <DetailRow label="Address" value={viewing.address} />
            </DetailGroup>

            {viewing.emergencyContact?.name && (
              <DetailGroup title="Emergency contact">
                <DetailRow label="Name" value={viewing.emergencyContact.name} />
                <DetailRow label="Relationship" value={viewing.emergencyContact.relationship} />
                <DetailRow label="Phone" value={viewing.emergencyContact.phone} />
              </DetailGroup>
            )}

            {viewing.nextOfKin?.name && (
              <DetailGroup title="Next of kin">
                <DetailRow label="Name" value={viewing.nextOfKin.name} />
                <DetailRow label="Relationship" value={viewing.nextOfKin.relationship} />
                <DetailRow label="Phone" value={viewing.nextOfKin.phone} />
              </DetailGroup>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this employee?"
        description={`This will permanently remove ${toDelete?.firstName}'s record. This can't be undone.`}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SectionTitle({ children }) {
  return <h4 className="text-sm font-semibold text-ink mt-2 mb-3 pb-2 border-b border-border">{children}</h4>;
}

function DetailGroup({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{title}</h4>
      <div className="card divide-y divide-border">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-medium text-right">{value || '—'}</span>
    </div>
  );
}
