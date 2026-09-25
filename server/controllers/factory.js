// server/controllers/factory.js
// A small generic CRUD factory so simple resources don't need repetitive boilerplate.
// Modules with special business logic (auth, employees, leave, payroll, attendance)
// have their own dedicated controllers instead of using this factory.
const asyncHandler = require('express-async-handler');

const getAll = (Model, populate = []) =>
  asyncHandler(async (req, res) => {
    let query = Model.find(req.queryFilter || {}).sort({ createdAt: -1 });
    populate.forEach((p) => (query = query.populate(p)));
    const docs = await query;
    res.json(docs);
  });

const getOne = (Model, populate = []) =>
  asyncHandler(async (req, res) => {
    let query = Model.findById(req.params.id);
    populate.forEach((p) => (query = query.populate(p)));
    const doc = await query;
    if (!doc) {
      res.status(404);
      throw new Error('Record not found');
    }
    res.json(doc);
  });

const createOne = (Model) =>
  asyncHandler(async (req, res) => {
    const doc = await Model.create(req.body);
    res.status(201).json(doc);
  });

const updateOne = (Model) =>
  asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) {
      res.status(404);
      throw new Error('Record not found');
    }
    res.json(doc);
  });

const deleteOne = (Model) =>
  asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error('Record not found');
    }
    res.json({ message: 'Deleted successfully' });
  });

module.exports = { getAll, getOne, createOne, updateOne, deleteOne };
