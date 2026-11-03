import assert from "node:assert/strict";
import { test } from "node:test";
import { getBusinessDate } from "../lib/date.ts";
import { submitInspection } from "../lib/google-sheets-client.ts";

test("submission and retry preserve the selected area, floor, and original business date across cutoff", async t => {
  const previousWindow = globalThis.window;
  const previousEndpoint = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL;
  const requests = [];
  globalThis.window = { setTimeout, clearTimeout };
  process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL = "https://example.invalid/test-inspections";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return { json: async () => ({ success: true, inspectionId: "test-receipt" }) };
  });
  try {
    const date = getBusinessDate(new Date("2026-11-04T08:59:59Z"));
    assert.notEqual(date, getBusinessDate(new Date("2026-11-04T09:00:00Z")));
    for (const floorNumber of ["1st", "2nd", "3rd"]) {
      for (const area of ["Bar", "Beverage Stations"]) {
        const inspection = {
          id: `${floorNumber}-${area}`, businessDate: date, floorNumber, area, daypart: "Close", manager: "Test manager",
          startedAt: "2026-11-04T08:59:59Z", responses: { example: { result: "yes" } }, actions: {}, status: "pending",
        };
        for (let attempt = 0; attempt < 2; attempt++) {
          assert.deepEqual(await submitInspection(inspection), { success: true, inspectionId: "test-receipt" });
          const request = requests.at(-1);
          assert.equal(request.method, "POST");
          assert.equal(request.headers["Content-Type"], "text/plain;charset=utf-8");
          assert.deepEqual(request.body, inspection);
          assert.equal(request.body.businessDate, "2026-11-03");
          assert.equal(inspection.status, "pending");
        }
      }
    }
    assert.equal(requests.length, 12);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousEndpoint === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL;
    else process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL = previousEndpoint;
  }
});
