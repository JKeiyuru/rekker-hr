// server/models/Applicant.js
const mongoose = require('mongoose');

const interviewStageSchema = new mongoose.Schema(
  {
    stage: { type: String }, // e.g. "Phone Screen", "Technical", "Final"
    date: { type: Date },
    interviewer: { type: String },
    notes: { type: String },
    outcome: { type: String, enum: ['Pending', 'Passed', 'Failed'], default: 'Pending' },
  },
  { _id: false }
);

const applicantSchema = new mongoose.Schema(
  {
    jobOpening: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening', required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    cvUrl: { type: String },
    coverLetterUrl: { type: String },
    source: { type: String, default: 'Direct' }, // e.g. referral, job board

    stage: {
      type: String,
      enum: ['Applied', 'Shortlisted', 'Interviewing', 'Offer', 'Hired', 'Rejected'],
      default: 'Applied',
    },
    interviews: [interviewStageSchema],
    shortlistNotes: { type: String },
    hiringDecision: { type: String, enum: ['Pending', 'Hire', 'Reject'], default: 'Pending' },
    rejectionReason: { type: String },

    convertedToEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Applicant', applicantSchema);
