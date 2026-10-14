// server/models/PayrollRun.js
// One pay event: a month + run type. Draft -> Approved -> Paid.
// Approving freezes a snapshot of the template so later template edits never
// change a payslip that has already been issued.
const mongoose = require('mongoose');

const runSchema = new mongoose.Schema(
  {
    period: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // YYYY-MM
    runType: { type: String, enum: ['End-Month', 'Mid-Month'], default: 'End-Month' },
    status: { type: String, enum: ['Draft', 'Approved', 'Paid'], default: 'Draft' },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null }, // { columns, payslip, sections }
    notes: { type: String, default: '' },
    importedFrom: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    paidAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
runSchema.index({ period: 1, runType: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', runSchema);
