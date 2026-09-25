// server/models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Absent', 'On Leave', 'Half Day', 'Holiday'],
      default: 'Present',
    },
    branch: { type: String },
    isLate: { type: Boolean, default: false },
    isEarlyDeparture: { type: Boolean, default: false },
    hoursWorked: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

attendanceSchema.pre('save', function (next) {
  if (this.checkIn && this.checkOut) {
    this.hoursWorked = Math.max(
      0,
      (new Date(this.checkOut) - new Date(this.checkIn)) / (1000 * 60 * 60)
    );
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
