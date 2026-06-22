const { getDb, getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/jwt");
const { isValidObjectId, toObjectId } = require("../utils/objectId");

const BETTER_AUTH_USER_COLLECTION = "user";

/**
 * Shape user document for API responses (no sensitive fields).
 */
function serializeUser(user) {
  if (!user) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image || null,
    role: user.role || "user",
    status: user.status || "active",
    trainerApplicationStatus: user.trainerApplicationStatus ?? null,
    trainerFeedback: user.trainerFeedback ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Load user from Better Auth `user` collection by id.
 */
async function findBetterAuthUser(authUserId) {
  if (!authUserId) return null;

  const authUsers = getDb().collection(BETTER_AUTH_USER_COLLECTION);

  if (isValidObjectId(authUserId)) {
    return authUsers.findOne({ _id: toObjectId(authUserId) });
  }

  return authUsers.findOne({ id: authUserId });
}

/**
 * Sync Better Auth user into VIGOR `users` collection (upsert by email).
 */
async function syncUserFromAuth(payload = {}) {
  const { authUserId, email, name, role, image } = payload;

  const betterAuthUser = await findBetterAuthUser(authUserId);

  const resolvedEmail = email || betterAuthUser?.email;
  const resolvedName = name || betterAuthUser?.name;
  const resolvedRole = role || betterAuthUser?.role || "user";
  const resolvedImage = image ?? betterAuthUser?.image ?? null;
  const resolvedAuthUserId =
    authUserId || (betterAuthUser ? String(betterAuthUser._id) : null);

  if (!resolvedEmail) {
    throw new AppError("Email is required to issue a token", 400);
  }

  if (!resolvedName) {
    throw new AppError("Name is required to issue a token", 400);
  }

  const users = getCollection(COLLECTIONS.USERS);
  const now = new Date();

  await users.updateOne(
    { email: resolvedEmail.toLowerCase() },
    {
      $set: {
        name: resolvedName,
        email: resolvedEmail.toLowerCase(),
        image: resolvedImage,
        role: resolvedRole,
        ...(resolvedAuthUserId ? { authUserId: resolvedAuthUserId } : {}),
        updatedAt: now,
      },
      $setOnInsert: {
        status: "active",
        isBlocked: false,
        trainerApplicationStatus: null,
        trainerFeedback: null,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const user = await users.findOne({ email: resolvedEmail.toLowerCase() });

  if (!user) {
    throw new AppError("Failed to sync user account", 500);
  }

  if (user.status === "blocked" || user.isBlocked === true) {
    throw new AppError("Your account has been blocked", 403);
  }

  return user;
}

/**
 * Issue JWT for a synced user.
 */
function createAuthToken(user) {
  const token = signToken({
    userId: String(user._id),
    email: user.email,
    role: user.role || "user",
    name: user.name,
  });

  return {
    token,
    user: serializeUser(user),
  };
}

/**
 * Login/token flow after Better Auth sign-in on the frontend.
 */
async function loginWithSessionPayload(payload) {
  const user = await syncUserFromAuth(payload);
  return createAuthToken(user);
}

/**
 * Get user by id from VIGOR users collection.
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

  if (user.status === "blocked" || user.isBlocked === true) {
    throw new AppError("Your account has been blocked", 403);
  }

  return serializeUser(user);
}

module.exports = {
  serializeUser,
  syncUserFromAuth,
  createAuthToken,
  loginWithSessionPayload,
  getUserById,
};
