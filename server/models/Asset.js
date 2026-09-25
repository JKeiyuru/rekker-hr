// server/models/Asset.js
const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    assetTag: { type: String, unique: true },
    category: {
      type: String,
      enum: ['Laptop', 'Phone', 'SIM Card', 'Uniform', 'ID/Access Card', 'Company Vehicle', 'Tools/Equipment', 'Other'],
      required: true,
    },
    name: { type: String, required: true }, // e.g. "HP ProBook 450"
    serialNumber: { type: String },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    issuedDate: { type: Date },
    condition: { type: String, enum: ['New', 'Good', 'Fair', 'Damaged'], default: 'Good' },
    status: {
      type: String,
      enum: ['Active', 'Returned', 'Lost', 'Damaged', 'In Storage'],
      default: 'Active',
    },
    returnDate: { type: Date },
    returnChecklist: {
      physicalConditionChecked: { type: Boolean, default: false },
      dataWiped: { type: Boolean, default: false },
      accessoriesReturned: { type: Boolean, default: false },
      signedOff: { type: Boolean, default: false },
    },
    notes: { type: String },
  },
  { timestamps: true }
);

assetSchema.pre('save', async function (next) {
  if (!this.assetTag) {
    const { nextSequence } = require('../utils/sequence');
    const seq = await nextSequence('assetTag', { Model: this.constructor, field: 'assetTag', prefix: 'AST' });
    this.assetTag = `AST-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Asset', assetSchema);
