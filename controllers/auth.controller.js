const authService = require("../services/auth.service");
const { sendSuccess } = require("../utils/apiResponse");
const { setTokenCookie, clearTokenCookie } = require("../utils/jwt");
const AppError = require("../utils/AppError");

/**
 * POST /api/auth/token
 * Issue JWT after Better Auth login (frontend sends session user data).
 */
async function createToken(req, res) {
  const { userId, email, name, role, image } = req.body;

  if (!userId && !email) {
    throw new AppError("userId or email is required", 400);
  }

  const { token, user } = await authService.loginWithSessionPayload({
    authUserId: userId,
    email,
    name,
    role,
    image,
  });

  setTokenCookie(res, token);

  return sendSuccess(
    res,
    { user, token },
    "Authentication token issued successfully"
  );
}

/**
 * POST /api/auth/logout
 * Clear JWT HTTPOnly cookie.
 */
async function logout(req, res) {
  clearTokenCookie(res);
  return sendSuccess(res, null, "Logged out successfully");
}

/**
 * GET /api/auth/me
 * Return current authenticated user.
 */
async function getMe(req, res) {
  const user = await authService.getUserById(req.user.userId);
  return sendSuccess(res, { user }, "Current user fetched successfully");
}

module.exports = {
  createToken,
  logout,
  getMe,
};
