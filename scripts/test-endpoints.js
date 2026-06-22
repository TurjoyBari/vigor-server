/**
 * VIGOR API — integration smoke tests (Step 12)
 * Run: node scripts/test-endpoints.js
 */
require("dotenv").config();

const BASE = process.env.API_TEST_URL || "http://localhost:5000/api";

const results = [];
let passed = 0;
let failed = 0;

const tokens = {
  admin: null,
  trainer: null,
  user: null,
};

const state = {
  classId: null,
  postId: null,
  commentId: null,
  favoriteId: null,
  applicationId: null,
};

function authHeader(role) {
  const token = tokens[role];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, { role, body, expectStatus } = {}) {
  const url = `${BASE}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(role),
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const ok = expectStatus ? res.status === expectStatus : res.ok;

  results.push({
    method,
    path,
    status: res.status,
    ok,
    message: data?.message || res.statusText,
  });

  if (ok) passed += 1;
  else failed += 1;

  if (!ok) {
    console.error(`  FAIL ${method} ${path} → ${res.status}`, data?.message || "");
  } else {
    console.log(`  PASS ${method} ${path} → ${res.status}`);
  }

  return { res, data, ok };
}

async function issueToken(key, email, name, role = key) {
  const { data, ok } = await request("POST", "/auth/token", {
    body: {
      userId: `507f1f77bcf86cd7994390${key === "admin" ? "11" : key === "trainer" ? "22" : key === "user" ? "33" : "44"}`,
      email,
      name,
      role,
    },
    expectStatus: 200,
  });

  if (ok && data?.data?.token) {
    tokens[key] = data.data.token;
  }
}

async function runTests() {
  console.log("\n=== VIGOR API Test Suite ===\n");
  console.log(`Base URL: ${BASE}\n`);

  // 1. Health
  console.log("--- Health ---");
  await fetch("http://localhost:5000/api/health").then(async (res) => {
    const data = await res.json();
    const ok = res.ok && data.success;
    results.push({ method: "GET", path: "/api/health", status: res.status, ok });
    ok ? (passed += 1) : (failed += 1);
    console.log(ok ? "  PASS GET /api/health" : "  FAIL GET /api/health");
  });

  // 2. Auth tokens
  console.log("\n--- Auth ---");
  await issueToken("admin", "vigor-admin@test.com", "Vigor Admin");
  await issueToken("trainer", "vigor-trainer@test.com", "Vigor Trainer");
  await issueToken("user", "vigor-user@test.com", "Vigor User");
  await issueToken(
    "applicant",
    `vigor-applicant-${Date.now()}@test.com`,
    "Vigor Applicant",
    "user"
  );
  await request("GET", "/auth/me", { role: "user", expectStatus: 200 });

  // 3. Users (admin)
  console.log("\n--- Users ---");
  await request("GET", "/users", { role: "admin", expectStatus: 200 });
  await request("POST", "/users", {
    role: "admin",
    body: {
      name: "Extra User",
      email: `extra-${Date.now()}@test.com`,
      role: "user",
    },
    expectStatus: 201,
  });

  // 4. Classes
  console.log("\n--- Classes ---");
  const createClass = await request("POST", "/trainer/classes", {
    role: "trainer",
    body: {
      className: "API Test HIIT",
      category: "HIIT",
      difficulty: "Intermediate",
      duration: "45 min",
      schedule: "Mon, Wed · 7:00 AM",
      price: 29.99,
      description: "Automated test class for VIGOR API validation.",
    },
    expectStatus: 201,
  });
  state.classId = createClass.data?.data?.class?.id;

  await request("GET", "/classes", { expectStatus: 200 });
  await request("GET", "/classes/approved", { expectStatus: 200 });

  if (state.classId) {
    await request("GET", `/classes/${state.classId}`, { expectStatus: 200 });
    await request("PATCH", `/admin/classes/${state.classId}/approve`, {
      role: "admin",
      expectStatus: 200,
    });
    await request("GET", "/classes/approved", { expectStatus: 200 });
  }

  // 5. Bookings
  console.log("\n--- Bookings ---");
  if (state.classId) {
    await request("POST", "/bookings", {
      role: "user",
      body: { classId: state.classId },
      expectStatus: 201,
    });
    await request("POST", "/bookings", {
      role: "user",
      body: { classId: state.classId },
      expectStatus: 409,
    });
    await request("GET", "/user/booked-classes", { role: "user", expectStatus: 200 });
    await request("GET", "/bookings/my", { role: "user", expectStatus: 200 });
  }

  // 6. Favorites
  console.log("\n--- Favorites ---");
  if (state.classId) {
    const fav = await request("POST", "/user/favorites", {
      role: "user",
      body: { classId: state.classId },
      expectStatus: 201,
    });
    state.favoriteId = fav.data?.data?.favorite?.id;
    await request("POST", "/user/favorites", {
      role: "user",
      body: { classId: state.classId },
      expectStatus: 409,
    });
    await request("GET", "/user/favorites", { role: "user", expectStatus: 200 });
    if (state.favoriteId) {
      await request("DELETE", `/user/favorites/${state.favoriteId}`, {
        role: "user",
        expectStatus: 200,
      });
    }
  }

  // 7. Trainer application
  console.log("\n--- Trainer Applications ---");
  const app = await request("POST", "/user/apply-trainer", {
    role: "applicant",
    body: {
      experience: "3 years coaching HIIT",
      specialty: "HIIT",
    },
    expectStatus: 201,
  });
  state.applicationId = app.data?.data?.application?.id;
  await request("GET", "/admin/trainer-applications", { role: "admin", expectStatus: 200 });
  if (state.applicationId) {
    await request("PATCH", `/admin/trainer-applications/${state.applicationId}`, {
      role: "admin",
      body: { status: "approved", feedback: "Welcome to the team!" },
      expectStatus: 200,
    });
  }

  // 8. Forum
  console.log("\n--- Forum ---");
  const post = await request("POST", "/forum/posts", {
    role: "trainer",
    body: {
      title: "API Test Post",
      description: "Testing forum endpoints from automated suite.",
    },
    expectStatus: 201,
  });
  state.postId = post.data?.data?.post?.id;

  await request("GET", "/forum/posts", { expectStatus: 200 });
  if (state.postId) {
    await request("GET", `/forum/posts/${state.postId}`, { expectStatus: 200 });
    await request("POST", `/forum/posts/${state.postId}/like`, {
      role: "user",
      expectStatus: 200,
    });
    const comment = await request("POST", `/forum/posts/${state.postId}/comments`, {
      role: "user",
      body: { content: "Great post!" },
      expectStatus: 201,
    });
    state.commentId = comment.data?.data?.comment?.id;
    if (state.commentId) {
      await request("POST", `/forum/comments/${state.commentId}/reply`, {
        role: "trainer",
        body: { content: "Thanks for reading!" },
        expectStatus: 201,
      });
      await request("PATCH", `/forum/comments/${state.commentId}`, {
        role: "user",
        body: { content: "Great post! Updated." },
        expectStatus: 200,
      });
    }
    await request("GET", "/trainer/forum-posts", { role: "trainer", expectStatus: 200 });
    await request("GET", "/admin/forum-posts", { role: "admin", expectStatus: 200 });
  }

  // 9. Dashboard stats
  console.log("\n--- Dashboard ---");
  await request("GET", "/admin/overview", { role: "admin", expectStatus: 200 });
  await request("GET", "/admin/transactions", { role: "admin", expectStatus: 200 });
  await request("GET", "/trainer/overview", { role: "trainer", expectStatus: 200 });
  await request("GET", "/user/overview", { role: "user", expectStatus: 200 });

  // 10. Admin trainers
  console.log("\n--- Admin Trainers ---");
  await request("GET", "/admin/trainers", { role: "admin", expectStatus: 200 });
  await request("GET", "/admin/classes", { role: "admin", expectStatus: 200 });

  // 11. Logout
  console.log("\n--- Logout ---");
  await request("POST", "/auth/logout", { expectStatus: 200 });

  // 12. 404
  console.log("\n--- Error handling ---");
  await request("GET", "/does-not-exist", { expectStatus: 404 });

  console.log("\n=== Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("\nTest suite crashed:", error.message);
  process.exit(1);
});
