import test from "node:test";
import assert from "node:assert/strict";
import { calculateDistance, formatDistance, isValidCoordinate } from "../lib/utils/distance.ts";

test("isValidCoordinate validates latitudes and longitudes", () => {
  assert.equal(isValidCoordinate(0, 0), true);
  assert.equal(isValidCoordinate(-6.2, 106.8), true);
  assert.equal(isValidCoordinate(90, 180), true);
  assert.equal(isValidCoordinate(-90, -180), true);
  assert.equal(isValidCoordinate(91, 100), false);
  assert.equal(isValidCoordinate(-91, 100), false);
  assert.equal(isValidCoordinate(0, 181), false);
  assert.equal(isValidCoordinate(0, -181), false);
  assert.equal(isValidCoordinate(null, 100), false);
  assert.equal(isValidCoordinate(undefined, 100), false);
  assert.equal(isValidCoordinate("abc", 100), false);
});

test("calculateDistance computes accurate Haversine distance", () => {
  // Monas Jakarta (-6.1754, 106.8272) to Bundaran HI (-6.1950, 106.8230)
  // Distance is approximately 2.2 km
  const dist = calculateDistance(-6.1754, 106.8272, -6.1950, 106.8230);
  assert.ok(dist !== null);
  assert.ok(dist > 2.0 && dist < 2.5, `Expected ~2.2 km, got ${dist}`);

  // Identical point should be 0 km
  const zeroDist = calculateDistance(-6.1754, 106.8272, -6.1754, 106.8272);
  assert.equal(zeroDist, 0);

  // Invalid coordinates should return null
  assert.equal(calculateDistance(null, 106.8, -6.19, 106.8), null);
  assert.equal(calculateDistance(-6.17, null, -6.19, 106.8), null);
});

test("formatDistance formats meters and kilometers cleanly", () => {
  assert.equal(formatDistance(null), "Jarak tidak diketahui");
  assert.equal(formatDistance(undefined), "Jarak tidak diketahui");
  assert.equal(formatDistance(0.35), "350 m");
  assert.equal(formatDistance(0.05), "50 m");
  assert.equal(formatDistance(1.234), "1.2 km");
  assert.equal(formatDistance(15.78), "15.8 km");
});

