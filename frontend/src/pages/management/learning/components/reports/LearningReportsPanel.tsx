import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { FileBarChart, Plus, Eye, Download, Pencil, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reportApi } from "./report-api";
import type { Language, Mode, Options, Period, ReportInput, ReportItem, Section } from "./report-api";
import { aiStatuses, dateText, periods, rangeText, reportPeriod, sectionLabels } from "./report-content";
import { ReportView } from "./ReportView";
import { Field, fieldClass } from "../habits/HabitForms";
import { habitError } from "../habits/habit-format";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function GenerateReport({ options, seed, busy, onGenerate, onClose }: {
  options: Options; seed?: ReportItem; busy: boolean; onGenerate: (input: ReportInput) => void; onClose: () => void;
}) {
  const [type, setType] = useState<Period>(seed?.type ?? "MONTHLY");
  const [anchor, setAnchor] = useState(seed?.from ?? options.today);
  const [from, setFrom] = useState(seed?.from ?? options.today);
  const [to, setTo] = useState(seed?.to ?? options.today);
  const [language, setLanguage] = useState<Language>(seed?.language ?? "EN");
  const [mode, setMode] = useState<Mode>(seed?.mode ?? "STANDARD");
  const [selected, setSelected] = useState<Section[]>(() =>
    seed?.sections.filter(section => section !== "AI" && options.sections.includes(section)) ??
      options.sections.filter(section => section !== "AI"));
  const [error, setError] = useState("");
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  const dates = type === "CUSTOM" ? { from, to, ongoing: false } : reportPeriod(type, anchor || options.today, options.today);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    const length = (Date.parse(dates.to) - Date.parse(dates.from)) / 86400000 + 1;
    if (!title || !selected.length || !Number.isFinite(length) || length < 1 || length > options.maxDays || dates.to > options.today) {
      setError("Enter a title, select a section, and choose a valid reporting period.");
      return;
    }
    setError("");
    const input = { title, type, from: dates.from, to: dates.to, language, mode, sections: selected };
    const fingerprint = JSON.stringify(input);
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, key: crypto.randomUUID() };
    onGenerate({ ...input, requestKey: submission.current.key });
  }

  return <section className="rounded-xl border bg-card p-4 sm:p-5">
    <h3 className="font-semibold">{seed ? "Generate Updated Report" : "Generate New Report"}</h3>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <Field label="Report title"><Input name="title" required maxLength={150} defaultValue={seed?.title ?? "Learning Report"} /></Field>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Reporting period</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(periods) as Period[]).map(value => <label key={value} className="flex items-center gap-2 text-sm">
            <input type="radio" name="period" checked={type === value} onChange={() => setType(value)} className="accent-primary" />
            {periods[value]}
          </label>)}
        </div>
      </fieldset>
      {type === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date"><Input type="date" required min="1900-01-01" max={options.today} value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="End date"><Input type="date" required min={from} max={options.today} value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div> : <Field label="Date within the period"><Input type="date" required min="1900-01-01" max={options.today}
        value={anchor} onChange={e => setAnchor(e.target.value)} /></Field>}
      {dates.from && dates.to && <p className="text-sm text-muted-foreground">
        {dateText(dates.from)} – {dateText(dates.to)} · {options.zone}{dates.ongoing && " · Period to date"}
      </p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Report language"><select className={fieldClass} value={language} onChange={e => setLanguage(e.target.value as Language)}>
          <option value="EN">English</option><option value="VI">Tiếng Việt</option>
        </select></Field>
        <Field label="Generation mode"><select className={fieldClass} value={mode} onChange={e => setMode(e.target.value as Mode)}>
          <option value="STANDARD">Standard report</option><option value="AI_ENHANCED">AI-enhanced report</option>
        </select></Field>
      </div>
      {mode === "AI_ENHANCED" && !options.aiAvailable && <p className="text-sm text-muted-foreground">
        AI is currently unavailable. Your statistics will still be saved and exportable.
      </p>}
      <fieldset className="grid gap-2 border-t pt-3 sm:grid-cols-2">
        <legend className="pr-2 text-sm font-medium">Include in report</legend>
        {options.sections.filter(section => section !== "AI").map(section => <label key={section} className="flex items-center gap-2 text-sm">
          <input className="accent-primary" type="checkbox" checked={selected.includes(section)} onChange={e =>
            setSelected(previous => e.target.checked ? [...previous, section] : previous.filter(item => item !== section))} />
          {sectionLabels[section][0]}
        </label>)}
        <label className="flex items-center gap-2 text-sm">
          <input className="accent-primary" type="checkbox" checked={mode === "AI_ENHANCED"}
            onChange={event => setMode(event.target.checked ? "AI_ENHANCED" : "STANDARD")} />
          {sectionLabels.AI[0]}
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate Learning Report"}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
      </div>
    </form>
  </section>;
}

const pageSize = 10;
export function LearningReportsPanel({ account }: { account: string }) {
  const client = useQueryClient();
  const key = ["learning-reports", account] as const;
  const [page, setPage] = useState(0);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<number>();
  const [generate, setGenerate] = useState<ReportItem | true>();
  const [action, setAction] = useState<{ type: "rename" | "delete"; item: ReportItem }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const options = useQuery({ queryKey: [...key, "options"], queryFn: ({ signal }) => reportApi.options(signal) });
  const history = useQuery({
    queryKey: [...key, "history", page, type, from, to],
    queryFn: ({ signal }) => reportApi.history({ page, size: pageSize, type: type || undefined,
      from: from || undefined, to: to || undefined }, signal),
    enabled: !from || !to || from <= to,
  });
  const detail = useQuery({
    queryKey: [...key, "detail", selected],
    queryFn: ({ signal }) => reportApi.detail(selected!, signal),
    enabled: selected != null,
    refetchInterval: query => query.state.data?.report.aiStatus === "PENDING" ? 2500 : false,
  });

  async function run(work: () => Promise<void>, success?: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await work(); if (success) setNotice(success); }
    catch (failure) { setError(habitError(failure)); }
    finally { setBusy(false); }
  }
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const exportExcel = (id: number) => void run(async () => saveBlob(await reportApi.xlsx(id), "learning-report-" + id + ".xlsx"));
  const closeReport = () => { setSelected(undefined); setError(""); };

  return <div className="space-y-4">
    {error && !action && <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {selected != null && !generate ? detail.data && !detail.isError ? <ReportView detail={detail.data} busy={busy}
      aiAvailable={!!options.data?.aiAvailable} onBack={closeReport} onExcel={() => exportExcel(selected)}
      onPdf={() => void run(async () => { const { exportReportPdf } = await import("./report-pdf"); await exportReportPdf(detail.data); })}
      onRetry={() => void run(async () => { await reportApi.retry(selected); await refresh(); })}
      onUpdate={() => setGenerate(detail.data.report)} />
      : <div className="rounded-xl border p-4">
        <Button variant="ghost" onClick={closeReport}>Back to history</Button>
        {detail.isError ? <p role="alert">{habitError(detail.error)}</p> : <p role="status">Loading report…</p>}
      </div> : <>
      <header className="flex flex-wrap items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-3 text-primary"><FileBarChart size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Personal Learning Reports</h2>
          <p className="text-sm text-muted-foreground">Review your learning activity, progress, and goals over a selected period.</p>
        </div>
        {!generate && <Button disabled={!options.data} onClick={() => { setGenerate(true); setError(""); }}><Plus /> Generate report</Button>}
      </header>
      <dl className="grid gap-2 sm:grid-cols-3">
        {[
          ["Saved reports", history.data?.totalSaved ?? "—"],
          ["Generated this month", history.data?.createdThisMonth ?? "—"],
          ["Last generated", history.data?.lastGenerated ? dateText(history.data.lastGenerated, "EN", options.data?.zone) : "—"],
        ].map(([label, value]) => <div className="rounded-xl border bg-card p-4" key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>
      {options.isError && <p role="alert">Could not load report configuration. <button className="underline" onClick={() => void options.refetch()}>Retry</button></p>}
      {generate && options.data && <GenerateReport options={options.data} seed={generate === true ? undefined : generate}
        busy={busy} onClose={() => setGenerate(undefined)} onGenerate={input => void run(async () => {
          const created = await reportApi.create(input);
          client.setQueryData([...key, "detail", created.report.id], created);
          setSelected(created.report.id); setGenerate(undefined);
          await refresh();
        }, "Report saved.")} />}
      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="font-semibold">Report History</h3>
        <div className="flex flex-wrap gap-2">
          <Field label="Type"><select className={fieldClass} value={type} onChange={e => { setType(e.target.value); setPage(0); }}>
            <option value="">All periods</option>
            {(Object.keys(periods) as Period[]).map(value => <option value={value} key={value}>{periods[value]}</option>)}
          </select></Field>
          <Field label="Period from"><Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} /></Field>
          <Field label="Period to"><Input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0); }} /></Field>
        </div>
        {from && to && from > to ? <p role="alert" className="text-sm text-destructive">Start date must be before the end date.</p>
          : history.isError ? <p role="alert">Could not load history. <button className="underline" onClick={() => void history.refetch()}>Retry</button></p>
          : history.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading reports…</p>
          : history.data.items.length ? <ul className="divide-y">
            {history.data.items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <button className="max-w-full break-words text-left font-medium hover:underline" onClick={() => setSelected(item.id)}>{item.title}</button>
                <p className="text-sm text-muted-foreground">{rangeText(item)} · {periods[item.type]}</p>
                <p className="text-xs text-muted-foreground">{dateText(item.generatedAt, "EN", item.zone)} · {aiStatuses[item.aiStatus]}</p>
              </div>
              <div className="flex flex-wrap gap-0.5">
                <Button size="icon-sm" variant="ghost" aria-label={"View " + item.title} onClick={() => setSelected(item.id)}><Eye /></Button>
                <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={"Export Excel " + item.title} onClick={() => exportExcel(item.id)}><Download /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={"Rename " + item.title} onClick={() => { setError(""); setAction({ type: "rename", item }); }}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={"Delete " + item.title} onClick={() => { setError(""); setAction({ type: "delete", item }); }}><Trash2 /></Button>
              </div>
            </li>)}
          </ul> : <p className="text-sm text-muted-foreground">{type || from || to ? "No reports match these filters." : "Your saved reports will appear here."}</p>}
        {(page > 0 || (history.data?.matches ?? 0) > pageSize) && <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button variant="outline" disabled={(page + 1) * pageSize >= (history.data?.matches ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
        </div>}
      </section>
    </>}
    {action && <Dialog open onOpenChange={open => { if (!open && !busy) setAction(undefined); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{action.type === "rename" ? "Rename report" : "Delete report?"}</DialogTitle>
          <DialogDescription>{action.type === "rename" ? "Change the report title." : "The saved report will be removed from history."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={event => {
          event.preventDefault();
          const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
          if (action.type === "rename" && !title) { setError("Enter a title."); return; }
          void run(async () => {
            if (action.type === "rename") await reportApi.rename(action.item.id, title);
            else {
              await reportApi.remove(action.item.id);
              client.removeQueries({ queryKey: [...key, "detail", action.item.id] });
              if (page > 0 && history.data?.items.length === 1) setPage(page - 1);
            }
            setAction(undefined);
            await refresh();
          }, action.type === "rename" ? "Report renamed." : "Report deleted.");
        }}>
          {action.type === "rename" && <Field label="Title"><Input name="title" required maxLength={150} defaultValue={action.item.title} /></Field>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" type="button" disabled={busy} onClick={() => setAction(undefined)}>Cancel</Button>
            <Button variant={action.type === "delete" ? "destructive" : "default"} disabled={busy} type="submit">
              {action.type === "delete" ? "Delete report" : "Save title"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>}
  </div>;
}
