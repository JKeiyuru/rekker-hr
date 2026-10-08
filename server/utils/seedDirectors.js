// server/utils/seedDirectors.js
// Run with: npm run seed:directors  (from inside /server)
// Adds the two directors who appear on the payroll as employee records
// only - no login accounts. Create director-role logins later from the
// Users page if/when they want to use the system. Safe to re-run.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Employee = require('../models/Employee');
const LeaveBalance = require('../models/LeaveBalance');

const directors = [
  { firstName: 'Alice', lastName: 'Manene', email: 'alice.manene@rekker.co.ke' },
  { firstName: 'Hosea', lastName: 'Kinyua', email: 'hosea.kinyua@rekker.co.ke' },
];

const run = async () => {
  await connectDB();
  for (const d of directors) {
    const exists = await Employee.findOne({ email: d.email });
    if (exists) { console.log(`Already exists: ${d.firstName} ${d.lastName}`); continue; }
    const emp = await Employee.create({
      ...d,
      phone: 'Unknown',
      department: 'Executive',
      role: 'Director',
      branch: 'HQ',
      employmentType: 'Full-Time',
      dateJoined: new Date('2020-01-01'),
      contractStatus: 'Permanent',
      notes: 'Director - on payroll, no system login. Date joined is a placeholder; please correct.',
    });
    await LeaveBalance.create({ employee: emp._id });
    console.log(`Created: ${d.firstName} ${d.lastName}`);
  }
  await mongoose.connection.close();
  process.exit(0);
};
run().catch((e) => { console.error(e); process.exit(1); });
