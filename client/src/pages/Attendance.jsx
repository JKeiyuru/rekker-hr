// client/src/pages/Attendance.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import { Field, TextInput, Select } from '../components/Fields';
import useEmployees from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee: '', date: date, status: 'Present', checkIn: '', checkOut: '' });
  const { employees } = useEmployees();
  const { user, can } = useAuth();

  const load = () => {
    setLoading(true);
    api
      .get('/attendance', { params: { date } })
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [date]);

  const quickCheckIn = async () => {
    if (!user?.employee?._id) {
      toast.error('Your login is not linked to an employee record yet');
      return;
    }
    try {
      await api.post('/attendance/checkin', { employee: user.employee._id });
      toast.success('Checked in');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    }
  };

  const quickCheckOut = async () => {
    if (!user?.employee?._id) {
      toast.error('Your login is not linked to an employee record yet');
      return;
    }
    try {
      await api.post('/attendance/checkout', { employee: user.employee._id });
      toast.success('Checked out');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/attendance', form);
      toast.success('Attendance recorded');
      setDrawerOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save record');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.employee?.firstName} ${row.employee?.lastName}`} size="sm" />
          <div>
            <p className="font-medium text-ink">
              {row.employee?.firstName} {row.employee?.lastName}
            </p>
            <p className="text-xs text-muted">{row.employee?.department}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'checkIn',
      header: 'Check-in',
      render: (row) => (row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
    {
      key: 'checkOut',
      header: 'Check-out',
      render: (row) => (row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
    { key: 'hoursWorked', header: 'Hours', render: (row) => (row.hoursWorked ? row.hoursWorked.toFixed(1) : '—') },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Daily check-ins, lateness and absence tracking"
        actions={
          <>
            <Button variant="secondary" icon={LogIn} onClick={quickCheckIn}>
              Check in
            </Button>
            <Button variant="secondary" icon={LogOut} onClick={quickCheckOut}>
              Check out
            </Button>
          </>
        }
        onAdd={can('admin', 'hr', 'manager') ? () => setDrawerOpen(true) : undefined}
        addLabel="Record entry"
      />

      <div className="flex items-center gap-3 mb-4">
        <Field label={null}>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
        </Field>
      </div>

      <DataTable columns={columns} rows={records} loading={loading} emptyMessage="No attendance recorded for this date" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Record attendance"
        subtitle="Manual HR override entry"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Employee" required>
            <Select required value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required>
            <TextInput
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Check-in time">
              <TextInput type="time" onChange={(e) => setForm({ ...form, checkIn: `${form.date}T${e.target.value}` })} />
            </Field>
            <Field label="Check-out time">
              <TextInput type="time" onChange={(e) => setForm({ ...form, checkOut: `${form.date}T${e.target.value}` })} />
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['Present', 'Late', 'Absent', 'On Leave', 'Half Day', 'Holiday'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
