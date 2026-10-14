// server/config/roles.js
// Single source of truth for the role hierarchy, so the User model,
// middleware and every controller all agree on what exists.
//
//   admin               - the system administrator(s). Full access to
//                          everything, including user account management.
//   director            - company leadership. Full visibility everywhere
//                          (like HR), minus user account management.
//   hr                  - HR staff. Full visibility and management of
//                          everyone's HR data, minus user account management.
//   manager             - "overall manager": cross-department operational
//                          manager. Broad access, but not payroll,
//                          disciplinary cases, or user accounts.
//   department_manager  - manages one department only. Sees and manages
//                          data for employees in their own department, and
//                          their own personal data (leave, attendance, etc).
//   accountant          - runs payroll (templates, pay runs, imports, payslip
//                          settings). Everywhere else they are a regular
//                          employee and only see their own data.
//   employee            - a regular staff member. Sees only their own data.
const ROLES = ['admin', 'accountant', 'director', 'hr', 'manager', 'department_manager', 'employee'];

// Roles that see and manage data across the WHOLE company rather than being
// scoped to a single department or to themselves.
const COMPANY_WIDE_ROLES = ['admin', 'director', 'hr', 'manager'];

// Roles allowed to approve/reject things on behalf of other people
// (leave applications, document revisions) - a department_manager is
// included here, but is further restricted to their own department inside
// each controller.
const APPROVER_ROLES = ['admin', 'director', 'hr', 'manager', 'department_manager'];

// Payroll permissions
//   MANAGE  - edit templates, rows, imports; move a run Draft -> Approved
//   APPROVE - approve / mark paid / reopen a run
//   VIEW    - read-only access to payroll runs and reports
const PAYROLL_MANAGE_ROLES = ['admin', 'accountant'];
const PAYROLL_APPROVE_ROLES = ['admin', 'accountant', 'director'];
const PAYROLL_VIEW_ROLES = ['admin', 'accountant', 'director', 'hr'];

module.exports = {
  ROLES,
  COMPANY_WIDE_ROLES,
  APPROVER_ROLES,
  PAYROLL_MANAGE_ROLES,
  PAYROLL_APPROVE_ROLES,
  PAYROLL_VIEW_ROLES,
};
