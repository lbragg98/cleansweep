import { Inspection } from "@/types/checklist";
const key="clean-sweep-inspections";
export const loadInspections = ():Inspection[] => { if(typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(key) || "[]") as Inspection[]; } catch { return []; } };
export const saveInspections = (rows:Inspection[]) => { if(typeof window !== "undefined") localStorage.setItem(key,JSON.stringify(rows)); };
