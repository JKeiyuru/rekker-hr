// server/utils/sequence.js
//
// Generates IDs like REK-0042 / AST-0013 / CASE-0007 safely.
//
// The old approach (`countDocuments() + 1`) breaks the moment any record in
// the sequence is ever deleted: the count goes down, so the next "count + 1"
// can land on a number that's already taken by a record further along in
// the sequence, and MongoDB rejects it as a duplicate key. That's exactly
// what happened when 4 departed employees were removed and re-seeding
// tried to reuse their numbers.
//
// This uses a dedicated Counter collection with an atomic $inc, so the
// number only ever goes up - it's immune to deletions and to two things
// being created at the same instant.
const Counter = require('../models/Counter');

async function nextSequence(name, { Model, field, prefix }) {
  let counter = await Counter.findById(name);

  if (!counter) {
    // First time this sequence has been used - bootstrap it from whatever
    // the highest existing ID already is, so it can never collide with
    // records created before this counter existed.
    const highest = await Model.findOne({ [field]: new RegExp(`^${prefix}-\\d+$`) })
      .sort({ [field]: -1 })
      .lean();
    let start = 0;
    if (highest && highest[field]) {
      const num = parseInt(highest[field].slice(prefix.length + 1), 10);
      if (!Number.isNaN(num)) start = num;
    }
    try {
      counter = await Counter.create({ _id: name, seq: start });
    } catch (err) {
      // Someone else bootstrapped it in the same instant - fine, use theirs.
      counter = await Counter.findById(name);
    }
  }

  const updated = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return updated.seq;
}

module.exports = { nextSequence };
