// client/src/components/ProfileForm.jsx
// The self-service profile form, shared by the Profile page and the
// mandatory "complete your profile" popup. Only the fields the employee is
// allowed to change are inputs; everything HR-managed is shown read-only.
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import api from '../api/axios';
import Button from './Button';
import { Field, TextInput, Select } from './Fields';
import toast from 'react-hot-toast';

const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend'];

function Section({ title, hint, children }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-3">{children}</div>
    </section>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function ReadOnly({ label, value }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-medium text-right">{value || '—'}</span>
    </div>
  );
}

export default function ProfileForm({ profile, onSaved, showReadOnly = true }) {
  const [form, setForm] = useState(profile.editable);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(profile.editable), [profile]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setGroup = (group, patch) => setForm((f) => ({ ...f, [group]: { ...f[group], ...patch } }));
  const { locked, readOnly } = profile;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      // Fields already on file are locked - don't send them.
      if (locked.kraPin) delete payload.kraPin;
      if (locked.nssfNumber) delete payload.nssfNumber;
      const { data } = await api.put('/profile', payload);
      onSaved?.(data);
      toast.success(
        data.completion.complete
          ? 'Profile saved — you’re all set'
          : `Saved. ${data.completion.total - data.completion.done} item(s) still needed`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  const lockedHint = 'On file — contact HR to change';

  return (
    <form onSubmit={save}>
      <Section title="Personal details">
        <Field label="First name" required>
          <TextInput value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        </Field>
        <Field label="Last name" required>
          <TextInput value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        </Field>
        <Field label="Date of birth" required>
          <TextInput
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.dateOfBirth}
            onChange={(e) => set({ dateOfBirth: e.target.value })}
          />
        </Field>
        <Field label="Marital status" required>
          <Select value={form.maritalStatus} onChange={(e) => set({ maritalStatus: e.target.value })}>
            <option value="">Select</option>
            {MARITAL.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Phone number" required>
          <TextInput type="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="ID number" required>
          <TextInput value={form.nationalId} onChange={(e) => set({ nationalId: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Residential address" required hint="Where you currently live, e.g. estate, town">
            <TextInput value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Statutory details" hint="Enter these once. After they're saved they're locked, and only HR can change them.">
        <Field label="KRA PIN" required hint={locked.kraPin ? lockedHint : 'Format: A123456789Z'}>
          <div className="relative">
            <TextInput
              disabled={locked.kraPin}
              className={locked.kraPin ? 'pr-10' : ''}
              placeholder="A123456789Z"
              value={form.kraPin}
              onChange={(e) => set({ kraPin: e.target.value.toUpperCase() })}
            />
            {locked.kraPin && <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />}
          </div>
        </Field>
        <Field label="NSSF number" required hint={locked.nssfNumber ? lockedHint : undefined}>
          <div className="relative">
            <TextInput
              disabled={locked.nssfNumber}
              className={locked.nssfNumber ? 'pr-10' : ''}
              value={form.nssfNumber}
              onChange={(e) => set({ nssfNumber: e.target.value })}
            />
            {locked.nssfNumber && <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />}
          </div>
        </Field>
      </Section>

      <datalist id="relationships">
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <Section title="Emergency contact" hint="Who should we call if something happens to you at work?">
        <Field label="Full name" required>
          <TextInput value={form.emergencyContact.name} onChange={(e) => setGroup('emergencyContact', { name: e.target.value })} />
        </Field>
        <Field label="Relationship" required>
          <TextInput
            list="relationships"
            value={form.emergencyContact.relationship}
            onChange={(e) => setGroup('emergencyContact', { relationship: e.target.value })}
          />
        </Field>
        <Field label="Phone number" required>
          <TextInput type="tel" value={form.emergencyContact.phone} onChange={(e) => setGroup('emergencyContact', { phone: e.target.value })} />
        </Field>
      </Section>

      <Section title="Next of kin">
        <Field label="Full name" required>
          <TextInput value={form.nextOfKin.name} onChange={(e) => setGroup('nextOfKin', { name: e.target.value })} />
        </Field>
        <Field label="Relationship" required>
          <TextInput list="relationships" value={form.nextOfKin.relationship} onChange={(e) => setGroup('nextOfKin', { relationship: e.target.value })} />
        </Field>
        <Field label="Phone number" required>
          <TextInput type="tel" value={form.nextOfKin.phone} onChange={(e) => setGroup('nextOfKin', { phone: e.target.value })} />
        </Field>
        <Field label="Address (optional)">
          <TextInput value={form.nextOfKin.address} onChange={(e) => setGroup('nextOfKin', { address: e.target.value })} />
        </Field>
      </Section>

      {showReadOnly && (
        <>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <Lock size={13} className="text-muted" /> Managed by HR
          </h3>
          <p className="text-xs text-muted mt-0.5 mb-3">You can’t edit these. If something is wrong, contact HR.</p>
          <div className="card divide-y divide-border mb-6">
            <ReadOnly label="Employee ID" value={readOnly.employeeId} />
            <ReadOnly label="Email" value={readOnly.email} />
            <ReadOnly label="Department" value={readOnly.department} />
            <ReadOnly label="Job title" value={readOnly.jobTitle} />
            <ReadOnly label="Branch" value={readOnly.branch} />
            <ReadOnly label="Employment type" value={readOnly.employmentType} />
            <ReadOnly label="Date joined" value={fmtDate(readOnly.dateJoined)} />
            <ReadOnly label="Contract" value={readOnly.contractStatus} />
            <ReadOnly label="Contract end date" value={fmtDate(readOnly.contractEndDate)} />
            <ReadOnly label="Reports to" value={readOnly.reportingManager} />
            <ReadOnly label="Bank" value={readOnly.bankName} />
            <ReadOnly label="Bank account" value={readOnly.bankAccount} />
          </div>
        </>
      )}

      <div className="flex justify-end sticky bottom-0 bg-surface/90 backdrop-blur py-3 -mx-1 px-1">
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
