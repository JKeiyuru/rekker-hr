// server/models/PayrollAudit.js
// Who changed what in payroll, and when.
const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    action: { type: String, required: true }, // e.g. 'run.approve', 'template.save', 'cell.edit'
    period: String,
    runType: String,
    summary: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'at', updatedAt: false } }
);
auditSchema.index({ at: -1 });

module.exports = mongoose.model('PayrollAudit', auditSchema);
