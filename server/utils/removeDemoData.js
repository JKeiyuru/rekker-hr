// server/utils/removeDemoData.js
// Run with: npm run clean:demo  (from inside the /server folder)
//
// Removes ONLY the fictional demo employees/logins that were seeded while
// building/testing the system (Jane, Brian, Faith, Peter, Grace, David) and
// everything that referenced them (leave, attendance, performance reviews,
// asset assignments, training enrolments, documents). It never touches
// admin@rekker.co.ke or any other account/employee - the email list below
// is explicit and nothing outside it is ever deleted.
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

const DEMO_EMAILS = [
  'jane.wanjiru@rekker.co.ke',
  'brian.otieno@rekker.co.ke',
  'faith.njeri@rekker.co.ke',
  'peter.kamau@rekker.co.ke',
  'grace.mwangi@rekker.co.ke',
  'david.kiptoo@rekker.co.ke',
];

const run = async () => {
  await connectDB();

  const employees = await Employee.find({ email: { $in: DEMO_EMAILS } });
  const employeeIds = employees.map((e) => e._id);

  if (employeeIds.length === 0) {
    console.log('No demo employees found (already cleaned up, or never seeded). Nothing to do.');
  } else {
    console.log(`Found ${employeeIds.length} demo employee(s): ${employees.map((e) => `${e.firstName} ${e.lastName}`).join(', ')}`);

    const [
      leaveBalances,
      leaves,
      attendance,
      performance,
      trainingUpdated,
      documents,
      onboarding,
      users,
    ] = await Promise.all([
      LeaveBalance.deleteMany({ employee: { $in: employeeIds } }),
      Leave.deleteMany({ employee: { $in: employeeIds } }),
      Attendance.deleteMany({ employee: { $in: employeeIds } }),
      Performance.deleteMany({ employee: { $in: employeeIds } }),
      Training.updateMany({}, { $pull: { attendees: { employee: { $in: employeeIds } } } }),
      Document.deleteMany({ employee: { $in: employeeIds } }),
      Onboarding.deleteMany({ employee: { $in: employeeIds } }),
      User.deleteMany({ email: { $in: DEMO_EMAILS } }),
    ]);
    await Asset.updateMany({ assignedTo: { $in: employeeIds } }, { $set: { assignedTo: null } });
    await Employee.deleteMany({ _id: { $in: employeeIds } });

    console.log(`Deleted: ${employeeIds.length} employees, ${users.deletedCount} logins, ${leaves.deletedCount} leave applications, ${leaveBalances.deletedCount} leave balances, ${attendance.deletedCount} attendance records, ${performance.deletedCount} performance reviews, ${documents.deletedCount} documents, ${onboarding.deletedCount} onboarding checklists.`);
    console.log('Unassigned them from any assets, and removed them from any training attendee lists.');
  }

  const admin = await User.findOne({ email: 'admin@rekker.co.ke' });
  console.log(admin ? 'Confirmed: admin@rekker.co.ke is untouched.' : 'Note: admin@rekker.co.ke was not found (unexpected - nothing was deleted for it by this script).');

  console.log('Cleanup complete.');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
