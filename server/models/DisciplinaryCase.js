// server/models/DisciplinaryCase.js
const mongoose = require('mongoose');

const disciplinaryCaseSchema = new mongoose.Schema(
  {
    caseNumber: { type: String, unique: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    category: {
      type: String,
      enum: ['Warning', 'Incident', 'Misconduct', 'Grievance', 'Other'],
      default: 'Incident',
    },
    incidentDate: { type: Date, required: true },
    description: { type: String, required: true },
    employeeExplanation: { type: String },
    meetingDate: { type: Date },
    meetingAttendees: [{ type: String }],
    actionTaken: {
      type: String,
      enum: ['None', 'Verbal Warning', 'Written Warning', 'Final Warning', 'Suspension', 'Termination'],
      default: 'None',
    },
    status: { type: String, enum: ['Open', 'Under Review', 'Closed'], default: 'Open' },
    confidentialNotes: { type: String }, // HR-only, restricted field
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  },
  { timestamps: true }
);

disciplinaryCaseSchema.pre('save', async function (next) {
  if (!this.caseNumber) {
    const { nextSequence } = require('../utils/sequence');
    const seq = await nextSequence('caseNumber', { Model: this.constructor, field: 'caseNumber', prefix: 'CASE' });
    this.caseNumber = `CASE-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('DisciplinaryCase', disciplinaryCaseSchema);
