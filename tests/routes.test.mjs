import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

test("GET / responds with 200 and renders HTML", async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("FoodRescue") || text.includes("Food"), "Homepage should contain brand");
});

test("GET /login responds with 200 and renders login form", async () => {
  const res = await fetch(`${BASE_URL}/login`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("Masuk ke Akun Anda") || text.includes("password"), "Login page should render");
});

test("GET /register responds with 200 and renders registration form with role options", async () => {
  const res = await fetch(`${BASE_URL}/register`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("Daftar Akun Baru") || text.includes("buyer"), "Register page should render");
});

test("GET /unauthorized responds with 200 and renders access denied notice", async () => {
  const res = await fetch(`${BASE_URL}/unauthorized`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("Akses Ditolak") || text.includes("403"), "Unauthorized page should render");
});

test("Protected routes redirect unauthenticated users to login", async () => {
  // Test /buyer
  const buyerRes = await fetch(`${BASE_URL}/buyer`, { redirect: "manual" });
  assert.ok(
    [302, 303, 307, 308].includes(buyerRes.status),
    `Expected redirect for /buyer, got ${buyerRes.status}`
  );
  const buyerLocation = buyerRes.headers.get("location");
  assert.ok(buyerLocation && buyerLocation.includes("login"), "Should redirect to login");

  // Test /seller
  const sellerRes = await fetch(`${BASE_URL}/seller`, { redirect: "manual" });
  assert.ok(
    [302, 303, 307, 308].includes(sellerRes.status),
    `Expected redirect for /seller, got ${sellerRes.status}`
  );
  const sellerLocation = sellerRes.headers.get("location");
  assert.ok(sellerLocation && sellerLocation.includes("login"), "Should redirect to login");

  // Test /courier
  const courierRes = await fetch(`${BASE_URL}/courier`, { redirect: "manual" });
  assert.ok(
    [302, 303, 307, 308].includes(courierRes.status),
    `Expected redirect for /courier, got ${courierRes.status}`
  );
  const courierLocation = courierRes.headers.get("location");
  assert.ok(courierLocation && courierLocation.includes("login"), "Should redirect to login");
});

