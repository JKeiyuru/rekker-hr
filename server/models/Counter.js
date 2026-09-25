// server/models/Counter.js
// Backs the atomic auto-incrementing IDs used for employeeId, assetTag and
// caseNumber (see utils/sequence.js). One document per named sequence.
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // sequence name, e.g. 'employeeId'
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
