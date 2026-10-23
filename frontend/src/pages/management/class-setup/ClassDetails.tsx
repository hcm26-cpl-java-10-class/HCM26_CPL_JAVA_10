import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, BookOpen, CalendarDays, ChevronDown, ChevronUp, CircleHelp, ClipboardList, Users } from "lucide-react";
import { classSetupApi, type ClassProgramSubjects, type SharedClass, type SharedClassRequest } from "@/api/features/class-setup.api";
import type { TrainingProgramResponse } from "@/api/features/program.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClassDetailsProps = {
  classData: SharedClass | null;
  programs: TrainingProgramResponse[];
  canUpdate: boolean;
  canAssignProgram: boolean;
  sampleData: boolean;
  saving: boolean;
  error: string;
  notice: string;
  onBack: () => void;
  onSave: (request: SharedClassRequest, programId: string, programChanged: boolean) => void;
};

type DetailsTab = "Class Info" | "Trainee List" | "Calendar" | "Budget & Operation Info" | "Activities";

const getTodayInputDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const tabs: Array<{ label: DetailsTab; icon: typeof Users }> = [
  { label: "Class Info", icon: ClipboardList },
  { label: "Trainee List", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "Budget & Operation Info", icon: BookOpen },
  { label: "Activities", icon: CircleHelp },
];

const initialForm = (classData: SharedClass | null): SharedClassRequest => ({
  code: classData?.code ?? "",
  name: classData?.name ?? "",
  startDate: classData?.startDate ?? null,
  endDate: classData?.endDate ?? null,
  status: classData?.status?.toLowerCase() === "inactive" ? "inactive" : "active",
  plannedSize: classData?.plannedSize ?? null,
  deliveryType: classData?.deliveryType ?? "Class",
  traineeType: classData?.traineeType ?? "Fresher",
  formatType: classData?.formatType ?? "Offline",
  skills: classData?.skills ?? "",
  site: classData?.site ?? "",
  location: classData?.location ?? "",
  subjectType: classData?.subjectType ?? "IT Technical",
  scope: classData?.scope ?? "Unit",
  supplierPartner: classData?.supplierPartner ?? "",
  keyProgram: classData?.keyProgram ?? "",
  jobRecommendation: classData?.jobRecommendation ?? false,
});

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[62px] grid-cols-[minmax(112px,0.82fr)_minmax(0,1.18fr)] border-b border-r last:border-r-0">
      <Label htmlFor={htmlFor} className="flex items-center bg-muted/60 px-3 py-3 text-sm font-medium leading-5">
        {label}
      </Label>
      <div className="flex min-w-0 items-center px-2 py-1">{children}</div>
    </div>
  );
}

function EmptyTab({ tab }: { tab: Exclude<DetailsTab, "Class Info"> }) {
  const description = tab === "Trainee List"
    ? "Nguồn dữ liệu học viên chưa được kết nối. Khi tích hợp, một học viên có thể tham gia nhiều lớp."
    : tab === "Calendar"
      ? "Lịch học của lớp sẽ hiển thị tại đây khi được tạo."
      : tab === "Budget & Operation Info"
        ? "Thông tin ngân sách và vận hành chi tiết sẽ được cập nhật tại đây."
        : "Hoạt động của lớp sẽ hiển thị tại đây.";

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 px-6 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BookOpen className="size-5" aria-hidden="true" />
      </div>
      <h2 className="font-semibold">{tab}</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ClassDetails({
  classData,
  programs,
  canUpdate,
  canAssignProgram,
  sampleData,
  saving,
  error,
  notice,
  onBack,
  onSave,
}: ClassDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("Class Info");
  const [generalOpen, setGeneralOpen] = useState(true);
  const [form, setForm] = useState(() => initialForm(classData));
  const [programId, setProgramId] = useState(classData?.programId ? String(classData.programId) : "");
  const [originalProgramId, setOriginalProgramId] = useState(classData?.programId ? String(classData.programId) : "");
  const [currentProgram, setCurrentProgram] = useState<ClassProgramSubjects["program"]>(null);
  const [programLoadError, setProgramLoadError] = useState("");
  const earliestStartDate = getTodayInputDate();

  useEffect(() => {
    if (!classData?.id) return;
    let active = true;
    classSetupApi.getProgramSubjects(classData.id).then((result) => {
      if (!active) return;
      const currentId = result.program ? String(result.program.id) : "";
      setCurrentProgram(result.program);
      setProgramId(currentId);
      setOriginalProgramId(currentId);
      setProgramLoadError("");
    }).catch(() => {
      if (active) setProgramLoadError("Không tải được chương trình hiện tại của lớp.");
    });
    return () => { active = false; };
  }, [classData?.id]);

  const update = <K extends keyof SharedClassRequest>(key: K, value: SharedClassRequest[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(form, programId, programId !== originalProgramId);
  };

  const statusLabel = form.status === "active" ? "In progress" : "Inactive";
  const unavailableCurrentProgram = currentProgram && !programs.some((program) => program.id === currentProgram.id);
  const canSave = canUpdate && Boolean(form.code.trim()) && Boolean(form.name.trim())
    && (form.plannedSize == null || (Number.isInteger(form.plannedSize) && form.plannedSize >= 1 && form.plannedSize <= 10000))
    && (!form.startDate || form.startDate >= earliestStartDate)
    && !(form.startDate && form.endDate && form.endDate < form.startDate);

  return (
    <div className="fixed inset-0 z-[70] flex bg-background/95 p-2 sm:p-4">
      <section className="mx-auto flex h-full w-full max-w-[1680px] flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Class Details: {form.code || "New Class"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{form.name || "Create and manage class information"}</p>
            </div>
            <Badge variant={form.status === "active" ? "secondary" : "outline"} className={form.status === "active" ? "shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "shrink-0"}>
              {statusLabel}
            </Badge>
            <button type="button" title="Class details help" className="hidden size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 sm:inline-flex">
              <CircleHelp className="size-4" aria-hidden="true" />
            </button>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Back to Class List" onClick={onBack}>
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
        </header>

        <nav role="tablist" aria-label="Class details" className="flex shrink-0 gap-1 overflow-x-auto border-b px-4 sm:px-8">
          {tabs.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={activeTab === label}
              onClick={() => setActiveTab(label)}
              className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors sm:px-5 ${activeTab === label ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-4 sm:hidden" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
            {error && <Alert variant="destructive" className="mb-4"><AlertCircle aria-hidden="true" /><AlertTitle>Không thể lưu lớp</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {notice && <Alert className="mb-4 border-emerald-500/30 bg-emerald-500/5 text-emerald-800"><AlertTitle>Đã cập nhật</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
            {sampleData && <Alert className="mb-4"><AlertCircle aria-hidden="true" /><AlertTitle>Sample data</AlertTitle><AlertDescription>Local sample data resets when the backend restarts.</AlertDescription></Alert>}
            {activeTab === "Class Info" ? (
              <section className="overflow-hidden rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between bg-muted/50 px-5 py-4 text-left font-semibold"
                  aria-expanded={generalOpen}
                  onClick={() => setGeneralOpen((open) => !open)}
                >
                  General
                  {generalOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>
                {generalOpen && (
                  <div className="grid grid-cols-1 border-l border-t md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Class Name" htmlFor="class-name"><Input id="class-name" value={form.name} maxLength={255} disabled={!canUpdate || saving} onChange={(event) => update("name", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" required /></Field>
                    <Field label="Delivery Type" htmlFor="delivery-type"><Input id="delivery-type" value={form.deliveryType ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("deliveryType", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Trainee Type" htmlFor="trainee-type"><Input id="trainee-type" value={form.traineeType ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("traineeType", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Format Type" htmlFor="format-type"><Input id="format-type" value={form.formatType ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("formatType", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Skills" htmlFor="class-skills"><Input id="class-skills" value={form.skills ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("skills", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Training Program" htmlFor="class-program">
                      <Select value={programId || "none"} disabled={!canAssignProgram || saving || form.status !== "active"} onValueChange={(value) => setProgramId(value === "none" ? "" : value)}>
                        <SelectTrigger id="class-program" className="h-9 w-full border-0 shadow-none focus:ring-0"><SelectValue placeholder="Select a program" /></SelectTrigger>
                        <SelectContent>
                          {!originalProgramId && <SelectItem value="none">Select a program</SelectItem>}
                          {unavailableCurrentProgram && <SelectItem value={String(currentProgram.id)}>{currentProgram.code} · {currentProgram.name} · v{currentProgram.version}</SelectItem>}
                          {programs.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.code} · {program.name} · v{program.version}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Site" htmlFor="class-site"><Input id="class-site" value={form.site ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("site", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Location" htmlFor="class-location"><Input id="class-location" value={form.location ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("location", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Expected Start Date" htmlFor="class-start"><Input id="class-start" type="date" min={earliestStartDate} value={form.startDate ?? ""} disabled={!canUpdate || saving} onChange={(event) => {
                      const value = event.target.value;
                      if (value && value < earliestStartDate) return;
                      update("startDate", value || null);
                    }} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Expected End Date" htmlFor="class-end"><Input id="class-end" type="date" min={form.startDate || undefined} value={form.endDate ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("endDate", event.target.value || null)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Planned Trainee No." htmlFor="class-size"><Input id="class-size" type="number" min={1} max={10000} step={1} value={form.plannedSize ?? ""} disabled={!canUpdate || saving} onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        update("plannedSize", null);
                        return;
                      }
                      const plannedSize = Number(value);
                      if (Number.isInteger(plannedSize) && plannedSize >= 1 && plannedSize <= 10000) update("plannedSize", plannedSize);
                    }} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Subject Type" htmlFor="subject-type"><Input id="subject-type" value={form.subjectType ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("subjectType", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Class Code" htmlFor="class-code"><Input id="class-code" value={form.code} maxLength={50} disabled={!canUpdate || saving} onChange={(event) => update("code", event.target.value)} className="h-9 border-0 font-mono shadow-none focus-visible:ring-0" required /></Field>
                    <Field label="Status" htmlFor="class-status">
                      <Select value={form.status} disabled={!canUpdate || saving} onValueChange={(value) => update("status", value as SharedClassRequest["status"])}>
                        <SelectTrigger id="class-status" className="h-9 w-full border-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="active">In progress</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                      </Select>
                    </Field>
                    <Field label="Scope" htmlFor="class-scope"><Input id="class-scope" value={form.scope ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("scope", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Supplier/Partner" htmlFor="supplier-partner"><Input id="supplier-partner" value={form.supplierPartner ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("supplierPartner", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Key Program" htmlFor="key-program"><Input id="key-program" value={form.keyProgram ?? ""} disabled={!canUpdate || saving} onChange={(event) => update("keyProgram", event.target.value)} className="h-9 border-0 shadow-none focus-visible:ring-0" /></Field>
                    <Field label="Job Recommendation" htmlFor="job-recommendation"><Select value={form.jobRecommendation ? "yes" : "no"} disabled={!canUpdate || saving} onValueChange={(value) => update("jobRecommendation", value === "yes")}><SelectTrigger id="job-recommendation" className="h-9 w-full border-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></Field>
                  </div>
                )}
                {programLoadError && <p className="px-4 py-3 text-sm text-destructive">{programLoadError}</p>}
                {canAssignProgram && !programs.length && <p className="px-4 py-3 text-sm text-muted-foreground">No active training programs are available yet.</p>}
              </section>
            ) : <EmptyTab tab={activeTab} />}
          </main>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-4 py-3 sm:px-8">
            <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" />Back to Class List</Button>
            {canUpdate && <Button type="submit" disabled={saving || !canSave} className="min-w-36 bg-violet-600 text-white hover:bg-violet-700">
              {saving ? "Saving…" : classData ? "Save changes" : "Create Class"}
            </Button>}
          </footer>
        </form>
      </section>
    </div>
  );
}
