// server/utils/seedEmployees.js
// Run with: npm run seed:employees  (from inside the /server folder)
//
// Seeds the 45 real employees from Joseph's Bio Data Sheet, each with a
// login account (role: 'employee' for every one of them - promote managers
// yourself via the Users page once you know who they are). Safe to re-run:
// each record is matched by national ID (falling back to email), so it
// only creates what's missing and never duplicates or overwrites data
// you've since edited by hand.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Employee = require('../models/Employee');
const LeaveBalance = require('../models/LeaveBalance');
const realEmployees = require('./realEmployeesData');

const run = async () => {
  await connectDB();

  let createdEmployees = 0;
  let createdUsers = 0;
  let skipped = 0;

  for (const data of realEmployees) {
    let employee = data.nationalId
      ? await Employee.findOne({ nationalId: data.nationalId })
      : null;
    if (!employee) employee = await Employee.findOne({ email: data.email });

    if (!employee) {
      employee = await Employee.create({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || 'Unknown',
        gender: data.gender || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        department: data.department || 'Unassigned',
        role: data.role || 'Staff',
        branch: data.branch || 'HQ',
        employmentType: 'Full-Time',
        dateJoined: data.dateJoined,
        nationalId: data.nationalId || undefined,
        kraPin: data.kraPin || undefined,
        nssfNumber: data.nssfNumber || undefined,
        notes: data.notes || undefined,
      });
      await LeaveBalance.create({ employee: employee._id });
      createdEmployees++;
    } else {
      skipped++;
    }

    const existingUser = await User.findOne({ email: data.email });
    if (!existingUser) {
      await User.create({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        password: data.password,
        role: 'employee',
        employee: employee._id,
      });
      createdUsers++;
    }
  }

  console.log(`Employees created: ${createdEmployees}`);
  console.log(`Logins created:    ${createdUsers}`);
  console.log(`Already existed (skipped): ${skipped}`);
  console.log('Every new login was created with role "employee" - promote');
  console.log('department managers/managers/directors via the Users page.');
  console.log('Seed complete.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
