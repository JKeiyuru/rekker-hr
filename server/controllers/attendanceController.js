// server/controllers/attendanceController.js
const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const { scopeFilter, resolveTargetEmployee, isWithinScope } = require('../middleware/scope');

const START_OF_DAY_HOUR = 8; // 08:00 counts as on-time cutoff reference
const LATE_CUTOFF_MINUTES = 15; // grace period after official start time

// @desc    Get attendance records (supports ?date=&employee=&status=&from=&to=)
// @route   GET /api/attendance
const getAttendance = asyncHandler(async (req, res) => {
  const { date, employee, status, from, to, branch } = req.query;
  const filter = { ...scopeFilter(req.scope) };
  // A caller may further narrow within their own scope (e.g. a department
  // manager filtering to one person in their department) but never outside
  // it - isWithinScope guards that.
  if (employee && isWithinScope(req.scope, employee)) filter.employee = employee;
  if (status) filter.status = status;
  if (branch) filter.branch = branch;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  } else if (from && to) {
    filter.date = { $gte: new Date(from), $lte: new Date(to) };
  }

  const records = await Attendance.find(filter)
    .populate('employee', 'firstName lastName employeeId department branch photoUrl')
    .sort({ date: -1 });
  res.json(records);
});

// @desc    Check in an employee for today
// @route   POST /api/attendance/checkin
const checkIn = asyncHandler(async (req, res) => {
  const { branch } = req.body;
  const employee = resolveTargetEmployee(req.scope, req.body.employee);
  if (!employee) {
    res.status(400);
    throw new Error('Your login is not linked to an employee record yet');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let record = await Attendance.findOne({ employee, date: today });
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(START_OF_DAY_HOUR, LATE_CUTOFF_MINUTES, 0, 0);
  const isLate = now > cutoff;

  if (record) {
    record.checkIn = now;
    record.isLate = isLate;
    record.status = isLate ? 'Late' : 'Present';
    await record.save();
  } else {
    record = await Attendance.create({
      employee,
      date: today,
      checkIn: now,
      branch,
      isLate,
      status: isLate ? 'Late' : 'Present',
    });
  }
  res.status(201).json(record);
});

// @desc    Check out an employee for today
// @route   POST /api/attendance/checkout
const checkOut = asyncHandler(async (req, res) => {
  const { earlyDepartureCutoffHour } = req.body;
  const employee = resolveTargetEmployee(req.scope, req.body.employee);
  if (!employee) {
    res.status(400);
    throw new Error('Your login is not linked to an employee record yet');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const record = await Attendance.findOne({ employee, date: today });
  if (!record) {
    res.status(404);
    throw new Error('No check-in found for today');
  }
  const now = new Date();
  record.checkOut = now;
  if (earlyDepartureCutoffHour) {
    const cutoff = new Date(now);
    cutoff.setHours(earlyDepartureCutoffHour, 0, 0, 0);
    record.isEarlyDeparture = now < cutoff;
  }
  await record.save();
  res.json(record);
});

// @desc    Manually create/update an attendance record (HR/manager override)
// @route   POST /api/attendance
const upsertAttendance = asyncHandler(async (req, res) => {
  const employee = resolveTargetEmployee(req.scope, req.body.employee);
  if (!employee) {
    res.status(403);
    throw new Error("You don't have access to record attendance for this employee");
  }
  const day = new Date(req.body.date);
  day.setHours(0, 0, 0, 0);

  const record = await Attendance.findOneAndUpdate(
    { employee, date: day },
    { ...req.body, employee, date: day },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(record);
});

// @desc    Update an attendance record
// @route   PUT /api/attendance/:id
const updateAttendance = asyncHandler(async (req, res) => {
  const existing = await Attendance.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  if (!isWithinScope(req.scope, existing.employee)) {
    res.status(403);
    throw new Error("You don't have access to this attendance record");
  }
  const record = await Attendance.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.json(record);
});

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
const deleteAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  res.json({ message: 'Deleted successfully' });
});

// @desc    Attendance summary for a date range, grouped by employee
// @route   GET /api/attendance/summary
const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = { ...scopeFilter(req.scope) };
  if (from && to) match.date = { $gte: new Date(from), $lte: new Date(to) };

  const summary = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$employee',
        present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        totalHours: { $sum: '$hoursWorked' },
        daysRecorded: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: '_id',
        as: 'employee',
      },
    },
    { $unwind: '$employee' },
    {
      $project: {
        employee: { firstName: 1, lastName: 1, employeeId: 1, department: 1 },
        present: 1,
        late: 1,
        absent: 1,
        totalHours: 1,
        daysRecorded: 1,
      },
    },
  ]);

  res.json(summary);
});

module.exports = {
  getAttendance,
  checkIn,
  checkOut,
  upsertAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceSummary,
};
