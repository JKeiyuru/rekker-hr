// client/src/config/roles.js
// Display names + one-line descriptions for each role. The role *keys* are what
// the API stores; department_manager is shown as "Department Head".
export const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee', hint: 'Sees only their own data.' },
  { value: 'department_manager', label: 'Department Head', hint: 'Sees their department(s). Can recommend leave for them if allowed below.' },
  { value: 'manager', label: 'Manager', hint: 'Company-wide operational access. Can recommend leave for the departments you choose below.' },
  { value: 'hr', label: 'HR', hint: 'Full HR access. Makes the final leave decision.' },
  { value: 'director', label: 'Director', hint: 'Company-wide visibility. Makes the final leave decision.' },
  { value: 'accountant', label: 'Accountant', hint: 'Runs payroll. Otherwise a regular employee.' },
  { value: 'admin', label: 'Admin', hint: 'Full access, including user accounts.' },
];

export const roleLabel = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
