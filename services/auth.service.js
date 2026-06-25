const { getDb, getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/jwt");
const { isValidObjectId, toObjectId } = require("../utils/objectId");

const BETTER_AUTH_USER_COLLECTION = "user";

async function hasApprovedTrainerApplication(userId) {
  if (!userId) return false;

  try {
    const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);
    const userObjectId = toObjectId(String(userId), "userId");
    const doc = await applications.findOne({
      $or: [{ userId: userObjectId }, { userId: String(userId) }],
      status: "approved",
    });
    return Boolean(doc);
  } catch {
    return false;
  }
}

/**
 * Effective dashboard role for UI / route guards (may differ from persisted DB role).
 */
function resolveDashboardRole({
  existingUser,
  sessionRole,
  betterAuthRole,
  hasApprovedApplication = false,
}) {
  const roles = [existingUser?.role, sessionRole, betterAuthRole].filter(Boolean);

  if (roles.includes("admin")) return "admin";

  // MongoDB users.role is source of truth (demoted trainers stay user).
  if (existingUser?.role === "trainer") return "trainer";
  if (existingUser?.role === "user") return "user";

  if (
    roles.includes("trainer") ||
    existingUser?.trainerApplicationStatus === "approved" ||
    hasApprovedApplication
  ) {
    return "trainer";
  }

  return "user";
}

/**
 * Role to persist on token sync — only promote to trainer when an approved application exists.
 * Avoids promoting from stale Better Auth session role before apply-trainer submit.
 */
function persistRoleOnSync({
  existingUser,
  sessionRole,
  betterAuthRole,
  hasApprovedApplication = false,
}) {
  const roles = [existingUser?.role, sessionRole, betterAuthRole].filter(Boolean);

  if (roles.includes("admin")) return "admin";

  // MongoDB users.role is source of truth — do not re-promote demoted trainers.
  if (existingUser?.role === "trainer") return "trainer";
  if (existingUser?.role === "user") return "user";

  if (hasApprovedApplication) return "trainer";

  return existingUser?.role || sessionRole || betterAuthRole || "user";
}

/**
 * Shape user document for API responses (no sensitive fields).
 */
function serializeUser(user) {
  if (!user) return null;

  const isBlocked = user.status === "blocked" || user.isBlocked === true;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image || null,
    role: user.role || "user",
    status: user.status || "active",
    isBlocked,
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

  const existingUser = await users.findOne({ email: resolvedEmail.toLowerCase() });
  const hasApprovedApplication = existingUser
    ? await hasApprovedTrainerApplication(existingUser._id)
    : false;

  const resolvedRole = persistRoleOnSync({
    existingUser,
    sessionRole: role,
    betterAuthRole: betterAuthUser?.role,
    hasApprovedApplication,
  });

  const setFields = {
    name: resolvedName,
    email: resolvedEmail.toLowerCase(),
    image: resolvedImage,
    role: resolvedRole,
    ...(resolvedAuthUserId ? { authUserId: resolvedAuthUserId } : {}),
    updatedAt: now,
  };

  if (hasApprovedApplication) {
    setFields.trainerApplicationStatus = "approved";
  }

  const setOnInsertFields = {
    status: "active",
    isBlocked: false,
    trainerFeedback: null,
    createdAt: now,
  };

  // MongoDB rejects the same path in both $set and $setOnInsert on upsert insert.
  if (!setFields.trainerApplicationStatus) {
    setOnInsertFields.trainerApplicationStatus = null;
  }

  await users.updateOne(
    { email: resolvedEmail.toLowerCase() },
    {
      $set: setFields,
      $setOnInsert: setOnInsertFields,
    },
    { upsert: true }
  );

  const user = await users.findOne({ email: resolvedEmail.toLowerCase() });

  if (!user) {
    throw new AppError("Failed to sync user account", 500);
  }

  // console.log("User status:", user.status);

  return user;
}

/**
 * Issue JWT for a synced user and heal role from approved applications.
 */
async function createAuthToken(user) {
  const users = getCollection(COLLECTIONS.USERS);
  const hasApprovedApplication = await hasApprovedTrainerApplication(user._id);
  const effectiveRole = resolveDashboardRole({
    existingUser: user,
    sessionRole: user.role,
    betterAuthRole: null,
    hasApprovedApplication,
  });

  let currentUser = user;

  if (
    effectiveRole !== user.role ||
    (hasApprovedApplication && user.trainerApplicationStatus !== "approved")
  ) {
    const now = new Date();
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          role: effectiveRole,
          ...(hasApprovedApplication
            ? { trainerApplicationStatus: "approved", updatedAt: now }
            : { updatedAt: now }),
        },
      }
    );
    currentUser = await users.findOne({ _id: user._id });
  }

  const serialized = serializeUser(currentUser);
  serialized.role = effectiveRole;
  if (hasApprovedApplication) {
    serialized.trainerApplicationStatus = "approved";
  }

  const token = signToken({
    userId: String(currentUser._id),
    email: currentUser.email,
    role: effectiveRole,
    name: currentUser.name,
  });

  return {
    token,
    user: serialized,
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
  let user = await users.findOne(
    { _id: toObjectId(userId, "userId") },
    { projection: { password: 0 } }
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const hasApprovedApplication = await hasApprovedTrainerApplication(user._id);
  const resolvedRole = persistRoleOnSync({
    existingUser: user,
    sessionRole: user.role,
    betterAuthRole: null,
    hasApprovedApplication,
  });

  if (resolvedRole !== user.role) {
    const now = new Date();
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          role: resolvedRole,
          ...(hasApprovedApplication
            ? { trainerApplicationStatus: "approved", updatedAt: now }
            : { updatedAt: now }),
        },
      }
    );
    user = await users.findOne({ _id: user._id }, { projection: { password: 0 } });
  }

  // console.log("User status:", user.status);

  return serializeUser(user);
}

module.exports = {
  serializeUser,
  resolveDashboardRole,
  persistRoleOnSync,
  syncUserFromAuth,
  createAuthToken,
  loginWithSessionPayload,
  getUserById,
};
