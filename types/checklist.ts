export type Area = "Bar" | "Beverage Stations";
export type Daypart = "Open" | "Mid AM" | "Mid PM" | "Evening" | "Close";
export type Result = "yes" | "no" | "na";
export type ChecklistItem = { id:string; category:string; title:string; description:string; allowNA?:boolean };
export type ChecklistTemplate = { area:Area; items:ChecklistItem[] };
export type Response = { result?:Result; comment?:string };
export type CorrectiveAction = { issue:string; action:string; correctedBy:string; correctedImmediately:boolean; followUpRequired:boolean; followUpOwner:string; followUpDue:string; notes:string };
export type Inspection = { id:string; businessDate:string; floorNumber:string; manager:string; area:Area; daypart:Daypart; startedAt:string; responses:Record<string,Response>; actions:Record<string,CorrectiveAction>; status:"draft"|"pending"|"synced" };
