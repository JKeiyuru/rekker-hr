// server/utils/userAccess.js
//
// Validates and normalises the "access settings" an admin can put on a user
// account: role, the department(s) a department head heads, and whether
// (and for which departments) they may recommend leave. One function so
// creating an account and editing one follow exactly the same rules.
const Employee = require('../models/Employee');
const { ROLES, RECOMMENDER_ROLES } = require('../config/roles');

const cleanList = (list) =>
  [...new Set((Array.isArray(list) ? list : []).map((d) => String(d || '').trim()).filter(Boolean))];

// Throws an Error with `.status = 400` on invalid input. Returns the fields to
// write onto the user: { role, managedDepartments, leaveRecommendation }.
//
//   current - the user's existing values (for edits; {} for a new account)
//   input   - request body (any of role / managedDepartments / leaveRecommendation)
async function resolveAccess(current, input) {
  const bad = (message) => Object.assign(new Error(message), { status: 400 });

  const role = input.role !== undefined ? input.role : current.role || 'employee';
  if (!ROLES.includes(role)) throw bad(`Unknown role '${role}'`);

  const managedDepartments =
    role === 'department_manager'
      ? input.managedDepartments !== undefined
        ? cleanList(input.managedDepartments)
        : cleanList(current.managedDepartments)
      : [];

  const currentRec = current.leaveRecommendation || {};
  const inRec = input.leaveRecommendation || {};
  const enabled = RECOMMENDER_ROLES.includes(role)
    ? inRec.enabled !== undefined
      ? !!inRec.enabled
      : !!currentRec.enabled
    : false;
  // A department head recommends for the department(s) they head (stored
  // empty, derived at runtime); a manager recommends for the chosen ones.
  const recDepartments =
    enabled && role === 'manager'
      ? inRec.departments !== undefined
        ? cleanList(inRec.departments)
        : cleanList(currentRec.departments)
      : [];

  const touched = input.role !== undefined || input.managedDepartments !== undefined || input.leaveRecommendation !== undefined;
  if (touched) {
    if (role === 'department_manager' && managedDepartments.length === 0) {
      throw bad('Choose the department this department head is in charge of');
    }
    if (role === 'manager' && enabled && recDepartments.length === 0) {
      throw bad('Choose at least one department this manager can recommend leave for');
    }
    const known = await Employee.distinct('department');
    const unknown = [...managedDepartments, ...recDepartments].filter((d) => !known.includes(d));
    if (unknown.length) throw bad(`Unknown department: ${[...new Set(unknown)].join(', ')}`);
  }

  return { role, managedDepartments, leaveRecommendation: { enabled, departments: recDepartments } };
}

module.exports = { resolveAccess };
