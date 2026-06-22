const bookingService = require("../services/booking.service");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");

async function bookClass(req, res) {
  const booking = await bookingService.bookClass(req.user.userId, req.body.classId);
  return sendCreated(res, { booking }, "Class booked successfully");
}

async function getBookedClasses(req, res) {
  const classes = await bookingService.getBookedClasses(req.user.userId);
  return sendSuccess(
    res,
    { classes, total: classes.length },
    "Booked classes fetched successfully"
  );
}

module.exports = {
  bookClass,
  getBookedClasses,
};
