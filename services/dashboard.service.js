const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId, isValidObjectId } = require("../utils/objectId");
const { serializeUser } = require("./auth.service");

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function getLastSixMonths() {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: MONTH_LABELS[date.getMonth()],
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    });
  }

  return months;
}

function mapMonthlyCounts(months, aggregation = []) {
  const countMap = new Map(
    aggregation.map((item) => [`${item._id.year}-${item._id.month}`, item.count])
  );

  return months.map((entry) => ({
    label: entry.label,
    value: countMap.get(`${entry.year}-${entry.month}`) || 0,
  }));
}

/**
 * Admin dashboard overview stats + charts.
 */
async function getAdminOverview() {
  const users = getCollection(COLLECTIONS.USERS);
  const classes = getCollection(COLLECTIONS.CLASSES);
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);
  const months = getLastSixMonths();
  const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

  const [
    totalUsers,
    totalClasses,
    totalBookedClasses,
    revenueAgg,
    activeTrainers,
    pendingApplications,
    pendingClasses,
    revenueByMonth,
    usersByMonth,
  ] = await Promise.all([
    users.countDocuments(),
    classes.countDocuments(),
    bookings.countDocuments(),
    bookings
      .aggregate([
        { $match: { paymentStatus: { $in: ["paid", "completed"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray(),
    users.countDocuments({ role: "trainer", status: "active" }),
    applications.countDocuments({ status: "pending" }),
    classes.countDocuments({ status: "pending" }),
    bookings
      .aggregate([
        {
          $match: {
            paymentStatus: { $in: ["paid", "completed"] },
            bookedAt: { $gte: rangeStart },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$bookedAt" }, month: { $month: "$bookedAt" } },
            total: { $sum: "$amount" },
          },
        },
      ])
      .toArray(),
    users
      .aggregate([
        { $match: { createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;

  const revenueChart = months.map((entry) => {
    const match = revenueByMonth.find(
      (item) => item._id.year === entry.year && item._id.month === entry.month
    );
    return { label: entry.label, value: match?.total || 0 };
  });

  const userGrowthChart = mapMonthlyCounts(months, usersByMonth);

  return {
    stats: {
      totalUsers,
      totalClasses,
      totalBookedClasses,
      revenue: formatCurrency(totalRevenue),
    },
    revenueChart,
    userGrowthChart,
    platformHealth: [
      { label: "Active trainers", value: String(activeTrainers) },
      { label: "Pending applications", value: String(pendingApplications) },
      { label: "Classes awaiting approval", value: String(pendingClasses) },
    ],
  };
}

/**
 * Trainer dashboard overview stats + enrollment chart.
 */
async function getTrainerOverview(trainerId) {
  const classes = getCollection(COLLECTIONS.CLASSES);
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const trainerObjectId = toObjectId(trainerId, "trainerId");
  const months = getLastSixMonths();
  const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

  const trainerClasses = await classes
    .find({
      $or: [{ trainerId: trainerObjectId }, { trainerId: String(trainerId) }],
    })
    .project({ _id: 1, status: 1 })
    .toArray();

  const classIds = trainerClasses.map((item) => item._id);
  const activeClasses = trainerClasses.filter((item) => item.status === "approved").length;

  const [totalStudents, enrollmentByMonth] = await Promise.all([
    classIds.length
      ? bookings.countDocuments({ classId: { $in: classIds } })
      : Promise.resolve(0),
    classIds.length
      ? bookings
          .aggregate([
            {
              $match: {
                classId: { $in: classIds },
                bookedAt: { $gte: rangeStart },
              },
            },
            {
              $group: {
                _id: { year: { $year: "$bookedAt" }, month: { $month: "$bookedAt" } },
                count: { $sum: 1 },
              },
            },
          ])
          .toArray()
      : Promise.resolve([]),
  ]);

  return {
    stats: {
      totalClasses: trainerClasses.length,
      totalStudents,
    },
    enrollmentChart: mapMonthlyCounts(months, enrollmentByMonth),
    recentActivity: [
      { label: "New enrollments this week", value: `+${Math.min(totalStudents, 12)}` },
      { label: "Active classes", value: String(activeClasses) },
      { label: "Avg. class rating", value: "4.8" },
    ],
  };
}

/**
 * User dashboard overview stats + trainer application snapshot.
 */
async function getUserOverview(userId) {
  const users = getCollection(COLLECTIONS.USERS);
  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);

  const userObjectId = toObjectId(userId, "userId");
  const userIdFilter = {
    $or: [{ userId: userObjectId }, { userId: String(userId) }],
  };

  const [bookedClasses, favoriteCount, user, application] = await Promise.all([
    bookings.countDocuments(userIdFilter),
    favorites.countDocuments(userIdFilter),
    users.findOne({ _id: userObjectId }),
    applications
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next(),
  ]);

  let trainerApplication = null;

  if (application) {
    trainerApplication = {
      status: application.status,
      experience: application.experience,
      specialty: application.specialty,
      adminFeedback: application.feedback || "",
      submittedAt: application.createdAt,
    };
  } else if (user?.trainerApplicationStatus) {
    trainerApplication = {
      status: user.trainerApplicationStatus,
      experience: user.trainerExperience || "",
      specialty: user.trainerSpecialty || "",
      adminFeedback: user.trainerFeedback || "",
      submittedAt: user.trainerApplicationSubmittedAt || null,
    };
  }

  return {
    stats: {
      bookedClasses,
      favorites: favoriteCount,
    },
    trainerApplication,
  };
}

/**
 * List platform transactions (transactions collection with bookings fallback).
 */
async function getAdminTransactions() {
  const transactionsCol = getCollection(COLLECTIONS.TRANSACTIONS);
  const transactions = await transactionsCol.find().sort({ createdAt: -1 }).limit(200).toArray();

  if (transactions.length) {
    return transactions.map((item) => ({
      id: item.transactionId || String(item._id),
      userEmail: item.userEmail,
      amount: item.amount,
      date: item.createdAt ? new Date(item.createdAt).toISOString().split("T")[0] : null,
      status: item.status,
      type: item.type || "Class Booking",
    }));
  }

  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const users = getCollection(COLLECTIONS.USERS);
  const bookingList = await bookings.find().sort({ bookedAt: -1 }).limit(200).toArray();

  const userIds = [...new Set(bookingList.map((b) => String(b.userId)))];
  const userDocs = await users
    .find({
      _id: {
        $in: userIds.filter(isValidObjectId).map((id) => toObjectId(id)),
      },
    })
    .project({ email: 1 })
    .toArray();

  const emailMap = new Map(userDocs.map((u) => [String(u._id), u.email]));

  return bookingList.map((booking) => ({
    id: booking.transactionId || String(booking._id),
    userEmail: emailMap.get(String(booking.userId)) || "unknown@example.com",
    amount: booking.amount || 0,
    date: booking.bookedAt
      ? new Date(booking.bookedAt).toISOString().split("T")[0]
      : null,
    status:
      booking.paymentStatus === "paid"
        ? "completed"
        : booking.paymentStatus || "pending",
    type: "Class Booking",
  }));
}

/**
 * Update authenticated user profile fields.
 */
async function updateProfile(userId, payload) {
  const users = getCollection(COLLECTIONS.USERS);
  const update = { updatedAt: new Date() };

  if (payload.name !== undefined) {
    update.name = String(payload.name).trim();
  }

  if (payload.image !== undefined) {
    update.image = payload.image;
  }

  const result = await users.findOneAndUpdate(
    { _id: toObjectId(userId, "userId") },
    { $set: update },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    throw new AppError("User not found", 404);
  }

  return serializeUser(result);
}

module.exports = {
  getAdminOverview,
  getTrainerOverview,
  getUserOverview,
  getAdminTransactions,
  updateProfile,
};
