// server/models/Document.js
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    category: {
      type: String,
      enum: ['Contract', 'ID Copy', 'Certificate', 'Warning Letter', 'Appraisal', 'Payslip', 'Company Policy', 'Other'],
      required: true,
    },
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String },
    expiryDate: { type: Date },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confidential: { type: Boolean, default: false },

    // --- Revision / approval workflow ---
    // A brand-new upload is 'Approved' immediately. An edit to an existing
    // document by the employee who owns it creates a NEW document with
    // status 'Pending Review' and `revisionOf` pointing at the original,
    // which stays 'Approved' (and visible/current) until a manager, HR or
    // admin approves the revision - at which point the original flips to
    // 'Superseded' and the revision becomes 'Approved'. Rejecting a
    // revision just marks it 'Rejected' (kept for the audit trail, hidden
    // from the default list).
    status: {
      type: String,
      enum: ['Approved', 'Pending Review', 'Rejected', 'Superseded'],
      default: 'Approved',
    },
    revisionOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
