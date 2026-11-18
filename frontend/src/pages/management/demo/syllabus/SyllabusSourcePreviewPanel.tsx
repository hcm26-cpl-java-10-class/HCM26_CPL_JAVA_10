import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileText, FolderOpen, GraduationCap, LibraryBig, LockKeyhole, Target, ListChecks } from "lucide-react";

import { syllabusApi } from "@/api/features/demo/syllabus.api";
import type { CourseSyllabusPreview } from "@/api/features/demo/course.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CourseScopeMode } from "./courseFromSyllabusScope";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Props = {
  source: CourseSyllabusPreview;
  syllabusId: number;
  scopeMode: CourseScopeMode;
  onScopeModeChange: (mode: CourseScopeMode) => void;
  selectedTopicIds: number[];
  onToggleTopic: (topicId: number, selected: boolean) => void;
  onToggleSection: (topicIds: number[], selected: boolean) => void;
  selectedCount: number;
  scopePending: boolean;
  onApplyScope: () => void;
  selectionDisabled?: boolean;
};

export default function SyllabusSourcePreviewPanel({
  source, syllabusId, scopeMode, onScopeModeChange, selectedTopicIds,
  onToggleTopic, onToggleSection, selectedCount, scopePending,
  onApplyScope, selectionDisabled = false,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [showClos, setShowClos] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [openSections, setOpenSections] = useState<number[]>([]);
  const infoQuery = useQuery({ queryKey: ["syllabus-information", syllabusId], queryFn: () => syllabusApi.getInformation(syllabusId) });
  const progressQuery = useQuery({ queryKey: ["syllabus-progress", syllabusId], queryFn: () => syllabusApi.progress(syllabusId) });
  const closQuery = useQuery({ queryKey: ["syllabus-clos", syllabusId], queryFn: () => syllabusApi.listClos(syllabusId) });
  const materialsQuery = useQuery({ queryKey: ["syllabus-materials", syllabusId], queryFn: () => syllabusApi.listMaterials(syllabusId) });
  const coverageQuery = useQuery({ queryKey: ["syllabus-coverage", syllabusId], queryFn: () => syllabusApi.coverage(syllabusId) });

  useEffect(() => { setOpenSections(source.sections.length ? [source.sections[0].id] : []); }, [source.syllabusId]);
  const info = infoQuery.data;
  const clos = closQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const topicCoverage = useMemo(() => new Map((coverageQuery.data?.topics ?? []).map((t) => [t.id, t.cloIds])), [coverageQuery.data]);
  const codeById = useMemo(() => new Map(clos.map((clo) => [clo.id, clo.code])), [clos]);
  const shared = materials.filter((material) => material.topicId == null);
  const topicCount = source.sections.reduce((sum, section) => sum + section.topics.length, 0);
  const selected = new Set(selectedTopicIds);

  return (
    <section className="min-w-0 rounded-xl border bg-card p-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" aria-label="Published Syllabus source">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold"><BookOpen className="size-4" /> Syllabus Source</h2>
        <Badge variant="outline" className="shrink-0 gap-1"><LockKeyhole className="size-3" /> Read-only</Badge>
      </div>
      <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-1.5"><Badge>Published</Badge><Badge variant="outline">{source.syllabusCode}</Badge></div>
        <h3 className="text-lg font-semibold leading-tight break-words">{source.syllabusName}</h3>
        {source.syllabusDescription && <p className="text-sm leading-relaxed text-muted-foreground">{source.syllabusDescription}</p>}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-xs sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {[ ["Sections", source.sections.length], ["Topics", topicCount], ["CLOs", closQuery.isPending ? "…" : clos.length], ["Materials", materialsQuery.isPending ? "…" : materials.length] ].map(([label, value]) =>
            <div key={label} className="flex flex-col gap-1"><span className="text-muted-foreground">{label}</span><span className="text-base font-semibold">{value}</span></div>)}
        </div>
      </div>

      <Collapsible open={showDetails} onOpenChange={setShowDetails} className="mt-3 rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-semibold hover:bg-muted/40">
          <span className="flex items-center gap-2"><GraduationCap className="size-4" /> General Information</span>
          {showDetails ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </CollapsibleTrigger>
        <div className="border-t px-3 py-2 text-xs"><span className="text-muted-foreground">Degree Level: </span>{info?.degreeLevel || (infoQuery.isPending ? "Loading…" : "Not provided")}</div>
        <CollapsibleContent className="space-y-2 border-t px-3 py-3 text-sm">
          {infoQuery.isError ? <p className="text-destructive">Could not load General Information.</p> : [
            ["Teaching Methods", info?.teachingMethods], ["Time Allocation", info?.timeAllocation],
            ["Student Responsibilities", info?.studentResponsibilities], ["Required Tools", info?.requiredTools],
            ["Scoring Scale", info?.scoringScale?.toString()],
          ].map(([label, value]) => <div key={label} className="space-y-1"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><p className="break-words">{value || "Not provided"}</p></div>)}
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-3 rounded-lg border p-3" aria-label="Completion Progress">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span>Completion Progress</span>
          <Badge variant="outline">{progressQuery.data ? `${progressQuery.data.completionPercent}%` : progressQuery.isPending ? "Loading..." : "Unavailable"}</Badge>
        </div>
        {progressQuery.data && <p className="mt-1 text-xs text-muted-foreground">{progressQuery.data.checks.filter((check) => check.complete).length}/{progressQuery.data.checks.length} completion checks met. The Course must use a Published and Active source.</p>}
        {progressQuery.isError && <p className="mt-1 text-xs text-muted-foreground">Could not load completion details.</p>}
      </div>

      <Collapsible open={showClos} onOpenChange={setShowClos} className="mt-3 rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/40">
          <span className="flex items-center gap-2"><Target className="size-4"/> Course Learning Outcomes <Badge variant="outline">{clos.length}</Badge></span>
          {showClos ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 border-t p-3">
          {closQuery.isError ? <p className="text-xs text-destructive">Could not load CLOs.</p> : clos.length ? clos.map((clo) =>
            <div key={clo.id} className="flex gap-2 text-xs"><Badge variant="outline" className="h-fit shrink-0">{clo.code}</Badge><span className="break-words leading-relaxed">{clo.details}</span></div>) : <p className="text-xs text-muted-foreground">No CLOs available.</p>}
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-4 rounded-lg border p-3" aria-label="Select Course source scope">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4" /> Course source scope</h3>
        <p className="mt-1 text-xs text-muted-foreground">Use the whole Published outline or choose the Topics for a focused Course. The original Syllabus stays unchanged.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant={scopeMode === "FULL" ? "default" : "outline"} disabled={selectionDisabled} onClick={() => onScopeModeChange("FULL")}>Full Syllabus</Button>
          <Button type="button" size="sm" variant={scopeMode === "FOCUSED" ? "default" : "outline"} disabled={selectionDisabled} onClick={() => onScopeModeChange("FOCUSED")}>Focused Course</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{selectedCount} of {topicCount} Topics included{scopeMode === "FULL" ? " (all)" : ""}.</p>
        {scopeMode === "FOCUSED" && <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={selectionDisabled} onClick={() => source.sections.forEach((section) => onToggleSection(section.topics.map((t) => t.id), true))}>Select all</Button>
          <Button type="button" size="sm" variant="ghost" disabled={selectionDisabled} onClick={() => source.sections.forEach((section) => onToggleSection(section.topics.map((t) => t.id), false))}>Clear all</Button>
        </div>}
        {scopePending ? <Button type="button" className="mt-3 w-full" disabled={selectionDisabled || selectedCount === 0} onClick={onApplyScope}>Apply selection to Course Preview</Button> :
          <p className="mt-2 flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="size-3.5" /> Course Preview matches the applied scope.</p>}
        {scopePending && <p className="mt-2 text-xs text-muted-foreground">Only applying will rebuild Course Sections/Lessons. Existing manual edits are protected until you confirm.</p>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen className="size-4" /> Learning Plan / Sections &amp; Topics</h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpenSections(source.sections.map(s => s.id))}>Expand</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpenSections([])}>Collapse</Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Sections, missions, topics and related learning resources.</p>
      <div className="space-y-2">
        {source.sections.map((section, sectionIndex) => {
          const opened = openSections.includes(section.id);
          return (
            <Collapsible key={section.id} open={opened} onOpenChange={(value) => setOpenSections((p) => value ? [...p, section.id] : p.filter(id => id !== section.id))} className="overflow-hidden rounded-lg border">
              <div className="flex min-w-0 items-center gap-2 bg-muted/30 pl-3">
                {scopeMode === "FOCUSED" && section.topics.length > 0 && <Checkbox
                  aria-label={`Include all Topics in ${section.title}`}
                  checked={section.topics.every((t) => selected.has(t.id)) ? true : section.topics.some((t) => selected.has(t.id)) ? "indeterminate" : false}
                  disabled={selectionDisabled}
                  onCheckedChange={(value) => onToggleSection(section.topics.map((t) => t.id), value === true)}
                />}
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-between gap-2 px-1 py-3 text-left text-sm font-semibold hover:bg-muted/50">
                  <span className="flex min-w-0 items-start gap-2"><FolderOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground"/><span className="break-words">Section {sectionIndex + 1}: {section.title}</span></span>
                  <span className="flex shrink-0 items-center gap-2"><Badge variant="outline">{section.topics.length} topics</Badge>{opened ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}</span>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="p-3">
                {section.mission && <div className="mb-3 rounded-md bg-muted/30 p-2 text-xs"><strong className="block pb-1 text-muted-foreground">MISSION</strong>{section.mission}</div>}
                <div className="space-y-2">
                  {section.topics.map((topic, topicIndex) => {
                    const cloCodes = (topicCoverage.get(topic.id) ?? []).map((id) => codeById.get(id)).filter(Boolean);
                    const linkedMaterials = materials.filter((m) => m.topicId === topic.id);
                    return <div key={topic.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-start gap-2 font-medium">
                        {scopeMode === "FOCUSED" ? <Checkbox
                          aria-label={`Include Topic ${topic.title}`}
                          checked={selected.has(topic.id)}
                          disabled={selectionDisabled}
                          onCheckedChange={(value) => onToggleTopic(topic.id, value === true)}
                        /> : <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"/>}
                        <span className="break-words">{topicIndex + 1}. {topic.title}</span>
                      </div>
                      {(cloCodes.length > 0 || linkedMaterials.length > 0) && <div className="mt-2 space-y-1 pl-5 text-muted-foreground">
                        {cloCodes.length > 0 && <div className="flex flex-wrap gap-1">{cloCodes.map((code) => <Badge key={code} variant="outline">{code}</Badge>)}</div>}
                        {linkedMaterials.map(m => <div key={m.id} className="break-words"><LibraryBig className="mr-1 inline size-3"/>{m.title} ({m.type})</div>)}
                      </div>}
                    </div>;
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <Collapsible open={showMaterials} onOpenChange={setShowMaterials} className="mt-3 rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/40">
          <span className="flex items-center gap-2"><LibraryBig className="size-4"/> General Learning Materials <Badge variant="outline">{shared.length}</Badge></span>
          {showMaterials ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 border-t p-3">
          {materialsQuery.isError ? <p className="text-xs text-destructive">Could not load Materials.</p> : shared.length ? shared.map((m) =>
            <div key={m.id} className="rounded-md border p-2 text-xs"><div className="flex flex-wrap gap-1"><Badge variant="outline">{m.type}</Badge>{m.mainMaterial && <Badge variant="outline">Main material</Badge>}</div><p className="mt-1 font-medium break-words">{m.title}</p>{m.note && <p className="mt-1 text-muted-foreground">{m.note}</p>}</div>) : <p className="text-xs text-muted-foreground">No shared Materials.</p>}
        </CollapsibleContent>
      </Collapsible>
      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0"/> Preview only. Creating or editing a Course never changes this Published Syllabus.</p>
    </section>
  );
}
