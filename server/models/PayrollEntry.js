// server/models/PayrollEntry.js
// One employee's row in one pay run.
//   values       - what was typed / imported, keyed by template column key
//   cellFormulas - constant expressions behind a typed value, e.g. { lunch: '=5500+4100' }
//   computed     - every column's resolved value (formulas, gross, net)
const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    period: { type: String, required: true },
    runType: { type: String, enum: ['End-Month', 'Mid-Month'], default: 'End-Month' },
    section: { type: String, default: '' },
    payrollName: { type: String, default: '' }, // the name as written on the payroll sheet
    order: { type: Number, default: 0 },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    cellFormulas: { type: mongoose.Schema.Types.Mixed, default: {} },
    computed: { type: mongoose.Schema.Types.Mixed, default: {} },
    gross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true, minimize: false }
);
entrySchema.index({ employee: 1, period: 1, runType: 1 }, { unique: true });
entrySchema.index({ period: 1, runType: 1, order: 1 });

module.exports = mongoose.model('PayrollEntry', entrySchema);
