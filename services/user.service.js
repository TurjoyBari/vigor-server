const { getCollection, getDb, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const { serializeUser } = require("./auth.service");

const ALLOWED_ROLES = ["user", "trainer", "admin"];
/** Better Auth stores registered accounts in the `user` collection */
const BETTER_AUTH_USER_COLLECTION = "user";

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function validateCreatePayload({ name, email, role = "user" }) {
  if (!name?.trim()) {
    throw new AppError("Name is required", 400);
  }

  if (!email?.trim()) {
    throw new AppError("Email is required", 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError("Invalid email address", 400);
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError("Invalid role. Must be user, trainer, or admin", 400);
  }
}

/**
 * Create a new user in the users collection.
 */
async function createUser(payload) {
  const { name, email, image = null, role = "user" } = payload;

  validateCreatePayload({ name, email, role });

  const users = getCollection(COLLECTIONS.USERS);
  const normalizedEmail = normalizeEmail(email);

  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError("A user with this email already exists", 409);
  }

  const now = new Date();
  const doc = {
    name: name.trim(),
    email: normalizedEmail,
    image,
    role,
    status: "active",
    isBlocked: false,
    trainerApplicationStatus: null,
    trainerFeedback: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await users.insertOne(doc);
  const user = await users.findOne({ _id: result.insertedId });

  return serializeUser(user);
}

/**
 * Get a single user by id.
 */
async function getUserById(userId) {
  const users = getCollection(COLLECTIONS.USERS);
  const user = await users.findOne(
    { _id: toObjectId(userId, "userId") },
    { projection: { password: 0 } }
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return serializeUser(user);
}

/**
 * Bulk-insert Better Auth accounts that are not yet in VIGOR `users`.
 * Uses a single aggregation so already-synced users add almost no overhead.
 */
async function syncMissingUsersFromAuthCollection() {
  const usersCol = getCollection(COLLECTIONS.USERS);
  const authCol = getDb().collection(BETTER_AUTH_USER_COLLECTION);

  const missing = await authCol
    .aggregate([
      { $match: { email: { $exists: true, $nin: [null, ""] } } },
      {
        $project: {
          email: { $toLower: { $trim: { input: "$email" } } },
          name: 1,
          role: 1,
          image: 1,
          isBlocked: 1,
          createdAt: 1,
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.USERS,
          localField: "email",
          foreignField: "email",
          as: "vigorUser",
        },
      },
      { $match: { vigorUser: { $size: 0 } } },
      { $project: { vigorUser: 0 } },
    ])
    .toArray();

  if (!missing.length) return;

  const now = new Date();
  const operations = missing.map((authUser) => ({
    updateOne: {
      filter: { email: authUser.email },
      update: {
        $set: {
          name: authUser.name || authUser.email.split("@")[0],
          email: authUser.email,
          image: authUser.image ?? null,
          role: authUser.role || "user",
          authUserId: String(authUser._id),
          updatedAt: now,
        },
        $setOnInsert: {
          status: authUser.isBlocked ? "blocked" : "active",
          isBlocked: Boolean(authUser.isBlocked),
          trainerApplicationStatus: null,
          trainerFeedback: null,
          createdAt: authUser.createdAt || now,
        },
      },
      upsert: true,
    },
  }));

  await usersCol.bulkWrite(operations, { ordered: false });
}

/**
 * Get all users with optional filters.
 */
async function getAllUsers(filters = {}) {
  await syncMissingUsersFromAuthCollection();

  const users = getCollection(COLLECTIONS.USERS);
  const query = {};

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    const regex = new RegExp(filters.search.trim(), "i");
    query.$or = [{ name: regex }, { email: regex }];
  }

  const list = await users
    .find(query, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return list.map(serializeUser);
}

/**
 * Block a user account.
 */
async function blockUser(userId, actorId) {
  if (String(userId) === String(actorId)) {
    throw new AppError("You cannot block your own account", 400);
  }

  const users = getCollection(COLLECTIONS.USERS);
  const objectId = toObjectId(userId, "userId");

  const target = await users.findOne(
    { _id: objectId },
    { projection: { role: 1, status: 1 } }
  );

  if (!target) {
    throw new AppError("User not found", 404);
  }

  // console.log("User status:", target.status);

  if (target.role === "admin") {
    throw new AppError("Admin accounts cannot be blocked", 400);
  }

  const result = await users.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        status: "blocked",
        isBlocked: true,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    throw new AppError("User not found", 404);
  }

  // console.log("User blocked, new status:", result.status);

  return serializeUser(result);
}

/**
 * Unblock a user account.
 */
async function unblockUser(userId) {
  const users = getCollection(COLLECTIONS.USERS);
  const objectId = toObjectId(userId, "userId");

  const target = await users.findOne(
    { _id: objectId },
    { projection: { status: 1 } }
  );

  if (!target) {
    throw new AppError("User not found", 404);
  }

  // console.log("User status:", target.status);

  const result = await users.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        status: "active",
        isBlocked: false,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    throw new AppError("User not found", 404);
  }

  // console.log("User unblocked, new status:", result.status);

  return serializeUser(result);
}

/**
 * Promote a user to admin role.
 */
async function makeAdmin(userId) {
  const users = getCollection(COLLECTIONS.USERS);
  const result = await users.findOneAndUpdate(
    { _id: toObjectId(userId, "userId") },
    {
      $set: {
        role: "admin",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    throw new AppError("User not found", 404);
  }

  return serializeUser(result);
}

module.exports = {
  createUser,
  getUserById,
  getAllUsers,
  blockUser,
  unblockUser,
  makeAdmin,
};
