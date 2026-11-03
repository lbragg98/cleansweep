import type { Area, Daypart, Inspection } from "../types/checklist";

export const floors = ["1st", "2nd", "3rd"] as const;
export type Floor = typeof floors[number];
export const areas = ["Bar", "Beverage Stations"] as const;
export const dayparts: { name: Daypart; time: string }[] = [
  { name: "Open", time: "9:00 AM" },
  { name: "Mid AM", time: "12:00 PM" },
  { name: "Mid PM", time: "4:00 PM" },
  { name: "Evening", time: "8:00 PM" },
  { name: "Close", time: "Late" },
];

export function normalizeFloor(value: string): Floor | undefined {
  const label = value.trim().toLowerCase().replace(/^floor\s*|\s*floor$/g, "").trim();
  const index = [["1", "1st", "first"], ["2", "2nd", "second"], ["3", "3rd", "third"]]
    .findIndex(aliases => aliases.includes(label));
  return floors[index];
}

export function getAreaProgress(inspections: Inspection[], businessDate: string, floor: Floor, area: Area) {
  const rows = inspections.filter(row => row.businessDate === businessDate && normalizeFloor(row.floorNumber) === floor && row.area === area);
  const completed = dayparts.filter(part => rows.some(row => row.daypart === part.name && (row.status === "pending" || row.status === "synced")));
  return {
    completed,
    nextDaypart: dayparts.find(part => !completed.some(done => done.name === part.name)),
    draft: rows.find(row => row.status === "draft"),
    pendingCount: rows.filter(row => row.status === "pending").length,
  };
}

export function getCompletedCount(inspections: Inspection[], businessDate: string, floor?: Floor): number {
  const selectedFloors: readonly Floor[] = floor ? [floor] : floors;
  return selectedFloors.reduce((total, currentFloor) => total + areas.reduce(
    (count, area) => count + getAreaProgress(inspections, businessDate, currentFloor, area).completed.length, 0,
  ), 0);
}
