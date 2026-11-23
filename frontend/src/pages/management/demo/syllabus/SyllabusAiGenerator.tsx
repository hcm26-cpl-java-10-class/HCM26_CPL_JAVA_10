import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Check, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import {
  syllabusAiApi,
  type SyllabusAiDraft,
  type SyllabusAiSection,
  type SyllabusAiTopic,
} from "@/api/features/demo/syllabus-ai.api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYLLABUS_DEGREE_LEVEL_OPTIONS, isStandardSyllabusDegreeLevel } from "./syllabusDegreeLevels";

const normalize = (draft: SyllabusAiDraft): SyllabusAiDraft => ({
  ...draft,
  description: draft.description ?? "",
  teachingMethods: draft.teachingMethods ?? "",
  degreeLevel: draft.degreeLevel ?? "",
  timeAllocation: draft.timeAllocation ?? "",
  studentResponsibilities: draft.studentResponsibilities ?? "",
  requiredTools: draft.requiredTools ?? "",
  scoringScale: draft.scoringScale ?? null,
  clos: draft.clos ?? [],
  sections: (draft.sections ?? []).map((s) => ({
    ...s, mission: s.mission ?? "", topics: (s.topics ?? []).map((t) => ({ ...t, cloNumbers: t.cloNumbers ?? [] })),
  })),
  materials: [], // Legacy API field only; learning content lives on Courses.
});

function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; detail?: string; errors?: Record<string, string[]> } | undefined;
    const field = Object.values(data?.errors ?? {}).flat().find((x) => typeof x === "string");
    return field ?? data?.detail ?? data?.message ?? (error.response?.status === 403 ? "You do not have permission." : "AI request failed.");
  }
  return "AI request failed. Check Backend connectivity.";
}

function TextField({ label, value, onChange, maxLength = 200, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; maxLength?: number; placeholder?: string;
}) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
    {label}
    <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} className="h-9 text-sm" />
  </label>;
}

function LongField({ label, value, onChange, maxLength = 2000, rows = 2 }: {
  label: string; value: string; onChange: (value: string) => void; maxLength?: number; rows?: number;
}) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
    {label}
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} rows={rows} className="resize-y text-sm" />
  </label>;
}

/** Same choices as the regular Syllabus General Information editor. */
function DegreeLevelField({ label, value, onChange, id }: {
  label: string; value: string; onChange: (value: string) => void; id: string;
}) {
  const [customSelected, setCustomSelected] = useState(false);
  const isCustom = (value.trim() !== "" && !isStandardSyllabusDegreeLevel(value)) || (customSelected && value === "");
  const selected = isCustom ? "__custom__" : (value || "__none__");
  return <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
    <label htmlFor={id}>{label}</label>
    <Select value={selected} onValueChange={(next) => {
      setCustomSelected(next === "__custom__");
      onChange(next === "__custom__" || next === "__none__" ? "" : next);
    }}>
      <SelectTrigger id={id} className="h-9 w-full text-sm"><SelectValue placeholder="Choose degree level" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Not selected</SelectItem>
        {SYLLABUS_DEGREE_LEVEL_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        <SelectItem value="__custom__">Other / custom</SelectItem>
      </SelectContent>
    </Select>
    {isCustom && <Input aria-label={`${label} (custom)`} value={value} maxLength={100}
      placeholder="Enter a custom degree level" onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />}
  </div>;
}

export default function SyllabusAiGenerator({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canSave = hasPermission("SYLLABUS_CREATE") && hasPermission("SYLLABUS_UPDATE");
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<SyllabusAiDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const status = useQuery({ queryKey: ["syllabus-ai-status"], queryFn: syllabusAiApi.status, retry: false });

  const changePrompt = (value: string) => {
    setPrompt(value);
    if (draft) setNeedsRegeneration(true);
  };
  const edit = (fn: (previous: SyllabusAiDraft) => SyllabusAiDraft) => {
    setDraft((prev) => prev ? fn(prev) : prev);
    setModified(true);
  };
  const setField = <K extends keyof SyllabusAiDraft>(key: K, value: SyllabusAiDraft[K]) => {
    edit((prev) => ({ ...prev, [key]: value }));
  };
  const editSection = (si: number, fn: (s: SyllabusAiSection) => SyllabusAiSection) =>
    edit((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === si ? fn(s) : s) }));
  const editTopic = (si: number, ti: number, fn: (t: SyllabusAiTopic) => SyllabusAiTopic) =>
    editSection(si, (s) => ({ ...s, topics: s.topics.map((t, i) => i === ti ? fn(t) : t) }));

  async function generate() {
    if (generating || saving) return;
    if (prompt.trim().length < 3) {
      toast.error("Describe the subject you want to create a Syllabus about."); return;
    }
    if (draft && (modified || needsRegeneration) && !window.confirm("Regenerate and replace the current preview? Unsaved edits will be lost.")) return;
    setGenerating(true);
    try {
      const result = await syllabusAiApi.quickGenerate({ prompt: prompt.trim() });
      setDraft(normalize(result));
      setModified(false);
      setNeedsRegeneration(false);
      toast.success("AI Syllabus preview created. Review and edit before saving.");
    } catch (e) { toast.error(errorText(e)); }
    finally { setGenerating(false); }
  }

  const removeClo = (index: number) => edit((prev) => ({
    ...prev,
    clos: prev.clos.filter((_, i) => i !== index),
    sections: prev.sections.map((section) => ({
      ...section,
      topics: section.topics.map((topic) => ({
        ...topic,
        cloNumbers: topic.cloNumbers.filter((n) => n !== index + 1).map((n) => n > index + 1 ? n - 1 : n),
      })),
    })),
  }));
  const removeSection = (si: number) => edit((prev) => ({
    ...prev,
    sections: prev.sections.filter((_, i) => i !== si),
  }));
  const removeTopic = (si: number, ti: number) => edit((prev) => ({
    ...prev,
    sections: prev.sections.map((s, i) => i !== si ? s : { ...s, topics: s.topics.filter((_, j) => j !== ti) }),
  }));

  async function save() {
    if (!draft || saving || generating || !canSave) return;
    if (draft.clos.length < 2 || draft.sections.length < 1 || draft.sections.some((s) => s.topics.length < 1)) {
      toast.error("Keep at least 2 CLOs and one Topic in every Section."); return;
    }
    if (draft.sections.some((s) => s.topics.some((t) => !t.cloNumbers.length))) {
      toast.error("Map every Topic to at least one CLO."); return;
    }
    setSaving(true);
    try {
      const result = await syllabusAiApi.save(draft);
      await queryClient.invalidateQueries({ queryKey: ["syllabuses"] });
      toast.success("Syllabus Draft created. Review its academic content before publishing.");
      navigate(`/syllabuses/${result.id}`);
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  }

  return <div className="flex flex-col gap-4 pb-6 font-inter">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Sparkles className="size-5" /> AI Syllabus Generator</h1>
        <p className="text-sm text-muted-foreground">Describe a subject in one sentence. AI will design the Sections, Topics and CLOs; review the English preview before saving a Draft.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => {
        if (draft && modified && !window.confirm("Leave the AI Generator? Your unsaved preview will be lost.")) return;
        onClose();
      }}><ArrowLeft className="size-4"/> Back to Templates</Button>
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(290px,0.85fr)_minmax(0,1.5fr)]">
      <section className="min-w-0 rounded-lg border bg-card p-4 xl:sticky xl:top-4" aria-label="AI input settings">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-semibold">1. Describe your Syllabus</h2>
          <Badge variant="outline">One prompt</Badge>
        </div>
        {status.isPending ? <p className="mb-3 text-xs text-muted-foreground">Checking AI service availability...</p>
          : status.isError ? <p className="mb-3 text-xs text-destructive">Unable to check AI service availability. Please try again or contact your administrator.</p>
          : !status.data?.configured ? <p className="mb-3 rounded-md border p-2 text-xs text-destructive">AI-assisted generation is currently unavailable. Please contact your system administrator to enable this service.</p>
          : <p className="mb-3 text-xs text-muted-foreground">AI-assisted generation is available. All generated Syllabus content is standardized in English.</p>}
        <label htmlFor="syllabus-quick-prompt" className="block text-sm font-medium">What Syllabus would you like to create?</label>
        <Textarea id="syllabus-quick-prompt" autoFocus rows={5} maxLength={2000}
          value={prompt} onChange={(e) => changePrompt(e.target.value)}
          placeholder={'Tạo Syllabus về SQL\nTạo Syllabus làm game với Unity\nCreate a beginner Python programming syllabus'}
          className="mt-2 min-h-32 resize-y text-sm" disabled={generating || saving}/>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground">
          <span>AI chooses the number of Sections, different Topics per Section and CLOs automatically.</span>
          <span>{prompt.length}/2000</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">No code, name or counts needed. AI proposes an editable code and title.</p>
        <Button className="mt-4 w-full" disabled={generating || saving || !status.data?.configured} onClick={() => void generate()}>
          {generating ? <Loader2 className="size-4 animate-spin" /> : draft ? <RotateCcw className="size-4" /> : <Sparkles className="size-4" />}
          {generating ? "Generating..." : draft ? "Regenerate Preview" : "Generate Syllabus Preview"}
        </Button>
        {needsRegeneration && <p className="mt-2 text-xs text-muted-foreground">Your request changed. Regenerate to update the preview; existing edits remain until you confirm.</p>}
      </section>

      <section className="min-w-0 rounded-lg border bg-card p-4" aria-label="Syllabus preview">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">2. Editable Syllabus Preview</h2>
          <div className="flex items-center gap-2"><Badge variant="outline">English content</Badge><Badge variant="outline">{draft ? "Unsaved Draft" : "Not generated"}</Badge></div>
        </div>
        {draft && <p className="mb-3 text-xs text-muted-foreground">AI proposed {draft.sections.length} Sections · {draft.sections.reduce((n, s) => n + s.topics.length, 0)} Topics (varies by Section) · {draft.clos.length} CLOs. All fields below remain editable.</p>}
        {!draft ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <BookOpen className="size-9" />
          <p>Enter a subject on the left, then let AI propose a complete Syllabus outline.</p>
          <p className="text-xs">AI generation never saves or publishes anything automatically.</p>
        </div> : <div className="flex flex-col gap-5">
          <fieldset disabled={saving || generating} className="flex flex-col gap-5 disabled:opacity-70">
            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">General Information</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Code *" value={draft.code} onChange={(v) => setField("code", v.toUpperCase())} maxLength={30} />
                <TextField label="Name *" value={draft.name} onChange={(v) => setField("name", v)} maxLength={150} />
                <DegreeLevelField id="ai-preview-degree-level" label="Degree Level" value={draft.degreeLevel} onChange={(v) => setField("degreeLevel", v)} />
                <TextField label="Teaching Methods" value={draft.teachingMethods} onChange={(v) => setField("teachingMethods", v)} maxLength={500} />
                <TextField label="Time Allocation" value={draft.timeAllocation} onChange={(v) => setField("timeAllocation", v)} maxLength={500} />
                <TextField label="Required Tools" value={draft.requiredTools} onChange={(v) => setField("requiredTools", v)} maxLength={1500} />
              </div>
              <LongField label="Description" value={draft.description} onChange={(v) => setField("description", v)} maxLength={1500} rows={3}/>
              <LongField label="Student Responsibilities" value={draft.studentResponsibilities} onChange={(v) => setField("studentResponsibilities", v)} maxLength={2000}/>
              <label className="flex max-w-36 flex-col gap-1 text-xs font-medium">Scoring scale (1–100)
                <Input type="number" min={1} max={100} value={draft.scoringScale ?? ""}
                  onChange={(e) => setField("scoringScale", e.target.value === "" ? null : Number(e.target.value))}/>
              </label>
            </section>
            <section className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Course Learning Outcomes (CLO)</h3>
                <Button size="sm" variant="outline" disabled={draft.clos.length >= 10}
                  onClick={() => edit((p) => ({ ...p, clos: [...p.clos, ""] }))}><Plus className="size-4"/> CLO</Button></div>
              {draft.clos.map((clo, ci) => <div key={ci} className="flex items-start gap-2">
                <span className="w-12 shrink-0 pt-2 text-xs font-semibold">CLO{ci + 1}</span>
                <Textarea className="min-h-16 text-sm" maxLength={2000} value={clo}
                  onChange={(e) => edit((p) => ({ ...p, clos: p.clos.map((c, i) => i === ci ? e.target.value : c) }))} />
                <Button size="icon-sm" variant="ghost" title="Remove CLO" disabled={draft.clos.length <= 2}
                  onClick={() => removeClo(ci)}><Trash2 className="size-4"/></Button>
              </div>)}
            </section>
            <section className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Sections &amp; Topics</h3>
                <Button size="sm" variant="outline" disabled={draft.sections.length >= 8}
                  onClick={() => edit((p) => ({ ...p, sections: [...p.sections, { title: "", mission: "", topics: [{ title: "", cloNumbers: [1] }] }] }))}>
                  <Plus className="size-4"/> Section</Button></div>
              {draft.sections.map((section, si) => <article key={si} className="min-w-0 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Section {si + 1}</Badge>
                  <div className="min-w-[140px] flex-1"><Input className="h-9 text-sm font-medium" maxLength={150}
                    aria-label={`Section ${si + 1} title`} value={section.title}
                    onChange={(e) => editSection(si, (s) => ({ ...s, title: e.target.value }))}/></div>
                  <Button size="icon-sm" variant="ghost" title="Remove Section" disabled={draft.sections.length <= 1}
                    onClick={() => removeSection(si)}><Trash2 className="size-4"/></Button></div>
                <div className="mt-3"><LongField label="Section Mission" value={section.mission}
                  onChange={(v) => editSection(si, (s) => ({ ...s, mission: v }))} maxLength={2000}/></div>
                <div className="mt-3 flex flex-col gap-2">
                  {section.topics.map((topic, ti) => <div key={ti} className="rounded-md bg-muted/40 p-3">
                    <div className="flex items-center gap-2"><span className="shrink-0 text-xs text-muted-foreground">Topic {ti + 1}</span>
                      <Input className="h-8 min-w-0 flex-1 text-sm" value={topic.title} maxLength={200}
                        aria-label={`Section ${si + 1} topic ${ti + 1}`}
                        onChange={(e) => editTopic(si, ti, (t) => ({ ...t, title: e.target.value }))}/>
                      <Button size="icon-sm" variant="ghost" disabled={section.topics.length <= 1}
                        title="Remove Topic" onClick={() => removeTopic(si, ti)}><Trash2 className="size-4" /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-xs text-muted-foreground">CLO mapping:</span>
                      {draft.clos.map((_, ci) => <label key={ci} className="flex items-center gap-1 text-xs">
                        <input type="checkbox" className="accent-primary" checked={topic.cloNumbers.includes(ci + 1)}
                          onChange={(e) => editTopic(si, ti, (t) => ({ ...t,
                            cloNumbers: e.target.checked ? [...t.cloNumbers, ci + 1].sort((a, b) => a - b)
                              : t.cloNumbers.filter((n) => n !== ci + 1),
                          }))}/>
                        CLO{ci + 1}</label>)}
                    </div>
                  </div>)}
                  <Button size="sm" variant="outline" disabled={section.topics.length >= 8}
                    onClick={() => editSection(si, (s) => ({ ...s, topics: [...s.topics, { title: "", cloNumbers: [1] }] }))}>
                    <Plus className="size-4"/> Topic</Button>
                </div>
              </article>)}
            </section>
          </fieldset>
          {!canSave && <p className="text-xs text-destructive">Saving requires Syllabus Create and Update permissions.</p>}
          <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 p-3 shadow-sm">
            <p className="max-w-sm text-xs text-muted-foreground">Saving creates a new independent <strong>Draft</strong>. You can review and publish it later.</p>
            <Button disabled={saving || generating || !canSave} onClick={() => void save()}>
              {saving ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>}
              {saving ? "Saving Draft..." : "Save Reviewed Syllabus Draft"}
            </Button>
          </div>
        </div>}
      </section>
    </div>
  </div>;
}
