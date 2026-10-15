// server/controllers/profileController.js
//
// Self-service profile: lets a logged-in user complete and edit THEIR OWN
// personal details. Everything is whitelisted here on the server - the
// employee record's HR-owned fields (department, role, employment type, dates,
// contract, bank details...) are never accepted from this endpoint no matter
// what the request contains.
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { computeCompletion, filled, MARITAL_STATUSES } = require('../utils/profileCompletion');

// Fields the employee may edit freely.
const EDITABLE = ['firstName', 'lastName', 'dateOfBirth', 'maritalStatus', 'phone', 'nationalId', 'address'];
// Fields the employee may only fill in when they are still empty; once set
// they are locked and only HR can change them.
const FILL_ONCE = ['kraPin', 'nssfNumber'];
const CONTACT_FIELDS = {
  emergencyContact: ['name', 'relationship', 'phone'],
  nextOfKin: ['name', 'relationship', 'phone', 'address'],
};

const bad = (res, message) => {
  res.status(400);
  throw new Error(message);
};

// Light format checks, applied only to values the person actually changed so
// existing seeded data is never blocked.
const validators = {
  phone: (v) => /^\+?[\d\s-]{9,16}$/.test(v) || 'Enter a valid phone number, e.g. 0712 345 678',
  nationalId: (v) => /^[A-Za-z0-9]{5,15}$/.test(v) || 'ID number should be 5-15 letters/digits with no spaces',
  kraPin: (v) => /^[AP]\d{9}[A-Z]$/i.test(v) || 'KRA PIN should look like A123456789Z',
  nssfNumber: (v) => /^[A-Za-z0-9-]{4,20}$/.test(v) || 'Enter a valid NSSF number',
  dateOfBirth: (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return 'Enter a valid date of birth';
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return (age >= 16 && age <= 90) || 'Please check your date of birth';
  },
  maritalStatus: (v) => MARITAL_STATUSES.includes(v) || 'Choose a marital status from the list',
};

const maskAccount = (acc) => (acc ? `${'•'.repeat(Math.max(acc.length - 4, 0))}${acc.slice(-4)}` : '');

const sameDay = (a, b) => a && b && new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

// What the client is allowed to see/edit, plus the read-only HR-managed block.
async function buildProfile(employeeId) {
  const emp = await Employee.findById(employeeId).populate('reportingManager', 'firstName lastName');
  const completion = computeCompletion(emp);
  return {
    completion,
    editable: {
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString().slice(0, 10) : '',
      maritalStatus: emp.maritalStatus || '',
      phone: emp.phone || '',
      nationalId: emp.nationalId || '',
      address: emp.address || '',
      kraPin: emp.kraPin || '',
      nssfNumber: emp.nssfNumber || '',
      emergencyContact: {
        name: emp.emergencyContact?.name || '',
        relationship: emp.emergencyContact?.relationship || '',
        phone: emp.emergencyContact?.phone || '',
      },
      nextOfKin: {
        name: emp.nextOfKin?.name || '',
        relationship: emp.nextOfKin?.relationship || '',
        phone: emp.nextOfKin?.phone || '',
        address: emp.nextOfKin?.address || '',
      },
    },
    // true = already on file, so the employee can't change it (HR can)
    locked: { kraPin: filled(emp.kraPin), nssfNumber: filled(emp.nssfNumber) },
    readOnly: {
      employeeId: emp.employeeId,
      email: emp.email,
      photoUrl: emp.photoUrl,
      department: emp.department,
      jobTitle: emp.role,
      branch: emp.branch,
      employmentType: emp.employmentType,
      dateJoined: emp.dateJoined,
      contractStatus: emp.contractStatus,
      contractEndDate: emp.contractEndDate,
      reportingManager: emp.reportingManager ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}` : '',
      bankName: emp.bankName || '',
      bankAccount: maskAccount(emp.bankAccount),
    },
  };
}

const requireEmployeeId = (req, res) => {
  const id = req.user.employee?._id;
  if (!id) {
    res.status(404);
    throw new Error('Your login is not linked to an employee record yet - ask HR to link it.');
  }
  return id;
};

// @desc    Get my profile + how complete it is
// @route   GET /api/profile
const getProfile = asyncHandler(async (req, res) => {
  res.json(await buildProfile(requireEmployeeId(req, res)));
});

// @desc    Update my profile (whitelisted fields only)
// @route   PUT /api/profile
const updateProfile = asyncHandler(async (req, res) => {
  const id = requireEmployeeId(req, res);
  const emp = await Employee.findById(id);
  const body = req.body || {};

  for (const key of EDITABLE) {
    if (body[key] === undefined) continue;
    const value = typeof body[key] === 'string' ? body[key].trim() : body[key];
    const current = key === 'dateOfBirth' ? emp.dateOfBirth : emp[key];
    const unchanged = key === 'dateOfBirth' ? sameDay(value, current) : (current || '') === value;
    if (unchanged) continue;
    if (['firstName', 'lastName', 'phone'].includes(key) && !filled(value)) bad(res, `${key === 'phone' ? 'Phone number' : 'Name'} cannot be empty`);
    if (filled(value) && validators[key]) {
      const ok = validators[key](value);
      if (ok !== true) bad(res, ok);
    }
    emp[key] = key === 'dateOfBirth' && !filled(value) ? undefined : value;
  }

  for (const key of FILL_ONCE) {
    if (body[key] === undefined) continue;
    const value = String(body[key]).trim().toUpperCase();
    const current = emp[key] || '';
    if (value === current.toUpperCase()) continue;
    if (filled(current)) bad(res, `Your ${key === 'kraPin' ? 'KRA PIN' : 'NSSF number'} is already on file and locked. Contact HR to change it.`);
    if (filled(value)) {
      const ok = validators[key](value);
      if (ok !== true) bad(res, ok);
      emp[key] = value;
    }
  }

  for (const [group, fields] of Object.entries(CONTACT_FIELDS)) {
    if (!body[group] || typeof body[group] !== 'object') continue;
    const next = { ...(emp[group]?.toObject?.() || emp[group] || {}) };
    for (const f of fields) {
      if (body[group][f] === undefined) continue;
      const v = String(body[group][f]).trim();
      if (f === 'phone' && filled(v) && v !== next.phone) {
        const ok = validators.phone(v);
        if (ok !== true) bad(res, `${group === 'nextOfKin' ? 'Next of kin' : 'Emergency contact'} phone: ${ok}`);
      }
      next[f] = v;
    }
    emp[group] = next;
  }

  if (!emp.profileCompletedAt && computeCompletion(emp).complete) emp.profileCompletedAt = new Date();
  await emp.save({ validateModifiedOnly: true });

  // Keep the login's display name in step with the employee name.
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  if (fullName && req.user.name !== fullName) await User.findByIdAndUpdate(req.user._id, { name: fullName });

  res.json(await buildProfile(id));
});

module.exports = { getProfile, updateProfile };
