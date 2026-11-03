import assert from "node:assert/strict";
import { test } from "node:test";
import { getBusinessDate } from "../lib/date.ts";

test("closing stays on the previous business day until 4 AM Eastern", () => {
  for (const [instant, expected] of [
    ["2026-11-03T23:00:00Z", "2026-11-03"],
    ["2026-11-04T00:00:00Z", "2026-11-03"],
    ["2026-11-04T05:00:00Z", "2026-11-03"],
    ["2026-11-04T08:59:59Z", "2026-11-03"],
    ["2026-11-04T09:00:00Z", "2026-11-04"],
    ["2026-07-29T07:59:59Z", "2026-07-28"],
    ["2026-07-29T08:00:00Z", "2026-07-29"],
  ]) assert.equal(getBusinessDate(new Date(instant)), expected, instant);
});

test("4 AM cutoff handles both daylight saving transitions", () => {
  for (const [instant, expected] of [
    ["2026-03-08T06:59:59Z", "2026-03-07"],
    ["2026-03-08T07:00:00Z", "2026-03-07"],
    ["2026-03-08T07:59:59Z", "2026-03-07"],
    ["2026-03-08T08:00:00Z", "2026-03-08"],
    ["2026-11-01T05:30:00Z", "2026-10-31"],
    ["2026-11-01T06:30:00Z", "2026-10-31"],
    ["2026-11-01T08:59:59Z", "2026-10-31"],
    ["2026-11-01T09:00:00Z", "2026-11-01"],
  ]) assert.equal(getBusinessDate(new Date(instant)), expected, instant);
});

test("business date handles year, month, and leap-year boundaries", () => {
  assert.equal(getBusinessDate(new Date("2027-01-01T08:59:59Z")), "2026-12-31");
  assert.equal(getBusinessDate(new Date("2027-01-01T09:00:00Z")), "2027-01-01");
  assert.equal(getBusinessDate(new Date("2028-03-01T08:59:59Z")), "2028-02-29");
});

test("device timezone does not change the business date", () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      process.env.TZ = timezone;
      assert.equal(getBusinessDate(new Date("2026-11-04T08:59:59Z")), "2026-11-03", timezone);
      assert.equal(getBusinessDate(new Date("2026-11-04T09:00:00Z")), "2026-11-04", timezone);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
