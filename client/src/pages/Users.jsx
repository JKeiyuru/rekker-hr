// client/src/pages/Users.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { Field, TextInput, Select, Checkbox } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { ROLE_OPTIONS, roleLabel } from '../config/roles';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
  employee: '',
  managedDepartments: [],
  recommendEnabled: false,
  recommendDepartments: [],
};

// A grid of department checkboxes.
function DepartmentPicker({ departments, value, onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  if (!departments.length) return <p className="text-sm text-muted">No departments found on employee records yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 rounded-xl border border-border bg-surface2/40 px-3.5 py-2">
      {departments.map((d) => (
        <Checkbox key={d} label={d} checked={value.includes(d)} onChange={() => toggle(d)} />
      ))}
    </div>
  );
}

const SectionTitle = ({ children }) => (
  <h4 className="text-sm font-semibold text-ink mt-2 mb-3 pb-2 border-b border-border">{children}</h4>
);

export default function Users() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [editing, setEditing] = useState(null); // user being edited, or null when creating
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();
  const { user: me } = useAuth();

  const load = () => {
    setLoading(true);
    api
      .get('/users')
      .then((res) => setUsers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    api.get('/users/departments').then((res) => setDepartments(res.data));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      employee: u.employee?._id || '',
      managedDepartments: u.managedDepartments || [],
      recommendEnabled: !!u.leaveRecommendation?.enabled,
      recommendDepartments: u.leaveRecommendation?.departments || [],
    });
    setDrawerOpen(true);
  };

  const isDeptHead = form.role === 'department_manager';
  const isManager = form.role === 'manager';
  const roleLocked = !!editing && (editing.isSuperAdmin || editing._id === me?._id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDeptHead && form.managedDepartments.length === 0) {
      return toast.error('Choose the department this department head is in charge of');
    }
    if (isManager && form.recommendEnabled && form.recommendDepartments.length === 0) {
      return toast.error('Choose at least one department this manager can recommend leave for');
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        role: form.role,
        employee: form.employee, // '' on edit = unlink
        managedDepartments: isDeptHead ? form.managedDepartments : [],
        leaveRecommendation: {
          enabled: (isDeptHead || isManager) && form.recommendEnabled,
          departments: isManager && form.recommendEnabled ? form.recommendDepartments : [],
        },
      };
      if (editing) {
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing._id}`, payload);
        toast.success('Account updated');
      } else {
        // Mongoose rejects an empty string for an ObjectId field ("employee")
        // with a cast error, so only send it when one was selected.
        if (!payload.employee) delete payload.employee;
        await api.post('/users', { ...payload, email: form.email, password: form.password });
        toast.success('User account created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save account');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete(`/users/${toDelete._id}`);
      toast.success('Account deleted');
      setToDelete(null);
      setDrawerOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete the account');
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (row) => <Badge tone="neutral">{roleLabel(row.role)}</Badge> },
    {
      key: 'departments',
      header: 'Heads',
      render: (row) =>
        row.role === 'department_manager'
          ? row.managedDepartments?.length
            ? row.managedDepartments.join(', ')
            : <span className="text-xs text-muted">{row.employee?.department ? `${row.employee.department} (own dept)` : 'Not set'}</span>
          : '—',
    },
    {
      key: 'recommend',
      header: 'Recommends leave for',
      render: (row) =>
        row.recommendDepartments?.length ? (
          <span className="text-ink">{row.recommendDepartments.join(', ')}</span>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: 'employee',
      header: 'Linked employee',
      render: (row) => (row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—'),
    },
    {
      key: 'isActive',
      header: 'Active',
      render: (row) => (
        // stop the click reaching the row, which would open the editor
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={row.isActive} onChange={() => toggleActive(row)} label="" />
        </div>
      ),
    },
  ];

  const roleHint = ROLE_OPTIONS.find((r) => r.value === form.role)?.hint;

  return (
    <div>
      <PageHeader
        title="User Accounts"
        subtitle="Login access, roles and leave-recommending permissions. Click an account to edit it."
        onAdd={openCreate}
        addLabel="New account"
      />

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        onRowClick={openEdit}
        emptyMessage="No user accounts yet"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit account' : 'Create a user account'}
        subtitle={editing ? editing.email : undefined}
        footer={
          <div className="flex items-center gap-2">
            {editing && !roleLocked && (
              <Button variant="ghost" className="text-brand-red hover:bg-brand-red/10 mr-auto" onClick={() => setToDelete(editing)}>
                Delete account
              </Button>
            )}
            <Button variant="secondary" className={editing && !roleLocked ? '' : 'ml-auto'} onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Save changes' : 'Create account'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Full name" required>
            <TextInput required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          {!editing && (
            <Field label="Email" required>
              <TextInput type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
          )}
          <Field
            label={editing ? 'Reset password' : 'Temporary password'}
            required={!editing}
            hint={editing ? 'Leave blank to keep the current password' : 'At least 6 characters'}
          >
            <TextInput
              type="password"
              required={!editing}
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
            />
          </Field>
          <Field label="Linked employee record" hint="Lets them check in/out and apply for leave as themselves">
            <Select value={form.employee} onChange={(e) => set({ employee: e.target.value })}>
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                  {e.department ? ` — ${e.department}` : ''}
                  {e.employeeId ? ` — ${e.employeeId}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <SectionTitle>Role &amp; permissions</SectionTitle>
          <Field
            label="Role"
            hint={
              roleLocked
                ? editing?.isSuperAdmin
                  ? "The super admin's role can't be changed."
                  : "You can't change your own role."
                : roleHint
            }
          >
            <Select
              value={form.role}
              disabled={roleLocked}
              onChange={(e) => set({ role: e.target.value, managedDepartments: [], recommendEnabled: false, recommendDepartments: [] })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>

          {isDeptHead && (
            <>
              <Field label="Department(s) headed" required hint="They see and manage employees in these departments.">
                <DepartmentPicker
                  departments={departments}
                  value={form.managedDepartments}
                  onChange={(v) => set({ managedDepartments: v })}
                />
              </Field>
              <Checkbox
                checked={form.recommendEnabled}
                onChange={(e) => set({ recommendEnabled: e.target.checked })}
                label="Can recommend / not recommend leave applications for the department(s) above"
              />
            </>
          )}

          {isManager && (
            <>
              <Checkbox
                checked={form.recommendEnabled}
                onChange={(e) => set({ recommendEnabled: e.target.checked })}
                label="Can recommend / not recommend leave applications"
              />
              {form.recommendEnabled && (
                <div className="mt-3">
                  <Field label="Departments they can recommend leave for" required>
                    <DepartmentPicker
                      departments={departments}
                      value={form.recommendDepartments}
                      onChange={(v) => set({ recommendDepartments: v })}
                    />
                  </Field>
                </div>
              )}
            </>
          )}

          {(isDeptHead || isManager) && (
            <p className="text-xs text-muted mt-3">
              Recommending is advisory. A recommended or not-recommended application still goes to HR, a director or an
              admin, who make the final decision (and can approve one that was not recommended).
            </p>
          )}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete the login for ${toDelete?.name || ''}?`}
        description="They will no longer be able to sign in. Their employee record and payroll stay as they are, and you can create a new login linked to the right employee."
        onCancel={() => setToDelete(null)}
        onConfirm={deleteAccount}
      />
    </div>
  );
}
