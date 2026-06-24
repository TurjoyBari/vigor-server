/**
 * Verify approved users can access trainer dashboard API after token sync.
 * Run: node scripts/test-trainer-access.js
 */
require("dotenv").config();

const { connectDB, closeDB, getCollection, COLLECTIONS } = require("../config/db");
const authService = require("../services/auth.service");

async function run() {
  await connectDB();

  const users = getCollection(COLLECTIONS.USERS);
  const user = await users.findOne({ email: "tuser@gmail.com" });

  if (!user) {
    console.error("Test user tuser@gmail.com not found");
    process.exit(1);
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { role: "user", updatedAt: new Date() } }
  );
  console.log("Simulated stale DB role: user");

  const { user: syncedUser, token } = await authService.loginWithSessionPayload({
    userId: user.authUserId || String(user._id),
    email: user.email,
    name: user.name,
    role: "user",
  });

  console.log("After token sync role:", syncedUser.role);
  console.log("Trainer application status:", syncedUser.trainerApplicationStatus);

  const BASE = process.env.API_TEST_URL || "http://localhost:5000/api";
  const res = await fetch(`${BASE}/trainer/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  console.log("GET /trainer/overview status:", res.status);
  console.log("Message:", body.message);

  if (!res.ok || syncedUser.role !== "trainer") {
    process.exit(1);
  }

  console.log("\nPASS: Approved user can access trainer dashboard API.\n");
}

run()
  .catch((error) => {
    console.error("FAIL:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeDB();
  });
