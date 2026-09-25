// server/models/Training.js
const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    attended: { type: Boolean, default: false },
    certificationEarned: { type: Boolean, default: false },
    certificateExpiry: { type: Date },
    score: { type: Number },
  },
  { _id: false }
);

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    provider: { type: String },
    skillsCovered: [{ type: String }],
    startDate: { type: Date },
    endDate: { type: Date },
    cost: { type: Number, default: 0 },
    attendees: [attendeeSchema],
    status: { type: String, enum: ['Planned', 'Ongoing', 'Completed', 'Cancelled'], default: 'Planned' },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Training', trainingSchema);
