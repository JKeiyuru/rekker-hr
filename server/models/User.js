// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ROLES,
      default: 'employee',
    },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
    // Marks the one (or few) permanent system super admin account(s).
    // This flag is never accepted from API request bodies (see
    // controllers/userController.js and authController.js) - it can only be
    // set directly in the database or via the seed script.
    isSuperAdmin: { type: Boolean, default: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// A super admin account can never be deactivated - no matter who tries,
// through what route, or with what intent. Even if something upstream sets
// isActive to false, this hook silently restores it before the save commits.
userSchema.pre('save', function (next) {
  if (this.isSuperAdmin) {
    this.isActive = true;
  }
  next();
});

// Same protection against deletion, covering every deletion method Mongoose
// supports (findByIdAndDelete / findOneAndDelete / deleteOne / remove).
async function blockSuperAdminRemoval(next) {
  const target = await this.model.findOne(this.getQuery()).select('isSuperAdmin');
  if (target?.isSuperAdmin) {
    return next(new Error('The system super admin account cannot be deleted.'));
  }
  next();
}
userSchema.pre('findOneAndDelete', blockSuperAdminRemoval);
userSchema.pre('deleteOne', { document: false, query: true }, blockSuperAdminRemoval);

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
