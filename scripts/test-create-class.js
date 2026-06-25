/**
 * Verify trainer class creation against MongoDB.
 * Run: node scripts/test-create-class.js
 */
require("dotenv").config();

const { connectDB, closeDB, getCollection, COLLECTIONS } = require("../config/db");
const authService = require("../services/auth.service");
const classService = require("../services/class.service");

async function run() {
  await connectDB();

  const users = getCollection(COLLECTIONS.USERS);
  let trainer = await users.findOne({ role: "trainer" });

  if (!trainer) {
    trainer = await users.findOne({ email: "vigor-trainer@test.com" });
  }

  if (!trainer) {
    console.error("No trainer user found in database.");
    process.exit(1);
  }

  const trainerId = String(trainer._id);
  // console.log("\n=== Create Class DB Test ===\n");
  // console.log("Trainer:", trainer.name, `<${trainer.email}>`, "role:", trainer.role);

  const payload = {
    className: `Test Class ${Date.now()}`,
    image: "/images/hero-strongest.png",
    category: "HIIT",
    difficulty: "Intermediate",
    duration: "45 min",
    schedule: "Mon, Wed · 7:00 AM",
    price: 29.99,
    description: "Automated test class saved to MongoDB classes collection.",
  };

  const created = await classService.createClass(trainerId, payload);
  // console.log("\n--- serializeClass() ---");
  // console.log(created);

  const classes = getCollection(COLLECTIONS.CLASSES);
  const fromDb = await classes.findOne({ _id: require("../utils/objectId").toObjectId(created.id) });

  // console.log("\n--- MongoDB document ---");
  // console.log({
  //   trainerId: String(fromDb.trainerId),
  //   trainerName: fromDb.trainerName,
  //   className: fromDb.className,
  //   status: fromDb.status,
  //   bookingCount: fromDb.bookingCount,
  //   price: fromDb.price,
  // });

  const { token } = await authService.createAuthToken(trainer);
  const BASE = process.env.API_TEST_URL || "http://localhost:5000/api";
  const res = await fetch(`${BASE}/trainer/classes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      className: `API Class ${Date.now()}`,
    }),
  });
  const body = await res.json();

  // console.log("\n--- POST /api/trainer/classes ---");
  // console.log("Status:", res.status);
  // console.log("Message:", body.message);
  // console.log("Class id:", body.data?.class?.id);

  await classes.deleteMany({
    className: { $regex: /^(Test Class|API Class) / },
  });

  if (!res.ok) {
    process.exit(1);
  }

  // console.log("\nPASS: Class creation works end-to-end.\n");
}

run()
  .catch((error) => {
    console.error("FAIL:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeDB();
  });
