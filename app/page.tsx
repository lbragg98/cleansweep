"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, BarChart3, Check, ChevronRight, Droplets, History, House, Plus, RotateCcw, Settings, ShieldCheck, Trash2, X } from "lucide-react";
import { checklists } from "@/data/checklists";
import { isFailed } from "@/lib/validation";
import { loadInspections, saveInspections } from "@/lib/storage";
import { submitInspection } from "@/lib/google-sheets-client";
import { getBusinessDate } from "@/lib/date";
import { areas, dayparts, floors, getAreaProgress, getCompletedCount, normalizeFloor } from "@/lib/inspection-progress";
import type { Floor } from "@/lib/inspection-progress";
import type { Area, Daypart, Inspection, Result } from "@/types/checklist";

type Screen="dashboard"|"start"|"checklist"|"review"|"complete"|"history"|"settings";
const startSchema=z.object({date:z.iso.date(),floorNumber:z.enum(floors),manager:z.string().trim().min(1),daypart:z.enum(["Open","Mid AM","Mid PM","Evening","Close"])});
type StartValues=z.infer<typeof startSchema>;
type StartContext = { area: Area; floorNumber: Floor; date: string; daypart: Daypart };

export default function Home(){
  const [screen,setScreen]=useState<Screen>("dashboard"); const [inspections,setInspections]=useState<Inspection[]>([]); const [active,setActive]=useState<Inspection|null>(null); const [cursor,setCursor]=useState(0); const [notice,setNotice]=useState(""); const [syncing,setSyncing]=useState(false);
  const [today, setToday] = useState("");
  const [floor, setFloor] = useState<Floor>("1st");
  const [startContext, setStartContext] = useState<StartContext | null>(null);
  useEffect(() => {
    setInspections(loadInspections());
    let timer: ReturnType<typeof setTimeout>;
    const refreshDate = () => {
      setToday(getBusinessDate());
      clearTimeout(timer);
      timer = setTimeout(refreshDate, 60000 - Date.now() % 60000);
    };
    refreshDate();
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);
  useEffect(() => {
    if (today) saveInspections(inspections);
  }, [inspections, today]);
  const write = (change: Inspection[] | ((rows: Inspection[]) => Inspection[])) => setInspections(change);
  const nav=(target:Screen)=>{setNotice("");setScreen(target)};
  const openStart = (area: Area, selectedFloor = floor) => {
    const date = getBusinessDate();
    setToday(date);
    setFloor(selectedFloor);
    setStartContext({ area, floorNumber: selectedFloor, date, daypart: getAreaProgress(inspections, date, selectedFloor, area).nextDaypart?.name ?? "Open" });
    nav("start");
  };
  const start = (values: StartValues) => {
    if (!startContext) return;
    const inspection: Inspection = { id: crypto.randomUUID(), businessDate: values.date, floorNumber: values.floorNumber, manager: values.manager, area: startContext.area, daypart: values.daypart, startedAt: new Date().toISOString(), responses: {}, actions: {}, status: "draft" };
    write(rows => [inspection, ...rows]);
    setFloor(values.floorNumber);
    setActive(inspection);
    setCursor(0);
    nav("checklist");
  };
  const patchInspection = (id: string, patch: Partial<Inspection>) => {
    setActive(previous => previous?.id === id ? { ...previous, ...patch } : previous);
    write(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };
  const resume = (inspection: Inspection) => {
    setActive(inspection);
    setFloor(normalizeFloor(inspection.floorNumber) ?? floor);
    setCursor(0);
    nav("checklist");
  };
  return <main className="app-shell"><Header screen={screen} onNav={nav}/><div className="brand-rule"/><div className="surface"><div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-8">
    {screen === "dashboard" && (today ? <Dashboard today={today} inspections={inspections} floor={floor} onFloorChange={setFloor} onStart={openStart} onResume={resume} onHistory={() => nav("history")}/> : <p>Loading inspections…</p>)}
    {screen === "start" && startContext && <StartInspection context={startContext} onSubmit={start} onBack={() => nav("dashboard")}/>}
    {screen === "checklist" && active && <Checklist inspection={active} cursor={cursor} setCursor={setCursor} onUpdate={patch => patchInspection(active.id, patch)} onReview={() => nav("review")} onBack={() => nav("dashboard")}/>}
    {screen === "review" && active && <Review inspection={active} syncing={syncing} onBack={() => nav("checklist")} onSubmit={async () => {
      if (syncing) return;
      setSyncing(true);
      const submitted: Inspection = { ...active, status: "pending" };
      patchInspection(submitted.id, { status: "pending" });
      const result = await submitInspection(submitted);
      if (result.success) patchInspection(submitted.id, { status: "synced" });
      setNotice(result.success ? "Inspection saved to Google Sheets." : result.error || "Submission failed.");
      setSyncing(false);
      setScreen("complete");
    }}/>}
    {screen === "complete" && active && <Complete inspection={active} notice={notice} onNew={() => openStart(active.area, normalizeFloor(active.floorNumber) ?? floor)} onHome={() => nav("dashboard")}/>}
    {screen === "history" && <HistoryPage inspections={inspections} onBack={() => nav("dashboard")} onResume={resume} onRetry={async inspection => {
      if (inspection.status !== "pending") return;
      const result = await submitInspection(inspection);
      if (result.success) patchInspection(inspection.id, { status: "synced" });
    }}/>}
    {screen === "settings" && <SettingsPage inspections={inspections} onClear={() => { write([]); setNotice("Local inspection history cleared."); }}/>}
  </div></div></main>;
}

function Header({screen,onNav}:{screen:Screen;onNav:(s:Screen)=>void}){return <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-8"><button onClick={()=>onNav("dashboard")} className="flex items-center gap-3 text-left"><Image src="/icons/icon-192.png" width={40} height={40} alt="" className="h-10 w-10 shrink-0 rounded-xl"/><span><span className="block text-[11px] font-bold uppercase tracking-[.25em] text-[var(--turf)]">Operations</span><span className="text-xl font-black tracking-tight">Clean Sweep</span></span></button><nav className="hidden items-center gap-1 sm:flex"><NavButton active={screen==="dashboard"} icon={<House size={16}/>} label="Today" onClick={()=>onNav("dashboard")}/><NavButton active={screen==="history"} icon={<History size={16}/>} label="History" onClick={()=>onNav("history")}/><NavButton active={screen==="settings"} icon={<Settings size={16}/>} label="Settings" onClick={()=>onNav("settings")}/></nav><button onClick={()=>onNav("settings")} className="rounded-full p-2 text-white/70 hover:bg-white/10 sm:hidden" aria-label="Settings"><Settings size={20}/></button></header>}
function NavButton({active,icon,label,onClick}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}){return <button onClick={onClick} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${active?"bg-white text-[var(--navy)]":"text-white/70 hover:bg-white/10"}`}>{icon}{label}</button>}
function SectionTitle({eyebrow,title,copy}:{eyebrow:string;title:string;copy?:string}){return <div className="mb-7"><p className="mb-2 text-xs font-black uppercase tracking-[.22em] text-[var(--blue)]">{eyebrow}</p><h1 className="text-3xl font-black tracking-tight text-[var(--ink)] sm:text-4xl">{title}</h1>{copy&&<p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{copy}</p>}</div>}
function Dashboard({ today, inspections, floor, onFloorChange, onStart, onResume, onHistory }: {
  today: string; inspections: Inspection[]; floor: Floor; onFloorChange: (floor: Floor) => void;
  onStart: (area: Area) => void; onResume: (inspection: Inspection) => void; onHistory: () => void;
}) {
  const current = inspections.filter(inspection => inspection.businessDate === today);
  const floorRows = current.filter(inspection => normalizeFloor(inspection.floorNumber) === floor);
  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--blue)]">{new Date(`${today}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" })}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--ink)] sm:text-5xl">Ready for service?</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Business day changes at 4 AM Eastern.</p>
      </div>
    </div>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[var(--ink)]">Floor</span>
        <select value={floor} onChange={event => onFloorChange(event.target.value as Floor)} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]">
          {floors.map(value => <option key={value} value={value}>{value} floor</option>)}
        </select>
      </label>
      <p className="text-sm font-bold text-[var(--muted)]">{floor} floor · {getCompletedCount(inspections, today, floor)}/10 complete</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {areas.map(area => <AreaCard key={area} area={area} floor={floor} progress={getAreaProgress(inspections, today, floor, area)} onStart={() => onStart(area)} onResume={onResume}/>)}
    </div>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--muted)]">{floor} floor</p>
        <p className="mt-1 font-bold text-[var(--ink)]">{floorRows.filter(row => row.status === "draft").length} drafts · {floorRows.filter(row => row.status === "pending").length} pending sync</p>
      </div>
      <button onClick={onHistory} className="flex items-center gap-1 font-black text-[var(--blue)]">View history <ChevronRight size={16}/></button>
    </div>
  </>;
}

function AreaCard({ area, floor, progress, onStart, onResume }: {
  area: Area; floor: Floor; progress: ReturnType<typeof getAreaProgress>; onStart: () => void; onResume: (inspection: Inspection) => void;
}) {
  return <section aria-label={`${area} progress`} className={`card ${area === "Bar" ? "surface-blue" : "surface-aqua"} p-5 sm:p-6`}>
    <button onClick={onStart} aria-label={`New ${area} inspection`} className="group flex w-full items-center justify-between gap-3 text-left">
      <span className="flex items-center gap-4">
        <span className="icon-disc">{area === "Bar" ? <BarChart3/> : <Droplets/>}</span>
        <span><span className="block text-xl font-black text-[var(--ink)]">{area}</span><span className="text-sm text-[var(--muted)]">{floor} floor · {progress.completed.length}/5 complete</span></span>
      </span>
      <Plus className="shrink-0 text-[var(--blue)] transition group-hover:rotate-90"/>
    </button>
    <div className="mt-6 grid grid-cols-5 gap-2">
      {dayparts.map(part => {
        const done = progress.completed.some(completed => completed.name === part.name);
        return <div key={part.name} className="text-center" aria-label={`${part.name}: ${done ? "complete" : "incomplete"}`}>
          <div className={`mb-2 h-2 rounded-full ${done ? "progress-complete" : "bg-[var(--gray)]"}`}/>
          <span className="text-[10px] font-bold text-[var(--ink)]">{part.name}</span>
        </div>;
      })}
    </div>
    <p className="mt-5 text-sm font-bold text-[var(--ink)]">{progress.nextDaypart ? `Next: ${progress.nextDaypart.name} · ${progress.nextDaypart.time}` : "All dayparts covered"}</p>
    <p className="mt-1 text-xs text-[var(--muted)]">{progress.pendingCount} pending sync · Repeat inspections are always available.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={onStart} className="flex items-center gap-2 rounded-xl primary-action px-4 py-3 text-sm font-black">Begin inspection <ArrowRight size={16}/></button>
      {progress.draft && <button onClick={() => onResume(progress.draft!)} className="rounded-xl border border-[var(--navy)] px-4 py-3 text-sm font-black text-[var(--navy)]">Resume {progress.draft.daypart} draft</button>}
    </div>
  </section>;
}

function StartInspection({ context, onSubmit, onBack }: { context: StartContext; onSubmit: (values: StartValues) => void; onBack: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<StartValues>({
    resolver: zodResolver(startSchema),
    defaultValues: { date: context.date, floorNumber: context.floorNumber, daypart: context.daypart },
  });
  return <div className="max-w-2xl">
    <button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={16}/> Back to today</button>
    <SectionTitle eyebrow="New inspection" title={context.area} copy="Set the shift details before starting your checklist."/>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-xl bg-white p-4"><Detail label="Checklist area" value={context.area}/></div>
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[var(--ink)]">Business date</span>
        <input type="date" {...register("date")} className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]"/>
        <span className="mt-1 block text-xs text-[var(--muted)]">Closing inspections before 4 AM Eastern belong to the previous business day.</span>
        {errors.date && <span className="text-xs text-[var(--danger-ink)]">Enter a valid business date.</span>}
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[var(--ink)]">Floor Number</span>
        <select {...register("floorNumber")} className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]">
          {floors.map(floor => <option key={floor} value={floor}>{floor} floor</option>)}
        </select>
        {errors.floorNumber && <span className="text-xs text-[var(--danger-ink)]">Choose a floor.</span>}
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[var(--ink)]">Manager name</span>
        <input {...register("manager")} className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]"/>
        {errors.manager && <span className="text-xs text-[var(--danger-ink)]">This field is required.</span>}
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[var(--ink)]">Daypart</span>
        <select {...register("daypart")} className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]">{dayparts.map(part => <option key={part.name}>{part.name}</option>)}</select>
      </label>
      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl primary-action px-5 py-4 font-black">Start checklist <ArrowRight size={18}/></button>
    </form>
  </div>;
}
function Checklist({inspection,cursor,setCursor,onUpdate,onReview,onBack}:{inspection:Inspection;cursor:number;setCursor:(n:number)=>void;onUpdate:(p:Partial<Inspection>)=>void;onReview:()=>void;onBack:()=>void}){const items=checklists[inspection.area].items;const item=items[cursor];const response=inspection.responses[item.id];const answered=Object.values(inspection.responses).filter(r=>r.result).length;const failed=items.filter(i=>isFailed(i,inspection.responses[i.id])).length;const actionText=inspection.actions[item.id]?.action?.trim()||"";const answer=(result:Result)=>{onUpdate({responses:{...inspection.responses,[item.id]:{...response,result}}});if(result!=="no"&&cursor<items.length-1)window.setTimeout(()=>setCursor(cursor+1),150);};const canNext=response?.result!=="no"?Boolean(response?.result):Boolean(actionText);const next=()=>cursor<items.length-1?setCursor(cursor+1):onReview();return <div><div className="sticky top-0 z-10 -mx-4 mb-6 bg-[var(--sand)]/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8"><div className="flex items-center justify-between text-xs font-black"><button onClick={onBack} className="flex items-center gap-1 text-[var(--muted)]"><X size={15}/> Exit</button><span className="text-[var(--navy)]">{answered}/{items.length} answered</span><button onClick={onReview} className="text-[var(--blue)]">Review</button></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--gray)]"><div className="h-full rounded-full progress-complete transition-all" style={{width:`${Math.round((answered/items.length)*100)}%`}}/></div></div><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[var(--blue)]">{inspection.area} · {item.category}</p><p className="mt-1 text-sm font-bold text-[var(--muted)]">Question {cursor+1} of {items.length}</p></div>{failed>0&&<span className="rounded-full bg-[var(--danger-surface)] px-3 py-1 text-xs font-black text-[var(--danger-ink)]">{failed} needs action</span>}</div><div className="card bg-white p-5 sm:p-8"><div className="flex gap-4"><span className="icon-disc"><ShieldCheck size={22}/></span><div><h1 className="text-xl font-black leading-tight text-[var(--ink)] sm:text-2xl">{item.title}</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p></div></div><div className="mt-6 grid grid-cols-3 gap-2"><AnswerButton label="YES" icon={<Check size={17}/>} selected={response?.result==="yes"} onClick={()=>answer("yes")} color="green"/><AnswerButton label="NO" icon={<X size={17}/>} selected={response?.result==="no"} onClick={()=>answer("no")} color="red"/><AnswerButton label="N/A" icon={<RotateCcw size={16}/>} selected={response?.result==="na"} onClick={()=>answer("na")} color="gray"/></div>{isFailed(item,response)&&<div className="mt-5 rounded-2xl border border-[var(--danger-line)] bg-[var(--danger-surface)] p-4 text-sm text-[var(--danger-ink)]"><p className="font-black">Corrective action required</p><p className="mt-1">Enter the action, then press Submit to continue.</p><textarea autoFocus value={inspection.actions[item.id]?.action||""} onChange={e=>onUpdate({actions:{...inspection.actions,[item.id]:{issue:item.title,action:e.target.value,correctedBy:inspection.manager,correctedImmediately:false,followUpRequired:false,followUpOwner:"",followUpDue:"",notes:""}}})} className="mt-3 min-h-24 w-full rounded-xl border border-[var(--danger-line)] bg-white p-3 text-[var(--ink)]" placeholder="Describe the corrective action"/></div>}</div><div className="mt-6 flex items-center justify-between gap-3"><button disabled={cursor===0} onClick={()=>setCursor(cursor-1)} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-black text-[var(--ink)] disabled:opacity-40"><ArrowLeft size={17}/> Previous</button>{response?.result==="no"?<button disabled={!canNext} onClick={next} className="flex items-center gap-2 rounded-xl primary-action px-5 py-3 font-black disabled:opacity-40">Submit <ArrowRight size={17}/></button>:cursor===items.length-1?<button disabled={!canNext} onClick={onReview} className="flex items-center gap-2 rounded-xl primary-action px-5 py-3 font-black disabled:opacity-40">Review <ArrowRight size={17}/></button>:<span className="text-xs font-bold text-[var(--muted)]">Choose an answer to continue</span>}</div></div>}
function AnswerButton({label,icon,selected,onClick,color}:{label:string;icon:React.ReactNode;selected:boolean;onClick:()=>void;color:string}){return <button onClick={onClick} data-tone={color} className={`flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-2 py-4 text-sm font-black text-[var(--ink)] transition hover:-translate-y-0.5 ${selected?"answer-selected":""}`}><span className={selected?"":"text-[var(--muted)]"}>{icon}</span>{label}</button>}
function Review({inspection,syncing,onBack,onSubmit}:{inspection:Inspection;syncing:boolean;onBack:()=>void;onSubmit:()=>void}){const items=checklists[inspection.area].items;const passed=items.filter(i=>inspection.responses[i.id]?.result==="yes").length;const failed=items.filter(i=>isFailed(i,inspection.responses[i.id])).length;const na=items.filter(i=>inspection.responses[i.id]?.result==="na").length;const incomplete=items.some(i=>!inspection.responses[i.id]?.result||isFailed(i,inspection.responses[i.id])&&!inspection.actions[i.id]?.action);return <div className="max-w-3xl"><button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={16}/> Back to checklist</button><SectionTitle eyebrow="Final review" title="Ready to submit?" copy="Review the shift record before it is sent to Google Sheets."/><div className="grid gap-3 sm:grid-cols-4"><Stat label="Passed" value={passed} tone="green"/><Stat label="Failed" value={failed} tone="red"/><Stat label="N/A" value={na} tone="gray"/><Stat label="Score" value={`${items.length?Math.round((passed/items.length)*100):0}%`} tone="blue"/></div><div className="card mt-6 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-[var(--muted)]">Inspection details</p><div className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Business date" value={inspection.businessDate}/><Detail label="Floor Number" value={inspection.floorNumber}/><Detail label="Manager" value={inspection.manager}/><Detail label="Area" value={inspection.area}/><Detail label="Daypart" value={inspection.daypart}/></div></div>{failed>0&&<div className="mt-4 rounded-2xl bg-[var(--danger-surface)] p-5"><p className="font-black text-[var(--danger-ink)]">{failed} corrective action{failed===1?"":"s"}</p><div className="mt-3 space-y-3">{items.filter(i=>isFailed(i,inspection.responses[i.id])).map(i=><div key={i.id} className="border-t border-[var(--danger-line)] pt-3 text-sm"><p className="font-bold text-[var(--ink)]">{i.title}</p><p className="mt-1 text-[var(--danger-ink)]">{inspection.actions[i.id]?.action||"Action details missing"}</p></div>)}</div></div>}<div className="mt-6 flex flex-col gap-3"><button disabled={incomplete||syncing} onClick={onSubmit} className="flex items-center justify-center gap-2 rounded-xl primary-action px-5 py-4 font-black disabled:cursor-not-allowed disabled:opacity-40">{syncing?"Syncing to Google Sheets…":"Submit inspection"} {!syncing&&<ArrowRight size={18}/>}</button>{incomplete&&<p className="text-center text-xs font-bold text-[var(--danger-ink)]">Answer every question and add corrective action details before submitting.</p>}</div></div>}
function Stat({label,value,tone}:{label:string;value:string|number;tone:string}){return <div className={`rounded-2xl p-4 ${tone==="green"?"bg-[var(--success-surface)]":tone==="red"?"bg-[var(--danger-surface)]":tone==="gray"?"bg-[var(--sand)]":"bg-[var(--card-blue)]"}`}><p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-black text-[var(--ink)]">{value}</p></div>}
function Detail({label,value}:{label:string;value:string}){return <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 font-black text-[var(--ink)]">{value}</p></div>}
function Complete({inspection,notice,onNew,onHome}:{inspection:Inspection;notice:string;onNew:()=>void;onHome:()=>void}){return <div className="mx-auto max-w-xl py-12 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--turf)] text-[var(--black)]"><Check size={40}/></div><p className="mt-7 text-xs font-black uppercase tracking-[.25em] text-[var(--blue)]">Inspection complete</p><h1 className="mt-3 text-4xl font-black text-[var(--ink)]">Shift record saved.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{notice||"Your inspection is safely stored on this device and ready to sync."}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"><button onClick={onNew} className="rounded-xl primary-action px-5 py-3 font-black">New inspection</button><button onClick={onHome} className="rounded-xl border border-[var(--line)] bg-white px-5 py-3 font-black text-[var(--ink)]">Back to today</button></div><p className="mt-8 text-xs font-bold text-[var(--muted)]">Status: {inspection.status === "synced" ? "Synced to Google Sheets" : "Pending sync"}</p></div>}
function HistoryPage({ inspections, onBack, onRetry, onResume }: {
  inspections: Inspection[]; onBack: () => void; onRetry: (inspection: Inspection) => void; onResume: (inspection: Inspection) => void;
}) {
  return <div>
    <button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={16}/> Today</button>
    <SectionTitle eyebrow="Audit trail" title="Inspection history" copy="Local records stay available until Google Sheets confirms receipt."/>
    {inspections.length === 0 ? <div className="card bg-white p-8 text-center"><History className="mx-auto text-[var(--muted)]"/><p className="mt-3 font-black text-[var(--ink)]">No inspections yet</p></div> : <div className="space-y-3">
      {inspections.map(inspection => <div key={inspection.id} className="card flex flex-wrap items-center justify-between gap-4 bg-white p-5">
        <div><p className="font-black text-[var(--ink)]">{inspection.area} · Floor {inspection.floorNumber}</p><p className="mt-1 text-sm text-[var(--muted)]">{inspection.businessDate} · {inspection.daypart} · {inspection.manager}</p></div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${inspection.status === "synced" ? "bg-[var(--success-surface)] text-[var(--ink)]" : "bg-[var(--pending-surface)] text-[var(--ink)]"}`}>{inspection.status === "synced" ? "Synced" : inspection.status === "draft" ? "Draft" : "Pending sync"}</span>
          {inspection.status === "pending" && <button onClick={() => onRetry(inspection)} className="rounded-lg bg-[var(--navy)] p-2 text-white" aria-label="Retry sync"><RotateCcw size={16}/></button>}
          {inspection.status === "draft" && <button onClick={() => onResume(inspection)} className="rounded-lg bg-[var(--navy)] px-3 py-2 text-sm font-bold text-white">Resume draft</button>}
        </div>
      </div>)}
    </div>}
  </div>;
}
function SettingsPage({inspections,onClear}:{inspections:Inspection[];onClear:()=>void}){return <div><SectionTitle eyebrow="Workspace" title="Settings" copy="Keep device preferences and the Google Sheets connection easy to verify."/><div className="space-y-4"><div className="card bg-white p-5"><div className="flex items-center gap-3"><ShieldCheck className="text-[var(--blue)]"/><div><p className="font-black text-[var(--ink)]">Google Sheets endpoint</p><p className="text-sm text-[var(--muted)]">{process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL?"Configured":"Not configured — add NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL"}</p></div></div></div><div className="card bg-white p-5"><p className="font-black text-[var(--ink)]">Local storage</p><p className="mt-1 text-sm text-[var(--muted)]">{inspections.length} inspection record{inspections.length===1?"":"s"} saved on this device.</p><button onClick={onClear} className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--danger-line)] px-4 py-3 text-sm font-black text-[var(--danger-ink)]"><Trash2 size={16}/> Clear local records</button></div><div className="card soft-grid bg-[var(--navy)] p-5 text-white"><p className="font-black">Setup in three steps</p><ol className="mt-3 space-y-2 text-sm leading-6 text-white/75"><li>1. Create a Google Sheet with tabs Inspections, Responses, Corrective Actions, and Daily Summary.</li><li>2. Paste <code className="text-[var(--turf)]">docs/google-apps-script/Code.gs</code> into Apps Script and run <code className="text-[var(--turf)]">setupSpreadsheet</code>.</li><li>3. Deploy as a web app and add its URL to <code className="text-[var(--turf)]">.env.local</code>.</li></ol></div></div></div>}
