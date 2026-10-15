// server/models/Employee.js
const mongoose = require('mongoose');
const { MARITAL_STATUSES, computeCompletion } = require('../utils/profileCompletion');

const nextOfKinSchema = new mongoose.Schema(
  {
    name: String,
    relationship: String,
    phone: String,
    address: String,
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: String,
    relationship: String,
    phone: String,
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true }, // e.g. REK-0001
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    nationalId: { type: String },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    dateOfBirth: { type: Date },
    maritalStatus: { type: String, enum: [...MARITAL_STATUSES, ''] },

    department: { type: String, required: true },
    role: { type: String, required: true }, // job title
    branch: { type: String, required: true },
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Casual'],
      default: 'Full-Time',
    },
    dateJoined: { type: Date, required: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

    contractStatus: {
      type: String,
      enum: ['Permanent', 'Fixed-Term', 'Probation', 'Expired', 'N/A'],
      default: 'Probation',
    },
    contractEndDate: { type: Date },

    status: {
      type: String,
      enum: ['Active', 'On Leave', 'Suspended', 'Exited'],
      default: 'Active',
    },
    exitDate: { type: Date },
    exitReason: { type: String },

    address: { type: String },
    emergencyContact: emergencyContactSchema,
    nextOfKin: nextOfKinSchema,

    bankName: { type: String },
    bankAccount: { type: String },
    kraPin: { type: String },
    nssfNumber: { type: String },
    nhifNumber: { type: String },

    // Other spellings of this person's name on payroll sheets, so imports
    // recognise them next time (e.g. 'JOHN GAKUNDI', 'JEFF MWAURA').
    payrollAliases: [{ type: String }],

    notes: { type: String },

    // Set the first time the employee's own profile reaches 100%.
    profileCompletedAt: { type: Date },
  },
  { timestamps: true }
);

employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
// How much of the self-service profile is filled in (see utils/profileCompletion.js).
employeeSchema.virtual('profileCompletion').get(function () {
  const { percent, complete } = computeCompletion(this);
  return { percent, complete };
});
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

employeeSchema.pre('save', async function (next) {
  if (!this.employeeId) {
    const { nextSequence } = require('../utils/sequence');
    const seq = await nextSequence('employeeId', { Model: this.constructor, field: 'employeeId', prefix: 'REK' });
    this.employeeId = `REK-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);
