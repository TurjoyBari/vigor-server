const AppError = require("../utils/AppError");

const ROLES = {
  USER: "user",
  TRAINER: "trainer",
  ADMIN: "admin",
};

/**
 * Restrict route access to specific roles.
 * Must be used after verifyToken.
 *
 * @example
 * router.get("/admin/users", verifyToken, requireRole("admin"), getUsers);
 * router.post("/classes", verifyToken, requireRole("trainer", "admin"), addClass);
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to access this resource", 403)
      );
    }

    next();
  };
}

module.exports = {
  ROLES,
  requireRole,
};
