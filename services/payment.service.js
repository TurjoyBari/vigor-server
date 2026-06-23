const Stripe = require("stripe");
const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const classService = require("./class.service");
const bookingService = require("./booking.service");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new AppError("Stripe secret key is not configured", 500);
  }
  return new Stripe(secretKey);
}

function serializePayment(payment) {
  if (!payment) return null;

  return {
    id: String(payment._id),
    userId: String(payment.userId),
    classId: String(payment.classId),
    transactionId: payment.transactionId,
    stripeSessionId: payment.stripeSessionId,
    stripePaymentIntentId: payment.stripePaymentIntentId || null,
    amount: payment.amount,
    currency: payment.currency,
    paymentStatus: payment.paymentStatus,
    createdAt: payment.createdAt,
  };
}

async function getPaymentBySessionId(stripeSessionId) {
  const payments = getCollection(COLLECTIONS.PAYMENTS);
  return payments.findOne({ stripeSessionId });
}

/**
 * Get all payments for a user from MongoDB payments collection only.
 * No class details — Stripe/payment fields only.
 */
async function getPaymentsByUserId(userId) {
  const payments = getCollection(COLLECTIONS.PAYMENTS);
  const userObjectId = toObjectId(userId, "userId");

  const paymentList = await payments
    .find({ userId: userObjectId })
    .sort({ createdAt: -1 })
    .toArray();

  console.log("Payments from DB for user:", userId, paymentList);

  return paymentList.map(serializePayment);
}

/**
 * Insert class snapshot into bookings collection (no Stripe/payment fields).
 */
async function createBookingSnapshot(userId, classId, classData) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const classes = getCollection(COLLECTIONS.CLASSES);

  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  const existing = await bookings.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  if (existing) {
    return existing;
  }

  const now = new Date();

  const bookingDoc = {
    userId: userObjectId,
    classId: classObjectId,
    className: classData.className,
    trainerName: classData.trainerName || classData.trainer || "Unknown Trainer",
    schedule: classData.schedule || "",
    category: classData.category || "",
    difficulty: classData.difficulty || "",
    duration: classData.duration || "",
    location: classData.location || "VIGOR Studio",
    status: "confirmed",
    bookedAt: now,
    createdAt: now,
  };

  const result = await bookings.insertOne(bookingDoc);

  await classes.updateOne(
    { _id: classObjectId },
    { $inc: { bookingCount: 1 }, $set: { updatedAt: now } }
  );

  return bookings.findOne({ _id: result.insertedId });
}

/**
 * Create Stripe Checkout Session for a class booking.
 */
async function createCheckoutSession(userId, classId) {
  console.log("Creating Stripe session");

  if (!classId) {
    throw new AppError("classId is required", 400);
  }

  const classItem = await classService.getClassById(classId);
  const bookingCheck = await bookingService.checkBooking(userId, classId);

  if (bookingCheck.booked) {
    throw new AppError("You have already booked this class", 409);
  }

  const unitAmount = Math.round(Number(classItem.price) * 100);
  if (!unitAmount || unitAmount < 50) {
    throw new AppError("Invalid class price for checkout", 400);
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: classItem.className,
            description: `VIGOR class with ${classItem.trainer}`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: String(userId),
      classId: String(classId),
    },
    success_url: `${CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${CLIENT_URL}/payment/${classId}`,
  });

  console.log("Checkout session:", session);

  return {
    id: session.id,
    url: session.url,
  };
}

/**
 * Fulfill a completed Checkout Session — save payment + booking separately.
 */
async function fulfillCheckoutSession(session) {
  console.log("Stripe Session:", session);

  const stripeSessionId = session.id;

  const existingPayment = await getPaymentBySessionId(stripeSessionId);
  if (existingPayment) {
    return serializePayment(existingPayment);
  }

  if (session.payment_status !== "paid") {
    throw new AppError("Checkout session is not paid", 400);
  }

  const userId = session.metadata?.userId;
  const classId = session.metadata?.classId;

  if (!userId || !classId) {
    throw new AppError("Checkout session is missing booking metadata", 400);
  }

  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const transactionId = stripePaymentIntentId || stripeSessionId;
  const amount = (session.amount_total || 0) / 100;
  const now = new Date();

  const classData = await classService.getClassById(classId);
  if (!classData) {
    throw new AppError("Class not found", 404);
  }

  const payments = getCollection(COLLECTIONS.PAYMENTS);
  const paymentDoc = {
    userId: toObjectId(userId, "userId"),
    classId: toObjectId(classId, "classId"),
    transactionId,
    stripeSessionId,
    stripePaymentIntentId,
    paymentStatus: "paid",
    amount,
    currency: session.currency || "usd",
    createdAt: now,
  };

  const paymentResult = await payments.insertOne(paymentDoc);
  const savedPayment = await payments.findOne({ _id: paymentResult.insertedId });

  console.log("Payment saved:", savedPayment);

  const savedBooking = await createBookingSnapshot(userId, classId, classData);

  console.log("Booking saved:", savedBooking);

  return serializePayment(savedPayment);
}

/**
 * Verify and parse Stripe webhook payload.
 */
function constructWebhookEvent(rawBody, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError("Stripe webhook secret is not configured", 500);
  }

  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Retrieve checkout session details (success page).
 */
async function retrieveCheckoutSession(sessionId) {
  if (!sessionId) {
    throw new AppError("session_id is required", 400);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "line_items"],
  });

  let payment = await getPaymentBySessionId(session.id);

  if (!payment && session.payment_status === "paid") {
    payment = await fulfillCheckoutSession(session);
  }

  const classId = session.metadata?.classId;
  let classItem = null;

  if (classId) {
    try {
      classItem = await classService.getClassById(classId);
    } catch {
      classItem = null;
    }
  }

  return {
    session: {
      id: session.id,
      paymentStatus: session.payment_status,
      amountTotal: (session.amount_total || 0) / 100,
      currency: session.currency,
    },
    payment: typeof payment === "object" && payment?.id ? payment : serializePayment(payment),
    class: classItem,
  };
}

module.exports = {
  createCheckoutSession,
  fulfillCheckoutSession,
  constructWebhookEvent,
  retrieveCheckoutSession,
  getPaymentBySessionId,
  getPaymentsByUserId,
  serializePayment,
};
