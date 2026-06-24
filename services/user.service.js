const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const { serializeUser } = require("./auth.service");

const ALLOWED_ROLES = ["user", "trainer", "admin"];

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
 * Get all users with optional filters.
 */
async function getAllUsers(filters = {}) {
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

  console.log("User status:", target.status);

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

  console.log("User blocked, new status:", result.status);

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

  console.log("User status:", target.status);

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

  console.log("User unblocked, new status:", result.status);

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
