// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, RECOMMENDER_ROLES } = require('../config/roles');

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

    // Department(s) this person heads. Only meaningful for the
    // 'department_manager' (department head) role. Drives both which
    // employees' data they can see and, if recommending is switched on,
    // whose leave they can recommend. Empty = fall back to the department
    // of their linked employee record.
    managedDepartments: [{ type: String, trim: true }],

    // Leave-recommendation permission, granted by an admin per user.
    //   department head -> recommends for managedDepartments
    //   manager         -> recommends for the departments listed here
    leaveRecommendation: {
      enabled: { type: Boolean, default: false },
      departments: [{ type: String, trim: true }],
    },

    // Marks the one (or few) permanent system super admin account(s).
    // This flag is never accepted from API request bodies (see
    // controllers/userController.js and authController.js) - it can only be
    // set directly in the database or via the seed script.
    isSuperAdmin: { type: Boolean, default: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Departments whose leave applications this user may recommend. Derived from
// role + settings so there is exactly one rule, used by the API and exposed
// to the client (as `recommendDepartments`) to decide what to show.
userSchema.virtual('recommendDepartments').get(function () {
  if (!this.leaveRecommendation?.enabled || !RECOMMENDER_ROLES.includes(this.role)) return [];
  if (this.role === 'department_manager') {
    const own = this.managedDepartments?.length
      ? this.managedDepartments
      : this.employee?.department
      ? [this.employee.department]
      : [];
    return [...own];
  }
  return [...(this.leaveRecommendation.departments || [])];
});
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

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
