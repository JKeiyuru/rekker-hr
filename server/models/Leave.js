// server/models/Leave.js
// Mirrors Rekker's actual paper "Leave Application Form":
//   Part A (staff)         -> the top-level fields + handover/contact
//   Part B (section head)  -> sectionHeadReview (advisory recommendation)
//   Part C (management)    -> the final decision (status/approver/etc)
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ['Pending', 'Recommended', 'Not Recommended'],
      default: 'Pending',
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    comments: { type: String },
    date: { type: Date },
  },
  { _id: false }
);

const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: {
      type: String,
      enum: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Compassionate', 'Absence', 'Unpaid', 'Study'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String }, // not required for Annual, per the paper form

    // --- Duty handover / cover arrangement (Part A) ---
    handoverPerson: { type: String }, // name of whoever is covering
    handoverDepartment: { type: String }, // their position/department
    handoverDuties: { type: String }, // duties/responsibilities to be covered
    contactAddress: { type: String }, // contact while on leave

    // --- Leave balance snapshot (Part A / auto-filled) ---
    // Only meaningful for leave types tracked in LeaveBalance (Annual,
    // Sick, Maternity, Paternity, Unpaid) - null for Compassionate/Absence.
    balanceBeforeDays: { type: Number },
    balanceAfterDays: { type: Number },

    // --- Part B: Section Head (advisory - doesn't decide the outcome) ---
    sectionHeadReview: { type: reviewSchema, default: () => ({}) },

    // --- Part C: Management (final decision) ---
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending',
    },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    decisionNotes: { type: String },
    decisionDate: { type: Date },

    approvalHistory: [
      {
        action: {
          type: String,
          enum: ['Submitted', 'Recommended', 'Not Recommended', 'Approved', 'Rejected', 'Cancelled'],
        },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        date: { type: Date, default: Date.now },
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Leave', leaveSchema);
