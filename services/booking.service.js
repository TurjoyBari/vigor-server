const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const classService = require("./class.service");

function buildSnapshotFields(classData) {
  return {
    className: classData.className,
    trainerName: classData.trainerName || classData.trainer || "Unknown Trainer",
    schedule: classData.schedule || "",
    category: classData.category || "",
    difficulty: classData.difficulty || "",
    duration: classData.duration || "",
    location: classData.location || "VIGOR Studio",
  };
}

/**
 * Serialize booking from MongoDB bookings collection (class snapshot only).
 */
function serializeBooking(booking) {
  const status =
    booking.status ||
    (booking.paymentStatus === "paid" ? "confirmed" : booking.paymentStatus || "pending");

  return {
    id: String(booking._id),
    bookingId: String(booking._id),
    userId: String(booking.userId),
    classId: String(booking.classId),
    className: booking.className || "Unknown Class",
    trainerName: booking.trainerName || "Unknown Trainer",
    schedule: booking.schedule || "",
    category: booking.category || "",
    difficulty: booking.difficulty || "",
    duration: booking.duration || "",
    location: booking.location || "VIGOR Studio",
    status,
    bookedAt: booking.bookedAt,
    createdAt: booking.createdAt || booking.bookedAt,
  };
}

/**
 * Check if user has already booked a class.
 */
async function checkBooking(userId, classId) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  const existing = await bookings.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  return {
    booked: Boolean(existing),
    bookingId: existing ? String(existing._id) : null,
  };
}

/**
 * Book a class for a user (prevents duplicate bookings).
 * Stores class snapshot only — no Stripe/payment fields.
 */
async function bookClass(userId, classId) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const classes = getCollection(COLLECTIONS.CLASSES);

  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  const classDoc = await classes.findOne({ _id: classObjectId });
  if (!classDoc) {
    throw new AppError("Class not found", 404);
  }

  if (classDoc.status !== "approved") {
    throw new AppError("This class is not available for booking", 400);
  }

  const existing = await bookings.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  if (existing) {
    throw new AppError("You have already booked this class", 409);
  }

  const classData = await classService.getClassById(classId);
  const now = new Date();

  const bookingDoc = {
    userId: userObjectId,
    classId: classObjectId,
    ...buildSnapshotFields(classData),
    status: "confirmed",
    bookedAt: now,
    createdAt: now,
  };

  const result = await bookings.insertOne(bookingDoc);

  await classes.updateOne(
    { _id: classObjectId },
    { $inc: { bookingCount: 1 }, $set: { updatedAt: now } }
  );

  const booking = await bookings.findOne({ _id: result.insertedId });
  return serializeBooking(booking);
}

/**
 * Get all bookings for a user from MongoDB bookings collection.
 */
async function getBookingsByUserId(userId) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const userObjectId = toObjectId(userId, "userId");

  const bookingList = await bookings
    .find({ userId: userObjectId })
    .sort({ bookedAt: -1 })
    .toArray();

  return bookingList.map(serializeBooking);
}

/**
 * Get all classes booked by a user.
 */
async function getBookedClasses(userId) {
  return getBookingsByUserId(userId);
}

module.exports = {
  checkBooking,
  bookClass,
  getBookedClasses,
  getBookingsByUserId,
  serializeBooking,
  buildSnapshotFields,
};
