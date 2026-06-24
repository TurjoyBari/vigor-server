/**
 * Verify user dashboard overview against MongoDB.
 * Run: node scripts/test-user-dashboard.js
 */
require("dotenv").config();

const { connectDB, closeDB } = require("../config/db");
const dashboardService = require("../services/dashboard.service");
const authService = require("../services/auth.service");

async function run() {
  await connectDB();

  const { getCollection, COLLECTIONS } = require("../config/db");
  const users = getCollection(COLLECTIONS.USERS);

  const testEmail = process.env.TEST_USER_EMAIL || "vigor-user@test.com";
  let user = await users.findOne({ email: testEmail.toLowerCase() });

  if (!user) {
    user = await users.findOne({ role: "user" });
  }

  if (!user) {
    console.error("No user found in database. Run test-endpoints.js first or sign up.");
    process.exit(1);
  }

  const userId = String(user._id);
  console.log("\n=== User Dashboard DB Test ===\n");
  console.log("User:", user.name, `<${user.email}>`);
  console.log("User ID:", userId);
  console.log("Role:", user.role);
  console.log("Trainer application status:", user.trainerApplicationStatus ?? "none");

  const overview = await dashboardService.getUserOverview(userId);

  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);

  const rawBookings = await bookings.countDocuments({
    $or: [{ userId: user._id }, { userId: userId }],
  });
  const rawFavorites = await favorites.countDocuments({
    $or: [{ userId: user._id }, { userId: userId }],
  });
  const rawApplications = await applications
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  console.log("\n--- MongoDB counts ---");
  console.log("Bookings:", rawBookings);
  console.log("Favorites:", rawFavorites);
  console.log("Applications:", rawApplications.length);

  console.log("\n--- getUserOverview() ---");
  console.log("Stats:", overview.stats);
  console.log("Trainer application:", overview.trainerApplication);

  const { token, user: syncedUser } = await authService.createAuthToken(user);
  console.log("\n--- Auth token ---");
  console.log("JWT issued for role:", syncedUser.role);
  console.log("Token length:", token.length);

  const BASE = process.env.API_TEST_URL || "http://localhost:5000/api";
  const res = await fetch(`${BASE}/user/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  console.log("\n--- GET /api/user/overview ---");
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(body, null, 2));

  if (!res.ok) {
    process.exit(1);
  }

  console.log("\nPASS: User dashboard data loads from database.\n");
}

run()
  .catch((error) => {
    console.error("\nFAIL:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeDB();
  });
