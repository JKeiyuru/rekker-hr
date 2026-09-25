// client/src/pages/Users.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { Field, TextInput, Select, Checkbox } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import toast from 'react-hot-toast';

const emptyForm = { name: '', email: '', password: '', role: 'employee', employee: '' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();

  const load = () => {
    setLoading(true);
    api
      .get('/users')
      .then((res) => setUsers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Mongoose rejects an empty string for an ObjectId field ("employee")
      // with a cast error, so only include it when an employee was actually
      // selected - otherwise the API expects it to simply be absent.
      const payload = { ...form };
      if (!payload.employee) delete payload.employee;
      await api.post('/users', payload);
      toast.success('User account created');
      setDrawerOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create account');
    } finally {
      setSaving(false);
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
    { key: 'role', header: 'Role', render: (row) => <Badge tone="neutral">{row.role}</Badge> },
    {
      key: 'employee',
      header: 'Linked employee',
      render: (row) => (row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—'),
    },
    {
      key: 'isActive',
      header: 'Active',
      render: (row) => (
        <Checkbox checked={row.isActive} onChange={() => toggleActive(row)} label="" />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User Accounts"
        subtitle="Login access and role permissions"
        onAdd={() => setDrawerOpen(true)}
        addLabel="New account"
      />

      <DataTable columns={columns} rows={users} loading={loading} emptyMessage="No user accounts yet" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create a user account"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Create account
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Full name" required>
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <TextInput
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Temporary password" required hint="At least 6 characters">
            <TextInput
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {['admin', 'hr', 'manager', 'employee'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Linked employee record" hint="Lets them check in/out and apply for leave as themselves">
            <Select value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
