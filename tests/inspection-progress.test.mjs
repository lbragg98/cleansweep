import assert from "node:assert/strict";
import { test } from "node:test";
import { areas, dayparts, floors, getAreaProgress, getCompletedCount, normalizeFloor } from "../lib/inspection-progress.ts";

const date = "2026-11-03";
const inspection = (patch = {}) => ({
  id: crypto.randomUUID(), businessDate: date, floorNumber: "1st", area: "Bar", daypart: "Open",
  manager: "Test manager", startedAt: "2026-11-04T08:30:00Z", responses: {}, actions: {}, status: "synced", ...patch,
});

test("normalizes old floor labels without changing records", () => {
  for (const [expected, aliases] of [
    ["1st", ["1", "1st", "First", "1st Floor", "Floor 1", " first floor "]],
    ["2nd", ["2", "2nd", "Second", "2nd Floor", "Floor 2", " second floor "]],
    ["3rd", ["3", "3rd", "Third", "3rd Floor", "Floor 3", " third floor "]],
  ]) for (const alias of aliases) assert.equal(normalizeFloor(alias), expected, alias);
  for (const unknown of ["", "4", "Basement"]) assert.equal(normalizeFloor(unknown), undefined);
  const rows = [inspection({ floorNumber: "First Floor" })];
  assert.equal(getCompletedCount(rows, date, "1st"), 1);
  assert.equal(rows[0].floorNumber, "First Floor");
});

test("coverage and drafts are independent by date, floor, and area", () => {
  const draft = inspection({ floorNumber: "2nd", area: "Beverage Stations", status: "draft", daypart: "Close" });
  const rows = [inspection(), draft, inspection({ businessDate: "2026-11-02", daypart: "Mid AM" })];
  assert.equal(getAreaProgress(rows, date, "1st", "Bar").nextDaypart.name, "Mid AM");
  assert.equal(getAreaProgress(rows, date, "2nd", "Bar").nextDaypart.name, "Open");
  assert.equal(getAreaProgress(rows, date, "1st", "Beverage Stations").completed.length, 0);
  assert.equal(getAreaProgress(rows, date, "2nd", "Beverage Stations").draft, draft);
  assert.equal(getAreaProgress(rows, date, "1st", "Bar").draft, undefined);
  assert.equal(getAreaProgress(rows, "2026-11-04", "2nd", "Beverage Stations").draft, undefined);
});

test("pending counts as coverage, drafts do not, and retries and duplicates do not inflate counts", () => {
  const rows = [inspection({ status: "pending" }), inspection(), inspection({ status: "draft", daypart: "Close" })];
  const progress = getAreaProgress(rows, date, "1st", "Bar");
  assert.equal(progress.completed.length, 1);
  assert.equal(progress.pendingCount, 1);
  assert.equal(progress.nextDaypart.name, "Mid AM");
  rows[0].status = "synced";
  assert.equal(getCompletedCount(rows, date), 1);
  assert.equal(getAreaProgress(rows, date, "1st", "Bar").pendingCount, 0);
});

test("all 30 slots are reachable and repeated inspections leave the business day unchanged", () => {
  const rows = floors.flatMap(floorNumber => areas.flatMap(area => dayparts.map(part => inspection({ floorNumber, area, daypart: part.name }))));
  assert.equal(getCompletedCount(rows, date), 30);
  for (const floor of floors) {
    assert.equal(getCompletedCount(rows, date, floor), 10);
    for (const area of areas) {
      const progress = getAreaProgress(rows, date, floor, area);
      assert.equal(progress.completed.length, 5);
      assert.equal(progress.nextDaypart, undefined);
    }
  }
  rows.push(inspection(), inspection({ status: "pending" }));
  assert.equal(rows.length, 32);
  assert.equal(getCompletedCount(rows, date), 30);
  assert.equal(getCompletedCount(rows, "2026-11-04"), 0);
  assert.ok(rows.every(row => row.businessDate === date));
});
