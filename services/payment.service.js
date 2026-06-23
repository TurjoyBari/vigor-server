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
 * Create booking + transaction after Stripe confirms payment.
 * Called only from webhook fulfillment (Step 4 will move to booking.service).
 */
async function fulfillPaidBooking(userId, classId, paymentMeta) {
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const classes = getCollection(COLLECTIONS.CLASSES);
  const transactions = getCollection(COLLECTIONS.TRANSACTIONS);

  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  const classDoc = await classes.findOne({ _id: classObjectId });
  if (!classDoc) {
    throw new AppError("Class not found", 404);
  }

  const existing = await bookings.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  const now = new Date();
  const transactionId =
    paymentMeta.stripePaymentIntentId ||
    paymentMeta.stripeSessionId ||
    `txn_${Date.now()}`;

  if (existing) {
    if (existing.paymentStatus !== "paid") {
      await bookings.updateOne(
        { _id: existing._id },
        {
          $set: {
            paymentStatus: "paid",
            transactionId,
            amount: paymentMeta.amount,
            updatedAt: now,
          },
        }
      );
    }
    return bookings.findOne({ _id: existing._id });
  }

  const amount = paymentMeta.amount ?? (Number(classDoc.price) || 0);

  const bookingDoc = {
    userId: userObjectId,
    classId: classObjectId,
    transactionId,
    stripeSessionId: paymentMeta.stripeSessionId,
    stripePaymentIntentId: paymentMeta.stripePaymentIntentId || null,
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
    stripeSessionId: paymentMeta.stripeSessionId,
    createdAt: now,
  });

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
 * Fulfill a completed Checkout Session — save payment + booking.
 */
async function fulfillCheckoutSession(session) {
  console.log("Payment completed:", session);

  const stripeSessionId = session.id;

  const existingPayment = await getPaymentBySessionId(stripeSessionId);
  if (existingPayment) {
    return serializePayment(existingPayment);
  }

  const userId = session.metadata?.userId;
  const classId = session.metadata?.classId;

  if (!userId || !classId) {
    throw new AppError("Checkout session is missing booking metadata", 400);
  }

  if (session.payment_status !== "paid") {
    throw new AppError("Checkout session is not paid", 400);
  }

  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const amount = (session.amount_total || 0) / 100;
  const now = new Date();

  const payments = getCollection(COLLECTIONS.PAYMENTS);
  const paymentDoc = {
    userId: toObjectId(userId, "userId"),
    classId: toObjectId(classId, "classId"),
    stripeSessionId,
    stripePaymentIntentId,
    amount,
    currency: session.currency || "usd",
    paymentStatus: "paid",
    createdAt: now,
  };

  const paymentResult = await payments.insertOne(paymentDoc);

  await fulfillPaidBooking(userId, classId, {
    stripeSessionId,
    stripePaymentIntentId,
    amount,
  });

  const saved = await payments.findOne({ _id: paymentResult.insertedId });
  return serializePayment(saved);
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
  serializePayment,
};
