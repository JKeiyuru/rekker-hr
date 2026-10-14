// server/utils/payrollAliases.js
// Hand-resolved payroll names. The Jan-Sep 2026 sheets use nicknames, other
// names and inconsistent spellings for the same person; this table settles
// the ones automatic matching can't (or would get wrong). Keys are payroll
// names, upper-case, letters and single spaces only.
//
// MATCH     -> an existing employee (by first name + last name [+ department])
// CANONICAL -> a person who is NOT in the system yet: every spelling maps to
//              one canonical name so they are created once.
const MATCH = {
  'STEPHEN MWENDWA': { firstName: 'Stephen', lastName: 'Katila' },
  'JOHN MWANGI': { firstName: 'John', lastName: 'Mwangi', department: 'Merchandising' },
  'JOHN KARIUKI MWANGI': { firstName: 'John', lastName: 'Mwangi', department: 'Merchandising' },
  'JOHN GAKUNDI': { firstName: 'John', lastName: 'Mwangi', department: 'Accounts' },
  'ANTHONY MURIITHI': { firstName: 'Tonny', lastName: 'Murithi' },
  'EDNA': { firstName: 'Dinahvent', lastName: 'Wafula' },
  'JOHN MWIRUTHI': { firstName: 'Neverstone', lastName: 'John' },
  'NEVERSTONE MWIRUTHI': { firstName: 'Neverstone', lastName: 'John' },
  'DAN WANYONYI': { firstName: 'Dangun', lastName: 'Wanyonyi' },
  'DUNCAN WANYONYI': { firstName: 'Dangun', lastName: 'Wanyonyi' },
  'JAMLECK THIURU': { firstName: 'Jamlick', lastName: 'Gakii' },
  'MUIA MUYANGA': { firstName: 'Moris', lastName: 'Muyanga' },
};

const CANONICAL = {
  'JEFF MWAURA': 'JAMES GATIMU MWAURA',
  'MUTUMA': 'NICHOLAS MUTUMA',
};

// Defaults for people created from payroll who need more than "Staff".
const NEW_EMPLOYEE_DEFAULTS = {
  'ALICE MANENE': { department: 'Executive', role: 'Director', branch: 'HQ' },
  'HOSEA KINYUA': { department: 'Executive', role: 'Director', branch: 'HQ' },
};

module.exports = { MATCH, CANONICAL, NEW_EMPLOYEE_DEFAULTS };
