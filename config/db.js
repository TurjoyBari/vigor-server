const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "vigor";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in environment variables");
}

/** Shared collection names used across services */
const COLLECTIONS = {
  USERS: "users",
  CLASSES: "classes",
  BOOKINGS: "bookings",
  FAVORITES: "favorites",
  TRAINER_APPLICATIONS: "trainerApplications",
  FORUM_POSTS: "forumPosts",
  COMMENTS: "comments",
  TRANSACTIONS: "transactions",
  PAYMENTS: "payments",
};

let client = null;
let db = null;
let indexesEnsured = false;

const mongoOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 20000,
};

/**
 * Connect to MongoDB and keep the client open for the app lifetime.
 */
async function connectDB() {
  if (db) {
    return db;
  }

  client = new MongoClient(MONGODB_URI, mongoOptions);

  const connectPromise = client.connect();
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("MongoDB connection timed out")), 12000);
  });

  await Promise.race([connectPromise, timeoutPromise]);

  db = client.db(DB_NAME);

  await db.command({ ping: 1 });

  await ensureIndexes(db);

  return db;
}

/**
 * Create indexes for performance and duplicate prevention.
 */
async function ensureIndexes(database) {
  if (indexesEnsured) {
    return;
  }

  await database.collection(COLLECTIONS.USERS).createIndex({ email: 1 }, { unique: true });
  await database.collection(COLLECTIONS.USERS).createIndex({ createdAt: -1 });
  await database.collection(COLLECTIONS.USERS).createIndex({ authUserId: 1 });
  await database.collection(COLLECTIONS.BOOKINGS).createIndex(
    { userId: 1, classId: 1 },
    { unique: true }
  );
  await database.collection(COLLECTIONS.FAVORITES).createIndex(
    { userId: 1, classId: 1 },
    { unique: true }
  );
  await database.collection(COLLECTIONS.CLASSES).createIndex({ trainerId: 1 });
  await database.collection(COLLECTIONS.CLASSES).createIndex({ status: 1 });
  await database.collection(COLLECTIONS.TRAINER_APPLICATIONS).createIndex({ userId: 1 });
  await database.collection(COLLECTIONS.FORUM_POSTS).createIndex({ createdAt: -1 });
  await database.collection(COLLECTIONS.COMMENTS).createIndex({ postId: 1 });
  indexesEnsured = true;
}

/**
 * Get the active database instance.
 */
function getDb() {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
}

/**
 * Get a typed collection reference.
 */
function getCollection(name) {
  return getDb().collection(name);
}

/**
 * Check whether MongoDB is connected (for health checks).
 */
function isDbConnected() {
  return Boolean(db && client);
}

/**
 * Close the MongoDB connection gracefully.
 */
async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    // console.log("MongoDB connection closed.");
  }
}

module.exports = {
  COLLECTIONS,
  connectDB,
  closeDB,
  getDb,
  getCollection,
  isDbConnected,
};
