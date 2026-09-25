// server/middleware/scope.js
//
// This is the fix for "every logged-in user can see everyone's data".
// It runs after `protect` on every route that returns or touches
// per-employee records, and attaches `req.scope` describing exactly what
// the current user is allowed to see:
//
//   { type: 'all' }                                    - company-wide roles
//   { type: 'department', employeeIds, department, ownEmployeeId } - a
//                                                          department manager
//   { type: 'self', employeeId }                       - everyone else
//
// Controllers then use the helpers below to turn that into a Mongo filter
// and to check/enforce it on writes. This is enforced server-side - the
// frontend never decides what a user can see, it just renders whatever the
// API actually returns.
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const { COMPANY_WIDE_ROLES } = require('../config/roles');

const attachScope = asyncHandler(async (req, res, next) => {
  const user = req.user;

  if (COMPANY_WIDE_ROLES.includes(user.role)) {
    req.scope = { type: 'all' };
    return next();
  }

  if (!user.employee) {
    // A department_manager/employee account with no linked employee record
    // has no data of their own yet - treat as "sees nothing" rather than
    // erroring, so the UI still loads (just empty).
    req.scope = { type: 'self', employeeId: null };
    return next();
  }

  if (user.role === 'department_manager') {
    const deptEmployees = await Employee.find({ department: user.employee.department }).select('_id');
    req.scope = {
      type: 'department',
      department: user.employee.department,
      employeeIds: deptEmployees.map((e) => e._id),
      ownEmployeeId: user.employee._id,
    };
    return next();
  }

  req.scope = { type: 'self', employeeId: user.employee._id };
  next();
});

// Builds a Mongo filter fragment for a document whose "owning employee" is
// stored in `fieldName` (defaults to "employee").
function scopeFilter(scope, fieldName = 'employee') {
  if (scope.type === 'all') return {};
  if (scope.type === 'department') return { [fieldName]: { $in: scope.employeeIds } };
  return { [fieldName]: scope.employeeId };
}

// True if the given employee ObjectId falls within the current scope -
// used to guard single-record reads/writes (GET /:id, PUT /:id, etc).
function isWithinScope(scope, employeeId) {
  if (!employeeId) return false;
  const id = employeeId.toString ? employeeId.toString() : employeeId;
  if (scope.type === 'all') return true;
  if (scope.type === 'department') return scope.employeeIds.some((e) => e.toString() === id);
  return scope.employeeId && scope.employeeId.toString() === id;
}

// Resolves which employee ID a write should be attributed to:
// - company-wide roles may target whoever they specified in the request
// - everyone else is always forced onto their own record, no matter what
//   the request body says (so nobody can apply leave, upload a document,
//   etc. "as" someone else just by editing a form field).
function resolveTargetEmployee(scope, requestedEmployeeId) {
  if (scope.type === 'all') return requestedEmployeeId;
  if (scope.type === 'department') {
    if (requestedEmployeeId && isWithinScope(scope, requestedEmployeeId)) return requestedEmployeeId;
    return scope.ownEmployeeId;
  }
  return scope.employeeId;
}

module.exports = { attachScope, scopeFilter, isWithinScope, resolveTargetEmployee };
