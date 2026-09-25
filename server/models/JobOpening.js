// server/models/JobOpening.js
const mongoose = require('mongoose');

const jobOpeningSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    department: { type: String, required: true },
    branch: { type: String },
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Casual'],
      default: 'Full-Time',
    },
    description: { type: String },
    requirements: { type: String },
    openings: { type: Number, default: 1 },
    status: { type: String, enum: ['Open', 'On Hold', 'Closed'], default: 'Open' },
    postedDate: { type: Date, default: Date.now },
    closingDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JobOpening', jobOpeningSchema);
