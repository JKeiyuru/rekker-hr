// client/src/utils/leave.js
// One label per application that answers "where is this at?":
//   Pending leave that has been recommended / not recommended shows that
//   recommendation; otherwise the real status (Pending, Approved, Rejected...).
export const leaveStage = (leave) => {
  if (leave.status !== 'Pending') return leave.status;
  const rec = leave.sectionHeadReview?.decision;
  return rec === 'Recommended' || rec === 'Not Recommended' ? rec : 'Pending';
};

export const recommenderName = (review) =>
  review?.byName || (review?.by ? `${review.by.firstName} ${review.by.lastName}` : null);
