// server/utils/profileCompletion.js
//
// The single definition of what "a complete profile" means. Used by the
// profile API (to show progress and decide whether to prompt at login) and by
// the Employee model (so HR can see who still has gaps).
//
// Bank details are deliberately NOT here: HR sets them and employees can't
// edit them, so they can't be something the employee is asked to complete.
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const at = (emp, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), emp);

const REQUIRED = [
  { key: 'firstName', label: 'First name', section: 'Personal details' },
  { key: 'lastName', label: 'Last name', section: 'Personal details' },
  { key: 'dateOfBirth', label: 'Date of birth', section: 'Personal details' },
  { key: 'maritalStatus', label: 'Marital status', section: 'Personal details' },
  { key: 'phone', label: 'Phone number', section: 'Personal details' },
  { key: 'nationalId', label: 'ID number', section: 'Personal details' },
  { key: 'address', label: 'Residential address', section: 'Personal details' },
  { key: 'kraPin', label: 'KRA PIN', section: 'Statutory details' },
  { key: 'nssfNumber', label: 'NSSF number', section: 'Statutory details' },
  { key: 'emergencyContact.name', label: 'Emergency contact name', section: 'Emergency contact' },
  { key: 'emergencyContact.relationship', label: 'Emergency contact relationship', section: 'Emergency contact' },
  { key: 'emergencyContact.phone', label: 'Emergency contact phone', section: 'Emergency contact' },
  { key: 'nextOfKin.name', label: 'Next of kin name', section: 'Next of kin' },
  { key: 'nextOfKin.relationship', label: 'Next of kin relationship', section: 'Next of kin' },
  { key: 'nextOfKin.phone', label: 'Next of kin phone', section: 'Next of kin' },
];

// -> { percent, done, total, complete, missing: [{ key, label, section }] }
function computeCompletion(emp) {
  const missing = REQUIRED.filter((f) => !filled(at(emp, f.key)));
  const total = REQUIRED.length;
  const done = total - missing.length;
  return {
    percent: Math.round((done / total) * 100),
    done,
    total,
    complete: missing.length === 0,
    missing,
  };
}

module.exports = { REQUIRED, MARITAL_STATUSES, computeCompletion, filled };
