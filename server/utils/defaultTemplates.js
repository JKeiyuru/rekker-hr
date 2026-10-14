// server/utils/defaultTemplates.js
// The September 2026 sheet is the standard template. Mid-Month covers the
// transport / lunch / expense-reimbursement run paid around the 12th.
const col = (key, label, o = {}) => ({
  key, label, group: '', type: 'number', kind: 'info', formula: '', system: false,
  showOnPayslip: false, payslipLabel: '', carryForward: false, inTotals: true, aliases: [], archived: false, ...o,
});

const endMonth = {
  runType: 'End-Month',
  name: 'End-Month Payroll (standard)',
  sections: ['Rekker', 'Store', 'Shop', 'Bellagio', 'Saffron / Cornells'],
  columns: [
    col('acc_type', 'ACC. TYPE', { type: 'text', carryForward: true, inTotals: false, aliases: ['BANK', 'ACC TYPE'] }),
    col('acc_no', 'ACC. NO', { type: 'text', carryForward: true, inTotals: false, aliases: ['ACCOUNT NO', 'ACCOUNT NUMBER'] }),
    col('ot_w1', 'WEEK 1', { group: 'OVERTIME', inTotals: false }),
    col('ot_w2', 'WEEK 2', { group: 'OVERTIME', inTotals: false }),
    col('ot_w3', 'WEEK 3', { group: 'OVERTIME', inTotals: false }),
    col('ot_w4', 'WEEK 4', { group: 'OVERTIME', inTotals: false }),
    col('ot_total', 'TOTAL O/T', { group: 'OVERTIME', type: 'formula', kind: 'earning', formula: 'ot_w1+ot_w2+ot_w3+ot_w4', showOnPayslip: true, payslipLabel: 'Overtime', aliases: ['OVERTIME', 'O/T', 'TOTAL OT'] }),
    col('basic_salary', 'BASIC SALARY', { kind: 'earning', showOnPayslip: true, payslipLabel: 'Basic Salary', carryForward: true, aliases: ['BASIC', 'SALARY'] }),
    col('leave_pay', 'LEAVE PAY', { group: 'ALLOWANCES', kind: 'earning', showOnPayslip: true, payslipLabel: 'Leave Pay' }),
    col('lunch_transport', 'LUNCH/TRANS.', { group: 'ALLOWANCES', kind: 'earning', showOnPayslip: true, payslipLabel: 'Lunch / Transport', aliases: ['LUNCH/TRANSPORT', 'LUNCH', 'TRANSPORT', 'LUNCH/TRANS'] }),
    col('gross_pay', 'GROSS PAY', { group: 'GROSS PAY', type: 'formula', kind: 'gross', system: true, showOnPayslip: true, payslipLabel: 'Gross Pay' }),
    col('advance', 'ADVANCE', { group: 'DEDUCTIONS', kind: 'deduction', showOnPayslip: true, payslipLabel: 'Salary Advance', aliases: ['ADVANCES'] }),
    col('shif', 'SHIF', { group: 'DEDUCTIONS', kind: 'deduction', showOnPayslip: true, payslipLabel: 'SHIF', carryForward: true, aliases: ['SHA', 'NHIF'] }),
    col('nssf_tier1', 'NSSF TIER 1', { group: 'PENSION', kind: 'deduction', showOnPayslip: true, payslipLabel: 'NSSF Tier 1', carryForward: true, aliases: ['NSSF'] }),
    col('britam_tier2', 'BRITAM TIER 2', { group: 'PENSION', kind: 'deduction', showOnPayslip: true, payslipLabel: 'Britam Tier 2 Pension', carryForward: true, aliases: ['BRITAM'] }),
    col('welfare', 'WELFARE', { group: 'DEDUCTIONS', kind: 'deduction', showOnPayslip: true, payslipLabel: 'Welfare', carryForward: true }),
    col('net_pay', 'NET PAY', { group: 'NET PAY', type: 'formula', kind: 'net', system: true, showOnPayslip: true, payslipLabel: 'Net Pay' }),
  ],
};

const midMonth = {
  runType: 'Mid-Month',
  name: 'Mid-Month (transport, lunch & expense reimbursement)',
  sections: ['Rekker', 'Store', 'Shop', 'Bellagio', 'Saffron / Cornells'],
  columns: [
    col('acc_type', 'ACC. TYPE', { type: 'text', carryForward: true, inTotals: false }),
    col('acc_no', 'ACC. NO', { type: 'text', carryForward: true, inTotals: false }),
    col('transport', 'TRANSPORT', { kind: 'earning', showOnPayslip: true, payslipLabel: 'Transport allowance', aliases: ['TRAN', 'TRANS'] }),
    col('lunch', 'LUNCH', { kind: 'earning', showOnPayslip: true, payslipLabel: 'Lunch allowance' }),
    col('exp_first', 'EXPENSES 1ST PERIOD', { group: 'REIMBURSEMENTS', kind: 'earning', showOnPayslip: true, payslipLabel: 'Expenses (1st period)', aliases: ['1ST HALF', 'FIRST HALF'] }),
    col('exp_second', 'EXPENSES 2ND PERIOD', { group: 'REIMBURSEMENTS', kind: 'earning', showOnPayslip: true, payslipLabel: 'Expenses (2nd period)', aliases: ['2ND HALF', 'SECOND HALF'] }),
    col('gross_pay', 'TOTAL', { group: 'TOTAL', type: 'formula', kind: 'gross', system: true, showOnPayslip: true, payslipLabel: 'Total reimbursed', aliases: ['TOTAL'] }),
    col('advance', 'ADVANCE', { group: 'DEDUCTIONS', kind: 'deduction', showOnPayslip: true, payslipLabel: 'Recovered advance' }),
    col('net_pay', 'NET PAID', { group: 'NET', type: 'formula', kind: 'net', system: true, showOnPayslip: true, payslipLabel: 'Net paid' }),
    col('remarks', 'NOTES', { type: 'text', inTotals: false, showOnPayslip: true, payslipLabel: 'Notes' }),
  ],
};

module.exports = { 'End-Month': endMonth, 'Mid-Month': midMonth };
