// server/models/PayrollTemplate.js
// One template per run type (End-Month, Mid-Month). The accountant edits the
// columns here; every pay run is laid out and calculated from them.
const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // stable id used in formulas, e.g. basic_salary
    label: { type: String, required: true, trim: true }, // header shown on the sheet
    group: { type: String, default: '' }, // band above the header, e.g. DEDUCTIONS
    type: { type: String, enum: ['text', 'number', 'formula'], default: 'number' },
    kind: { type: String, enum: ['info', 'earning', 'deduction', 'gross', 'net'], default: 'info' },
    formula: { type: String, default: '' },
    system: { type: Boolean, default: false }, // gross / net can't be deleted
    showOnPayslip: { type: Boolean, default: false },
    payslipLabel: { type: String, default: '' }, // optional friendlier name on the payslip
    carryForward: { type: Boolean, default: false }, // copied into next month's run
    inTotals: { type: Boolean, default: true }, // included in the totals rows
    aliases: [{ type: String }], // other header names that map here on Excel import
    archived: { type: Boolean, default: false }, // hidden, but history keeps its values
  },
  { _id: false }
);

const payslipSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'REKKER LIMITED' },
    title: { type: String, default: 'PAYSLIP' },
    footerNote: { type: String, default: 'This is a computer-generated payslip and does not require a signature.' },
    showBankDetails: { type: Boolean, default: true },
    showStatutoryNumbers: { type: Boolean, default: true }, // KRA PIN, NSSF
    hideZeroLines: { type: Boolean, default: true },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    runType: { type: String, enum: ['End-Month', 'Mid-Month'], required: true, unique: true },
    name: { type: String, default: '' },
    columns: [columnSchema],
    sections: [{ type: String }], // row groups, e.g. Rekker, Store, Shop
    payslip: { type: payslipSchema, default: () => ({}) },
    version: { type: Number, default: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayrollTemplate', templateSchema);
