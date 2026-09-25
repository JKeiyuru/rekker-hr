// client/src/pages/Onboarding.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import { Spinner, EmptyState } from '../components/Feedback';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import { Checkbox } from '../components/Fields';
import toast from 'react-hot-toast';

const checklistLabels = {
  contractSigned: 'Contract signed',
  documentsReceived: 'Employee documents received',
  systemAccountCreated: 'System account created',
  assetsIssued: 'Company assets issued',
  introductionCompleted: 'Introduction completed',
  departmentAssigned: 'Department assigned',
  managerAssigned: 'Manager assigned',
};

export default function Onboarding() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get('/onboarding')
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = async (record, key) => {
    try {
      const { data } = await api.put(`/onboarding/${record._id}/checklist`, {
        [key]: !record.checklist[key],
      });
      setRecords((prev) => prev.map((r) => (r._id === record._id ? data : r)));
      if (data.status === 'Completed') toast.success(`${data.employee?.firstName}'s onboarding is complete!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Applicant → Hired → Onboarding → Active employee" />

      {loading ? (
        <Spinner />
      ) : records.length === 0 ? (
        <EmptyState
          title="No one is onboarding right now"
          description="New onboarding checklists are created automatically when you hire an applicant from Recruitment."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map((record) => {
            const items = Object.entries(record.checklist).filter(([k]) => k !== '_id');
            const done = items.filter(([, v]) => v).length;
            return (
              <div key={record._id} className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={`${record.employee?.firstName} ${record.employee?.lastName}`} />
                    <div>
                      <p className="font-medium text-ink">
                        {record.employee?.firstName} {record.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        {record.employee?.role} · {record.employee?.department}
                      </p>
                    </div>
                  </div>
                  <Badge>{record.status}</Badge>
                </div>

                <div className="h-1.5 rounded-full bg-surface2 overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full bg-brand-green transition-all"
                    style={{ width: `${(done / items.length) * 100}%` }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {items.map(([key, value]) => (
                    <Checkbox
                      key={key}
                      label={checklistLabels[key] || key}
                      checked={value}
                      onChange={() => toggle(record, key)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
