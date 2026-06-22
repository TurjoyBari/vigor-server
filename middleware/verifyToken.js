const { COLLECTIONS, getCollection } = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { extractToken, verifyTokenString } = require("../utils/jwt");
const { toObjectId } = require("../utils/objectId");

/**
 * Verify JWT from HTTPOnly cookie or Authorization header.
 * Attaches decoded user to req.user.
 */
const verifyToken = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new AppError("Authentication required", 401);
  }

  let decoded;
  try {
    decoded = verifyTokenString(token);
  } catch (error) {
    throw new AppError("Invalid or expired token", 401);
  }

  const users = getCollection(COLLECTIONS.USERS);
  const user = await users.findOne(
    { _id: toObjectId(decoded.userId, "userId") },
    {
      projection: {
        password: 0,
      },
    }
  );

  if (!user) {
    throw new AppError("User not found", 401);
  }

  if (user.status === "blocked" || user.isBlocked === true) {
    throw new AppError("Your account has been blocked", 403);
  }

  req.user = {
    id: String(user._id),
    userId: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image || null,
    role: user.role || "user",
    status: user.status || "active",
  };

  req.token = token;

  next();
});

/**
 * Optional auth — attaches user if token exists, continues if not.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyTokenString(token);
    const users = getCollection(COLLECTIONS.USERS);
    const user = await users.findOne({
      _id: toObjectId(decoded.userId, "userId"),
    });

    if (user && user.status !== "blocked" && user.isBlocked !== true) {
      req.user = {
        id: String(user._id),
        userId: String(user._id),
        name: user.name,
        email: user.email,
        image: user.image || null,
        role: user.role || "user",
        status: user.status || "active",
      };
      req.token = token;
    }
  } catch {
    // Ignore invalid token for optional routes
  }

  next();
});

module.exports = {
  verifyToken,
  optionalAuth,
};
