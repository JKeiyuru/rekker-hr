// server/utils/seed.js
// Run with: npm run seed  (from inside the /server folder)
// Creates/repairs the one super admin account. Safe to re-run any time.
//
// For real employee data, see: npm run seed:employees
// To remove the old fictional demo employees, see: npm run clean:demo
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const run = async () => {
  await connectDB();

  const adminEmail = 'admin@rekker.co.ke';
  const existingAdmin = await User.findOne({ email: adminEmail }).select('+password');
  if (existingAdmin) {
    existingAdmin.isActive = true;
    existingAdmin.isSuperAdmin = true;
    existingAdmin.role = 'admin';
    await existingAdmin.save();
    console.log('Admin account found — reactivated and confirmed as super admin:');
    console.log('  email: admin@rekker.co.ke');
    console.log('  (password left unchanged; use the app to reset it if needed)');
  } else {
    await User.create({
      name: 'System Administrator',
      email: adminEmail,
      password: 'Rekker@2026',
      role: 'admin',
      isSuperAdmin: true,
    });
    console.log('Created admin login:');
    console.log('  email:    admin@rekker.co.ke');
    console.log('  password: Rekker@2026');
    console.log('  (please change this password after your first login)');
  }

  console.log('Seed complete.');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
