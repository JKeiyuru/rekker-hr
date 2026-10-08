// server/models/Payroll.js
const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    period: { type: String, required: true }, // e.g. "2026-09"
    // Rekker runs two pay events per month: a Mid-Month run (transport
    // allowance for field staff + reimbursement of expenses incurred in
    // the first half of the month) and an End-Month run (the actual
    // salary payslip, which also reimburses second-half expenses). Each
    // employee can have one record of each per period.
    runType: {
      type: String,
      enum: ['Mid-Month', 'End-Month'],
      default: 'End-Month',
    },

    basicSalary: { type: Number, required: true, default: 0 },
    allowances: [
      {
        name: String, // e.g. "Transport", "Lunch", "House", "Airtime"
        amount: Number,
      },
    ],
    deductions: [
      {
        name: String, // e.g. "PAYE", "NSSF", "SHIF", "Loan Repayment"
        amount: Number,
      },
    ],
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    // If set, this is used directly as the overtime payout instead of
    // overtimeHours * overtimeRate - needed because historically overtime
    // was just recorded as a lump sum per pay period, not hours x rate.
    overtimeAmount: { type: Number },
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
    // Itemised expense reimbursements (e.g. "2 dustcoats, 8 tiewraps"),
    // separate from fixed allowances - these vary run to run.
    expenseReimbursements: [
      {
        description: String,
        amount: Number,
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

    // Set by the bulk-import tool so you can trace which records came
    // from a historical upload vs. being entered normally in the app.
    importedFrom: { type: String },
  },
  { timestamps: true }
);

payrollSchema.index({ employee: 1, period: 1, runType: 1 }, { unique: true });

payrollSchema.pre('save', function (next) {
  const allowancesTotal = (this.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
  const bonusesTotal = (this.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0);
  const reimbursementsTotal = (this.expenseReimbursements || []).reduce((s, r) => s + (r.amount || 0), 0);
  const overtimePay =
    this.overtimeAmount != null && this.overtimeAmount !== ''
      ? Number(this.overtimeAmount)
      : (this.overtimeHours || 0) * (this.overtimeRate || 0);
  const deductionsTotal = (this.deductions || []).reduce((s, d) => s + (d.amount || 0), 0);
  const advancesTotal = (this.advances || [])
    .filter((a) => !a.repaid)
    .reduce((s, a) => s + (a.amount || 0), 0);

  this.grossPay = (this.basicSalary || 0) + allowancesTotal + bonusesTotal + overtimePay + reimbursementsTotal;
  this.totalDeductions = deductionsTotal + advancesTotal;
  this.netPay = this.grossPay - this.totalDeductions;
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
