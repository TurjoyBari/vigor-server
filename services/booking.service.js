const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const classService = require("./class.service");

function generateTransactionId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function serializeBooking(booking, classDoc) {
  return {
    id: String(booking._id),
    bookingId: String(booking._id),
    classId: String(booking.classId),
    className: classDoc?.className || "Unknown Class",
    trainerName: classDoc?.trainer || classDoc?.trainerName || "Unknown Trainer",
    schedule: classDoc?.schedule || "",
    category: classDoc?.category || "",
    difficulty: classDoc?.difficulty || "",
    duration: classDoc?.duration || "",
    price: classDoc?.price || booking.amount,
    image: classDoc?.image || null,
    paymentStatus: booking.paymentStatus,
    transactionId: booking.transactionId,
    amount: booking.amount,
    status: booking.paymentStatus === "paid" ? "confirmed" : booking.paymentStatus,
    bookedAt: booking.bookedAt,
  };
}

/**
 * Book a class for a user (prevents duplicate bookings).
 */
async function bookClass(userId, classId) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const classes = getCollection(COLLECTIONS.CLASSES);
  const transactions = getCollection(COLLECTIONS.TRANSACTIONS);

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

  const now = new Date();
  const transactionId = generateTransactionId();
  const amount = Number(classDoc.price) || 0;

  const bookingDoc = {
    userId: userObjectId,
    classId: classObjectId,
    transactionId,
    paymentStatus: "paid",
    amount,
    bookedAt: now,
    createdAt: now,
  };

  const result = await bookings.insertOne(bookingDoc);

  await classes.updateOne(
    { _id: classObjectId },
    { $inc: { bookingCount: 1 }, $set: { updatedAt: now } }
  );

  const users = getCollection(COLLECTIONS.USERS);
  const user = await users.findOne({ _id: userObjectId }, { projection: { email: 1 } });

  await transactions.insertOne({
    transactionId,
    userId: userObjectId,
    userEmail: user?.email || "",
    classId: classObjectId,
    amount,
    status: "completed",
    type: "Class Booking",
    createdAt: now,
  });

  const booking = await bookings.findOne({ _id: result.insertedId });
  const serializedClass = await classService.getClassById(classId);

  return serializeBooking(booking, serializedClass);
}

/**
 * Get all classes booked by a user.
 */
async function getBookedClasses(userId) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const userObjectId = toObjectId(userId, "userId");

  const bookingList = await bookings
    .find({ userId: userObjectId })
    .sort({ bookedAt: -1 })
    .toArray();

  if (!bookingList.length) return [];

  const results = await Promise.all(
    bookingList.map(async (booking) => {
      try {
        const classDoc = await classService.getClassById(String(booking.classId));
        return serializeBooking(booking, classDoc);
      } catch {
        return serializeBooking(booking, null);
      }
    })
  );

  return results;
}

module.exports = {
  bookClass,
  getBookedClasses,
};
