// server/models/Performance.js
const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    title: String,
    target: Number,
    actual: Number,
    unit: { type: String, default: 'KES' },
    weight: { type: Number, default: 100 }, // percentage weight of this goal
  },
  { _id: false }
);

const performanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    period: { type: String, required: true }, // e.g. "2026-Q3" or "2026-09"
    reviewType: { type: String, enum: ['Monthly', 'Quarterly', 'Annual'], default: 'Monthly' },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

    goals: [goalSchema],
    achievementPercent: { type: Number, default: 0 },
    attendancePercent: { type: Number, default: 0 },
    managerRating: { type: Number, min: 1, max: 5 },
    overallScore: { type: Number, default: 0 },

    strengths: { type: String },
    areasForImprovement: { type: String },
    improvementPlan: { type: String },
    recognition: { type: String }, // commendations

    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Acknowledged', 'Finalized'],
      default: 'Draft',
    },
    reviewDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

performanceSchema.pre('save', function (next) {
  if (this.goals && this.goals.length) {
    const totalWeight = this.goals.reduce((s, g) => s + (g.weight || 0), 0) || 100;
    const weighted = this.goals.reduce((s, g) => {
      const pct = g.target ? Math.min((g.actual || 0) / g.target, 1.5) * 100 : 0;
      return s + pct * ((g.weight || 0) / totalWeight);
    }, 0);
    this.achievementPercent = Math.round(weighted * 10) / 10;
  }
  next();
});

module.exports = mongoose.model('Performance', performanceSchema);
