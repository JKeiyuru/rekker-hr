// client/src/pages/Recruitment.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { Field, TextInput, Select, TextArea } from '../components/Fields';
import { UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyJob = {
  title: '',
  department: '',
  branch: '',
  employmentType: 'Full-Time',
  description: '',
  requirements: '',
  openings: 1,
  status: 'Open',
  closingDate: '',
};

const emptyApplicant = { jobOpening: '', fullName: '', email: '', phone: '', source: 'Direct' };

export default function Recruitment() {
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobDrawer, setJobDrawer] = useState(false);
  const [applicantDrawer, setApplicantDrawer] = useState(false);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [applicantForm, setApplicantForm] = useState(emptyApplicant);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/recruitment/jobs'), api.get('/recruitment/applicants')])
      .then(([j, a]) => {
        setJobs(j.data);
        setApplicants(a.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const saveJob = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/jobs', jobForm);
      toast.success('Job opening created');
      setJobDrawer(false);
      setJobForm(emptyJob);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const saveApplicant = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/applicants', applicantForm);
      toast.success('Applicant added');
      setApplicantDrawer(false);
      setApplicantForm(emptyApplicant);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (applicant, stage) => {
    try {
      await api.put(`/recruitment/applicants/${applicant._id}`, { stage });
      toast.success(`Moved to ${stage}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const convert = async (applicant) => {
    try {
      await api.post(`/recruitment/applicants/${applicant._id}/convert`, {});
      toast.success(`${applicant.fullName} converted to an employee`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Conversion failed');
    }
  };

  const jobColumns = [
    { key: 'title', header: 'Role' },
    { key: 'department', header: 'Department' },
    { key: 'employmentType', header: 'Type' },
    { key: 'openings', header: 'Openings' },
    { key: 'applicantCount', header: 'Applicants' },
    { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
  ];

  const applicantColumns = [
    { key: 'fullName', header: 'Applicant' },
    { key: 'jobOpening', header: 'Applying for', render: (row) => row.jobOpening?.title || '—' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) => (
        <Select
          value={row.stage}
          onChange={(e) => updateStage(row, e.target.value)}
          className="!w-40 !py-1.5"
        >
          {['Applied', 'Shortlisted', 'Interviewing', 'Offer', 'Hired', 'Rejected'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      ),
    },
    {
      key: 'convert',
      header: '',
      render: (row) =>
        row.stage === 'Offer' && !row.convertedToEmployee ? (
          <Button size="sm" variant="success" icon={UserCheck} onClick={() => convert(row)}>
            Hire
          </Button>
        ) : row.convertedToEmployee ? (
          <span className="text-xs text-brand-green font-medium">Employee created</span>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recruitment"
        subtitle="Job openings, applicants and hiring decisions"
        onAdd={tab === 'jobs' ? () => setJobDrawer(true) : () => setApplicantDrawer(true)}
        addLabel={tab === 'jobs' ? 'New job opening' : 'Add applicant'}
      />

      <div className="flex gap-1 mb-5 bg-surface2 p-1 rounded-full w-fit">
        {[
          { key: 'jobs', label: 'Job openings' },
          { key: 'applicants', label: 'Applicants' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-brand-red text-white' : 'text-ink/70 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'jobs' ? (
        <DataTable columns={jobColumns} rows={jobs} loading={loading} emptyMessage="No job openings yet" />
      ) : (
        <DataTable columns={applicantColumns} rows={applicants} loading={loading} emptyMessage="No applicants yet" />
      )}

      <Drawer
        open={jobDrawer}
        onClose={() => setJobDrawer(false)}
        title="New job opening"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setJobDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={saveJob} loading={saving}>
              Post opening
            </Button>
          </div>
        }
      >
        <form onSubmit={saveJob}>
          <Field label="Job title" required>
            <TextInput required value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Department" required>
              <TextInput
                required
                value={jobForm.department}
                onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
              />
            </Field>
            <Field label="Branch">
              <TextInput value={jobForm.branch} onChange={(e) => setJobForm({ ...jobForm, branch: e.target.value })} />
            </Field>
            <Field label="Employment type">
              <Select
                value={jobForm.employmentType}
                onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
              >
                {['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Casual'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Number of openings">
              <TextInput
                type="number"
                min="1"
                value={jobForm.openings}
                onChange={(e) => setJobForm({ ...jobForm, openings: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Description">
            <TextArea value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} />
          </Field>
          <Field label="Requirements">
            <TextArea
              value={jobForm.requirements}
              onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
            />
          </Field>
          <Field label="Closing date">
            <TextInput
              type="date"
              value={jobForm.closingDate}
              onChange={(e) => setJobForm({ ...jobForm, closingDate: e.target.value })}
            />
          </Field>
        </form>
      </Drawer>

      <Drawer
        open={applicantDrawer}
        onClose={() => setApplicantDrawer(false)}
        title="Add applicant"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApplicantDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={saveApplicant} loading={saving}>
              Add applicant
            </Button>
          </div>
        }
      >
        <form onSubmit={saveApplicant}>
          <Field label="Applying for" required>
            <Select
              required
              value={applicantForm.jobOpening}
              onChange={(e) => setApplicantForm({ ...applicantForm, jobOpening: e.target.value })}
            >
              <option value="">Select job opening</option>
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Full name" required>
            <TextInput
              required
              value={applicantForm.fullName}
              onChange={(e) => setApplicantForm({ ...applicantForm, fullName: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Email" required>
              <TextInput
                type="email"
                required
                value={applicantForm.email}
                onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={applicantForm.phone}
                onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Source">
            <TextInput
              value={applicantForm.source}
              onChange={(e) => setApplicantForm({ ...applicantForm, source: e.target.value })}
            />
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
