// server/models/Onboarding.js
const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant' },
    checklist: {
      contractSigned: { type: Boolean, default: false },
      documentsReceived: { type: Boolean, default: false },
      systemAccountCreated: { type: Boolean, default: false },
      assetsIssued: { type: Boolean, default: false },
      introductionCompleted: { type: Boolean, default: false },
      departmentAssigned: { type: Boolean, default: false },
      managerAssigned: { type: Boolean, default: false },
    },
    startDate: { type: Date },
    status: {
      type: String,
      enum: ['In Progress', 'Completed'],
      default: 'In Progress',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

onboardingSchema.pre('save', function (next) {
  const values = Object.values(this.checklist.toObject ? this.checklist.toObject() : this.checklist);
  this.status = values.every(Boolean) ? 'Completed' : 'In Progress';
  next();
});

module.exports = mongoose.model('Onboarding', onboardingSchema);
