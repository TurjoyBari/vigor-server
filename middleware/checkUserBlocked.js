const { COLLECTIONS, getCollection } = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { toObjectId } = require("../utils/objectId");

/**
 * Soft-block guard for state-changing routes (POST / PATCH / DELETE).
 * Must be used after verifyToken.
 *
 * Blocked users may still log in and browse (GET).
 * Restricted actions return 403: "Action restricted by Admin".
 */
const checkUserBlocked = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const users = getCollection(COLLECTIONS.USERS);

  const user = req.user.userId
    ? await users.findOne(
        { _id: toObjectId(req.user.userId, "userId") },
        { projection: { status: 1, isBlocked: 1, email: 1 } }
      )
    : await users.findOne(
        { email: String(req.user.email).trim().toLowerCase() },
        { projection: { status: 1, isBlocked: 1, email: 1 } }
      );

  if (!user) {
    throw new AppError("User not found", 401);
  }

  console.log("User status:", user.status);

  if (user.status === "blocked" || user.isBlocked === true) {
    throw new AppError("Action restricted by Admin", 403);
  }

  next();
});

module.exports = {
  checkUserBlocked,
};
