// server/models/Payroll.js
const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    period: { type: String, required: true }, // e.g. "2026-09"
    basicSalary: { type: Number, required: true, default: 0 },
    allowances: [
      {
        name: String,
        amount: Number,
      },
    ],
    deductions: [
      {
        name: String,
        amount: Number,
      },
    ],
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    bonuses: [
      {
        name: String,
        amount: Number,
      },
    ],
    advances: [
      {
        amount: Number,
        date: { type: Date, default: Date.now },
        reason: String,
        repaid: { type: Boolean, default: false },
      },
    ],
    grossPay: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Draft', 'Processed', 'Exported', 'Paid'],
      default: 'Draft',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

payrollSchema.index({ employee: 1, period: 1 }, { unique: true });

payrollSchema.pre('save', function (next) {
  const allowancesTotal = (this.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
  const bonusesTotal = (this.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0);
  const overtimePay = (this.overtimeHours || 0) * (this.overtimeRate || 0);
  const deductionsTotal = (this.deductions || []).reduce((s, d) => s + (d.amount || 0), 0);
  const advancesTotal = (this.advances || [])
    .filter((a) => !a.repaid)
    .reduce((s, a) => s + (a.amount || 0), 0);

  this.grossPay = (this.basicSalary || 0) + allowancesTotal + bonusesTotal + overtimePay;
  this.totalDeductions = deductionsTotal + advancesTotal;
  this.netPay = this.grossPay - this.totalDeductions;
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
