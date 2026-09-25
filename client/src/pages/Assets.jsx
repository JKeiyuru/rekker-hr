// client/src/pages/Assets.jsx
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
import { Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';

const categories = ['Laptop', 'Phone', 'SIM Card', 'Uniform', 'ID/Access Card', 'Company Vehicle', 'Tools/Equipment', 'Other'];

const emptyForm = { category: 'Laptop', name: '', serialNumber: '', assignedTo: '', issuedDate: '', condition: 'Good' };

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [returnDrawer, setReturnDrawer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { employees } = useEmployees();
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    api
      .get('/assets')
      .then((res) => setAssets(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/assets', form);
      toast.success('Asset added');
      setDrawerOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save asset');
    } finally {
      setSaving(false);
    }
  };

  const [returnChecklist, setReturnChecklist] = useState({});

  const openReturn = (asset) => {
    setReturnDrawer(asset);
    setReturnChecklist(asset.returnChecklist || {});
  };

  const submitReturn = async () => {
    try {
      const { data } = await api.put(`/assets/${returnDrawer._id}/return`, { returnChecklist });
      toast.success(data.status === 'Returned' ? 'Asset marked as returned' : 'Return checklist updated');
      setReturnDrawer(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const columns = [
    { key: 'assetTag', header: 'Tag' },
    { key: 'category', header: 'Category' },
    { key: 'name', header: 'Item' },
    { key: 'serialNumber', header: 'Serial #' },
    {
      key: 'assignedTo',
      header: 'Assigned to',
      render: (row) => (row.assignedTo ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}` : '—'),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    {
      key: 'action',
      header: '',
      render: (row) =>
        row.status === 'Active' && can('admin', 'hr', 'director', 'manager', 'department_manager') ? (
          <Button size="sm" variant="secondary" icon={Undo2} onClick={() => openReturn(row)}>
            Return
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employee Assets"
        subtitle="Laptops, phones, uniforms, ID cards and more"
        onAdd={can('admin', 'hr', 'director', 'manager', 'department_manager') ? () => setDrawerOpen(true) : undefined}
        addLabel="Issue asset"
      />

      <DataTable columns={columns} rows={assets} loading={loading} emptyMessage="No assets recorded yet" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Issue an asset"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Issue asset
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Category" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Item name" required hint="e.g. HP ProBook 450">
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Serial number">
            <TextInput
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            />
          </Field>
          <Field label="Assign to">
            <Select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Issued date">
              <TextInput
                type="date"
                value={form.issuedDate}
                onChange={(e) => setForm({ ...form, issuedDate: e.target.value })}
              />
            </Field>
            <Field label="Condition">
              <Select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {['New', 'Good', 'Fair', 'Damaged'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={!!returnDrawer}
        onClose={() => setReturnDrawer(null)}
        title="Asset return checklist"
        subtitle={returnDrawer?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReturnDrawer(null)}>
              Cancel
            </Button>
            <Button onClick={submitReturn}>Save</Button>
          </div>
        }
      >
        {[
          ['physicalConditionChecked', 'Physical condition checked'],
          ['dataWiped', 'Data wiped (if applicable)'],
          ['accessoriesReturned', 'Accessories returned'],
          ['signedOff', 'Signed off by HR/IT'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2.5 text-sm text-ink cursor-pointer select-none py-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-brand-red focus:ring-brand-red/40"
              checked={!!returnChecklist[key]}
              onChange={() => setReturnChecklist({ ...returnChecklist, [key]: !returnChecklist[key] })}
            />
            {label}
          </label>
        ))}
      </Drawer>
    </div>
  );
}
