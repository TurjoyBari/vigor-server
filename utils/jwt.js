const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const TOKEN_COOKIE_NAME = "vigor_token";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

/**
 * Sign a JWT for an authenticated user.
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify a JWT string and return decoded payload.
 */
function verifyTokenString(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Set JWT as HTTPOnly cookie.
 */
function setTokenCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

/**
 * Clear auth cookie on logout.
 */
function clearTokenCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

/**
 * Extract token from cookie or Authorization header.
 */
function extractToken(req) {
  if (req.cookies?.[TOKEN_COOKIE_NAME]) {
    return req.cookies[TOKEN_COOKIE_NAME];
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

module.exports = {
  TOKEN_COOKIE_NAME,
  signToken,
  verifyTokenString,
  setTokenCookie,
  clearTokenCookie,
  extractToken,
};
