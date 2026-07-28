import { ChecklistItem, Response } from "@/types/checklist";
export const isFailed = (_item:ChecklistItem, response?:Response) => response?.result === "no";
