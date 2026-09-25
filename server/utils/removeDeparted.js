// server/utils/removeDeparted.js
// Run with: npm run clean:departed  (from inside the /server folder)
//
// Removes the 4 people Joseph flagged as no longer with Rekker (found in
// his department/role pass over the credentials sheet on 2026-09-23), in
// case they'd already been created by an earlier run of `seed:employees`.
// Safe to run even if they were never seeded - it just reports nothing to
// do. Cascades the same way clean:demo does: leave/attendance/performance/
// documents/onboarding for them are deleted, assets are unassigned, and
// they're removed from any training attendee lists.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Employee = require('../models/Employee');
const LeaveBalance = require('../models/LeaveBalance');
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const Performance = require('../models/Performance');
const Asset = require('../models/Asset');
const Training = require('../models/Training');
const Document = require('../models/Document');
const Onboarding = require('../models/Onboarding');

const DEPARTED_EMAILS = [
  'charles@rekker.co.ke', // Charles Emmanuel
  'nicholas@rekker.co.ke', // Nicholas Josphat
  'jackson@rekker.co.ke', // Jackson Muriithi
  'brenda@rekker.co.ke', // Brenda Nkatha
];

const run = async () => {
  await connectDB();

  const employees = await Employee.find({ email: { $in: DEPARTED_EMAILS } });
  const employeeIds = employees.map((e) => e._id);

  if (employeeIds.length === 0) {
    console.log('None of the departed staff were found in the database - nothing to remove.');
  } else {
    console.log(
      `Found ${employeeIds.length}: ${employees.map((e) => `${e.firstName} ${e.lastName}`).join(', ')}`
    );

    const [leaveBalances, leaves, attendance, performance, documents, onboarding, users] = await Promise.all([
      LeaveBalance.deleteMany({ employee: { $in: employeeIds } }),
      Leave.deleteMany({ employee: { $in: employeeIds } }),
      Attendance.deleteMany({ employee: { $in: employeeIds } }),
      Performance.deleteMany({ employee: { $in: employeeIds } }),
      Document.deleteMany({ employee: { $in: employeeIds } }),
      Onboarding.deleteMany({ employee: { $in: employeeIds } }),
      User.deleteMany({ email: { $in: DEPARTED_EMAILS } }),
    ]);
    await Training.updateMany({}, { $pull: { attendees: { employee: { $in: employeeIds } } } });
    await Asset.updateMany({ assignedTo: { $in: employeeIds } }, { $set: { assignedTo: null } });
    await Employee.deleteMany({ _id: { $in: employeeIds } });

    console.log(
      `Deleted: ${employeeIds.length} employees, ${users.deletedCount} logins, ${leaves.deletedCount} leave applications, ${leaveBalances.deletedCount} leave balances, ${attendance.deletedCount} attendance records, ${performance.deletedCount} performance reviews, ${documents.deletedCount} documents, ${onboarding.deletedCount} onboarding checklists.`
    );
  }

  console.log('Cleanup complete.');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
