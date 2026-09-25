// server/models/LeaveBalance.js
const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    year: { type: Number, required: true, default: () => new Date().getFullYear() },
    annualEntitlement: { type: Number, default: 21 },
    annualUsed: { type: Number, default: 0 },
    sickEntitlement: { type: Number, default: 14 },
    sickUsed: { type: Number, default: 0 },
    maternityEntitlement: { type: Number, default: 90 },
    maternityUsed: { type: Number, default: 0 },
    paternityEntitlement: { type: Number, default: 14 },
    paternityUsed: { type: Number, default: 0 },
    unpaidUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
