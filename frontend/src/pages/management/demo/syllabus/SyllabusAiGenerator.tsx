import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Check, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import {
  syllabusAiApi,
  type SyllabusAiDraft,
  type SyllabusAiGenerateRequest,
  type SyllabusAiMaterial,
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

const materials: SyllabusAiMaterial["type"][] = ["BOOK", "DOCUMENT", "SLIDE", "VIDEO", "LINK"];

const defaultConfig: SyllabusAiGenerateRequest = {
  code: "", name: "", focus: "", degreeLevel: "Undergraduate", language: "English",
  sectionCount: 4, topicsPerSection: 3, cloCount: 4, notes: "",
};

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
  materials: (draft.materials ?? []).map((m) => ({
    ...m, url: m.url ?? "", author: m.author ?? "", publisher: m.publisher ?? "",
    note: m.note ?? "", include: false, mainMaterial: false,
    sectionIndex: null, topicIndex: null,
  })),
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

function TeachingLanguageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
    <label htmlFor="ai-teaching-language">Teaching language</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="ai-teaching-language" className="h-9 w-full text-sm"><SelectValue placeholder="Choose teaching language" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="English">English (ENG)</SelectItem>
        <SelectItem value="Vietnamese">Vietnamese (VN)</SelectItem>
      </SelectContent>
    </Select>
    <p className="font-normal text-muted-foreground">Teaching language is instructional context. The generated Syllabus will always be written in English.</p>
  </div>;
}

export default function SyllabusAiGenerator({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canSave = hasPermission("SYLLABUS_CREATE") && hasPermission("SYLLABUS_UPDATE");
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<SyllabusAiGenerateRequest>(defaultConfig);
  const [draft, setDraft] = useState<SyllabusAiDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const status = useQuery({ queryKey: ["syllabus-ai-status"], queryFn: syllabusAiApi.status, retry: false });

  const setPrompt = <K extends keyof SyllabusAiGenerateRequest>(key: K, value: SyllabusAiGenerateRequest[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (key === "code" || key === "name" || key === "degreeLevel") {
      setDraft((prev) => prev ? { ...prev, [key]: value } : null);
    } else if (draft) {
      setNeedsRegeneration(true);
    }
  };
  const edit = (fn: (previous: SyllabusAiDraft) => SyllabusAiDraft) => {
    setDraft((prev) => prev ? fn(prev) : prev);
    setModified(true);
  };
  const setField = <K extends keyof SyllabusAiDraft>(key: K, value: SyllabusAiDraft[K]) => {
    edit((prev) => ({ ...prev, [key]: value }));
    if (key === "code" || key === "name" || key === "degreeLevel") {
      setConfig((prev) => ({ ...prev, [key]: value as string }));
    }
  };
  const editSection = (si: number, fn: (s: SyllabusAiSection) => SyllabusAiSection) =>
    edit((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === si ? fn(s) : s) }));
  const editTopic = (si: number, ti: number, fn: (t: SyllabusAiTopic) => SyllabusAiTopic) =>
    editSection(si, (s) => ({ ...s, topics: s.topics.map((t, i) => i === ti ? fn(t) : t) }));
  const editMaterial = (mi: number, fn: (m: SyllabusAiMaterial) => SyllabusAiMaterial) =>
    edit((prev) => ({ ...prev, materials: prev.materials.map((m, i) => i === mi ? fn(m) : m) }));

  async function generate() {
    if (generating || saving) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/.test(config.code.trim())) {
      toast.error("Enter a Syllabus code (3–30 characters, letters/numbers/_/-)."); return;
    }
    if (config.name.trim().length < 3) { toast.error("Enter a Syllabus name."); return; }
    if (draft && (modified || needsRegeneration) && !window.confirm("Regenerate and replace the current preview? Unsaved edits will be lost.")) return;
    setGenerating(true);
    try {
      const result = await syllabusAiApi.generate({ ...config, code: config.code.trim().toUpperCase(), name: config.name.trim() });
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
    materials: prev.materials.map((m) => m.sectionIndex === si
      ? { ...m, include: false, sectionIndex: null, topicIndex: null }
      : m.sectionIndex != null && m.sectionIndex > si ? { ...m, sectionIndex: m.sectionIndex - 1 } : m),
  }));
  const removeTopic = (si: number, ti: number) => edit((prev) => ({
    ...prev,
    sections: prev.sections.map((s, i) => i !== si ? s : { ...s, topics: s.topics.filter((_, j) => j !== ti) }),
    materials: prev.materials.map((m) => m.sectionIndex !== si || m.topicIndex == null ? m
      : m.topicIndex === ti ? { ...m, include: false, sectionIndex: null, topicIndex: null }
      : m.topicIndex > ti ? { ...m, topicIndex: m.topicIndex - 1 } : m),
  }));

  async function save() {
    if (!draft || saving || generating || !canSave) return;
    if (draft.clos.length < 2 || draft.sections.length < 1 || draft.sections.some((s) => s.topics.length < 1)) {
      toast.error("Keep at least 2 CLOs and one Topic in every Section."); return;
    }
    if (draft.sections.some((s) => s.topics.some((t) => !t.cloNumbers.length))) {
      toast.error("Map every Topic to at least one CLO."); return;
    }
    if (draft.materials.some((m) => m.include && !/^https?:\/\/[^\s]+/i.test(m.url.trim()))) {
      toast.error("Selected Learning Materials require a valid HTTP(S) URL."); return;
    }
    setSaving(true);
    try {
      const result = await syllabusAiApi.save(draft);
      await queryClient.invalidateQueries({ queryKey: ["syllabuses"] });
      toast.success(`Syllabus Draft created. ${result.savedMaterialCount} reviewed materials saved.`);
      navigate(`/syllabuses/${result.id}`);
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  }

  return <div className="flex flex-col gap-4 pb-6 font-inter">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Sparkles className="size-5" /> AI Syllabus Generator</h1>
        <p className="text-sm text-muted-foreground">Enter instructions in Vietnamese or English. Review the English-language Syllabus preview before saving as Draft.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => {
        if (draft && modified && !window.confirm("Leave the AI Generator? Your unsaved preview will be lost.")) return;
        onClose();
      }}><ArrowLeft className="size-4"/> Back to Templates</Button>
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(290px,0.85fr)_minmax(0,1.5fr)]">
      <section className="min-w-0 rounded-lg border bg-card p-4 xl:sticky xl:top-4" aria-label="AI input settings">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-semibold">1. AI Configuration</h2>
          <Badge variant="outline">Input</Badge>
        </div>
        {status.isPending ? <p className="mb-3 text-xs text-muted-foreground">Checking AI service availability...</p>
          : status.isError ? <p className="mb-3 text-xs text-destructive">Unable to check AI service availability. Please try again or contact your administrator.</p>
          : !status.data?.configured ? <p className="mb-3 rounded-md border p-2 text-xs text-destructive">AI-assisted generation is currently unavailable. Please contact your system administrator to enable this service.</p>
          : <p className="mb-3 text-xs text-muted-foreground">AI-assisted generation is available. All generated Syllabus content is standardized in English.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <TextField label="Syllabus code *" value={config.code} onChange={(v) => setPrompt("code", v.toUpperCase())} maxLength={30} placeholder="HSF302" />
          <TextField label="Syllabus name *" value={config.name} onChange={(v) => setPrompt("name", v)} maxLength={150} placeholder="Working with Spring Framework" />
          <DegreeLevelField id="ai-degree-level" label="Degree level" value={config.degreeLevel} onChange={(v) => setPrompt("degreeLevel", v)} />
          <TeachingLanguageField value={config.language} onChange={(v) => setPrompt("language", v)} />
          <LongField label="Main teaching focus" value={config.focus} onChange={(v) => setPrompt("focus", v)} maxLength={1000} />
          <div className="grid grid-cols-3 gap-2">
            {(["sectionCount", "topicsPerSection", "cloCount"] as const).map((key) => <label key={key} className="flex flex-col gap-1 text-xs font-medium">
              {key === "sectionCount" ? "Sections" : key === "topicsPerSection" ? "Topics/Section" : "CLOs"}
              <Input type="number" className="h-9" min={key === "cloCount" || key === "sectionCount" ? 2 : 1}
                max={key === "cloCount" ? 10 : 8} value={config[key]}
                onChange={(e) => setPrompt(key, Number(e.target.value))} />
            </label>)}
          </div>
          <LongField label="Additional requirements" value={config.notes} onChange={(v) => setPrompt("notes", v)} maxLength={2000} rows={3} />
        </div>
        <Button className="mt-4 w-full" disabled={generating || saving || !status.data?.configured} onClick={() => void generate()}>
          {generating ? <Loader2 className="size-4 animate-spin" /> : draft ? <RotateCcw className="size-4" /> : <Sparkles className="size-4" />}
          {generating ? "Generating..." : draft ? "Regenerate Preview" : "Generate Syllabus Preview"}
        </Button>
        {needsRegeneration && <p className="mt-2 text-xs text-amber-600">Prompt settings changed. Regenerate to apply them to the AI outline; your current preview remains intact.</p>}
      </section>

      <section className="min-w-0 rounded-lg border bg-card p-4" aria-label="Syllabus preview">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">2. Editable Syllabus Preview</h2>
          <div className="flex items-center gap-2"><Badge variant="outline">English content</Badge><Badge variant="outline">{draft ? "Unsaved Draft" : "Not generated"}</Badge></div>
        </div>
        {!draft ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <BookOpen className="size-9" />
          <p>Enter your requirements on the left, then generate a full Syllabus blueprint.</p>
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
            <section className="flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Learning Materials — AI Suggestions</h3>
                <Button size="sm" variant="outline" disabled={draft.materials.length >= 12}
                  onClick={() => edit((p) => ({ ...p, materials: [...p.materials, {
                    title: "", type: "LINK", url: "", author: "", publisher: "", mainMaterial: false,
                    note: "", sectionIndex: null, topicIndex: null, include: false,
                  }] }))}><Plus className="size-4"/> Material</Button></div>
              <p className="text-xs text-muted-foreground">AI material titles are suggestions, not verified references. To save a material, select it and provide a real HTTP(S) URL. Unselected suggestions are not stored.</p>
              {draft.materials.map((material, mi) => <article key={mi} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={material.include}
                    onChange={(e) => editMaterial(mi, (m) => ({ ...m, include: e.target.checked }))}/>
                    Save this reviewed material</label>
                  <Button size="icon-sm" variant="ghost" title="Remove Material"
                    onClick={() => edit((p) => ({ ...p, materials: p.materials.filter((_, i) => i !== mi) }))}>
                    <Trash2 className="size-4" /></Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextField label="Title" value={material.title} maxLength={200}
                    onChange={(v) => editMaterial(mi, (m) => ({ ...m, title: v }))} />
                  <label className="flex flex-col gap-1 text-xs font-medium">Type
                    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={material.type}
                      onChange={(e) => editMaterial(mi, (m) => ({ ...m, type: e.target.value as SyllabusAiMaterial["type"] }))}>
                      {materials.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <TextField label="Author (optional)" value={material.author} maxLength={150}
                    onChange={(v) => editMaterial(mi, (m) => ({ ...m, author: v }))}/>
                  <TextField label="Publisher (optional)" value={material.publisher} maxLength={150}
                    onChange={(v) => editMaterial(mi, (m) => ({ ...m, publisher: v }))}/>
                  <label className="flex flex-col gap-1 text-xs font-medium">Link to Topic (optional)
                    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={material.sectionIndex == null ? "general" : `${material.sectionIndex}:${material.topicIndex}`}
                      onChange={(e) => editMaterial(mi, (m) => {
                        const [si, ti] = e.target.value.split(":").map(Number);
                        return e.target.value === "general" ? { ...m, sectionIndex: null, topicIndex: null }
                          : { ...m, sectionIndex: si, topicIndex: ti };
                      })}>
                      <option value="general">General Learning Materials</option>
                      {draft.sections.flatMap((s, si) => s.topics.map((t, ti) =>
                        <option key={`${si}:${ti}`} value={`${si}:${ti}`}>{si + 1}.{ti + 1} {t.title}</option>))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-xs"><input type="checkbox" checked={material.mainMaterial}
                    onChange={(e) => editMaterial(mi, (m) => ({ ...m, mainMaterial: e.target.checked }))}/> Main material</label>
                </div>
                <div className="mt-2"><TextField label={material.include ? "Verified URL *" : "URL (required only when saving)"}
                  value={material.url} maxLength={2048} placeholder="https://..."
                  onChange={(v) => editMaterial(mi, (m) => ({ ...m, url: v }))}/></div>
                <div className="mt-2"><LongField label="Notes / source verification" value={material.note}
                  maxLength={1000} onChange={(v) => editMaterial(mi, (m) => ({ ...m, note: v }))}/></div>
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
