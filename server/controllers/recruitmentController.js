// server/controllers/recruitmentController.js
const asyncHandler = require('express-async-handler');
const JobOpening = require('../models/JobOpening');
const Applicant = require('../models/Applicant');
const Employee = require('../models/Employee');
const Onboarding = require('../models/Onboarding');
const LeaveBalance = require('../models/LeaveBalance');

// ---- Job Openings ----

const getJobOpenings = asyncHandler(async (req, res) => {
  const jobs = await JobOpening.find().sort({ createdAt: -1 });
  const withCounts = await Promise.all(
    jobs.map(async (job) => {
      const applicantCount = await Applicant.countDocuments({ jobOpening: job._id });
      return { ...job.toObject(), applicantCount };
    })
  );
  res.json(withCounts);
});

const createJobOpening = asyncHandler(async (req, res) => {
  const job = await JobOpening.create(req.body);
  res.status(201).json(job);
});

const updateJobOpening = asyncHandler(async (req, res) => {
  const job = await JobOpening.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!job) {
    res.status(404);
    throw new Error('Job opening not found');
  }
  res.json(job);
});

const deleteJobOpening = asyncHandler(async (req, res) => {
  const job = await JobOpening.findByIdAndDelete(req.params.id);
  if (!job) {
    res.status(404);
    throw new Error('Job opening not found');
  }
  await Applicant.deleteMany({ jobOpening: req.params.id });
  res.json({ message: 'Deleted successfully' });
});

// ---- Applicants ----

const getApplicants = asyncHandler(async (req, res) => {
  const { jobOpening, stage } = req.query;
  const filter = {};
  if (jobOpening) filter.jobOpening = jobOpening;
  if (stage) filter.stage = stage;
  const applicants = await Applicant.find(filter)
    .populate('jobOpening', 'title department')
    .sort({ createdAt: -1 });
  res.json(applicants);
});

const createApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.create(req.body);
  res.status(201).json(applicant);
});

const updateApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!applicant) {
    res.status(404);
    throw new Error('Applicant not found');
  }
  res.json(applicant);
});

const deleteApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findByIdAndDelete(req.params.id);
  if (!applicant) {
    res.status(404);
    throw new Error('Applicant not found');
  }
  res.json({ message: 'Deleted successfully' });
});

// @desc    Convert a hired applicant into a full employee record + kick off onboarding
// @route   POST /api/recruitment/applicants/:id/convert
const convertApplicantToEmployee = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id).populate('jobOpening');
  if (!applicant) {
    res.status(404);
    throw new Error('Applicant not found');
  }

  const [firstName, ...rest] = applicant.fullName.split(' ');
  const employeeData = {
    firstName,
    lastName: rest.join(' ') || '-',
    email: applicant.email,
    phone: applicant.phone,
    department: applicant.jobOpening?.department || req.body.department,
    role: applicant.jobOpening?.title || req.body.role,
    branch: req.body.branch || applicant.jobOpening?.branch || 'Head Office',
    employmentType: applicant.jobOpening?.employmentType || 'Full-Time',
    dateJoined: req.body.dateJoined || new Date(),
    contractStatus: 'Probation',
    status: 'Active',
    ...req.body.overrides,
  };

  const employee = await Employee.create(employeeData);
  await LeaveBalance.create({ employee: employee._id });

  applicant.stage = 'Hired';
  applicant.hiringDecision = 'Hire';
  applicant.convertedToEmployee = employee._id;
  await applicant.save();

  const onboarding = await Onboarding.create({
    employee: employee._id,
    applicant: applicant._id,
    startDate: employeeData.dateJoined,
  });

  res.status(201).json({ employee, onboarding });
});

module.exports = {
  getJobOpenings,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening,
  getApplicants,
  createApplicant,
  updateApplicant,
  deleteApplicant,
  convertApplicantToEmployee,
};
