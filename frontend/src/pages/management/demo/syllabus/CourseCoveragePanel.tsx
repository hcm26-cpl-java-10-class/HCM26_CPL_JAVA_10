import { useState } from "react";
import { AlertCircle, CheckCircle2, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CourseDisclosureChevron from "./CourseDisclosureChevron";
import { Button } from "@/components/ui/button";
import type { CourseSyllabusPreview } from "@/api/features/demo/course.api";
import { compareCourseToSyllabus, type CoverageSection } from "./courseCoverage";

type Props = { source: CourseSyllabusPreview; selectedIds: number[]; draft: CoverageSection[]; focused: boolean };
export default function CourseCoveragePanel({ source, selectedIds, draft, focused }: Props) {
  const [open, setOpen] = useState(false);
  const result = compareCourseToSyllabus(source, selectedIds, draft);
  return <section aria-label="Compare Course with Syllabus" className="rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">Syllabus ↔ Course comparison</h3>
        <p className="mt-1 text-xs text-muted-foreground">{focused ? "Focused scope (not full Syllabus)" : "Full Syllabus"} · {result.coveredCount}/{result.requiredCount} Topics covered · {result.missingMaterials.length} Lessons to configure · {result.extra.length} extra Lessons · {result.extraSections.length} added/renamed Sections</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(v => !v)}>{open ? "Hide details" : "Compare"}<CourseDisclosureChevron open={open} /></Button>
    </div>
    {open && <div className="mt-3 space-y-3 border-t pt-3 text-xs">
      <p className="text-muted-foreground">Green = covered; amber = additional Course content; red = missing source content or Material.</p>
      {result.rows.map(row => <div className="flex items-start gap-2" key={row.topicId}>
        {row.covered ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600"/> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive"/>}
        <div className="min-w-0"><p className="break-words font-medium">{row.topic}</p><p className="break-words text-muted-foreground">{row.lessons.length ? row.lessons.join(" · ") : "Missing: no linked Lesson"}</p></div>
      </div>)}
      {result.extraSections.length > 0 && <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
        <p className="font-semibold text-amber-800 dark:text-amber-300">Additional or renamed Sections</p>
        {result.extraSections.map((title, i) => <p className="break-words text-amber-800 dark:text-amber-300" key={i}>+ {title}</p>)}
      </div>}
      {result.extra.length > 0 && <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400"><PlusCircle className="mr-1 size-3"/> Additional Course lessons</Badge>
        {result.extra.map((item, i) => <p className="break-words text-amber-800 dark:text-amber-300" key={i}>+ {item.lesson} ({item.section})</p>)}
      </div>}
      {result.missingMaterials.length > 0 && <div role="alert" className="rounded-md border border-destructive/40 p-2 text-destructive">
        <p className="font-semibold">Lesson content to complete</p>
        {result.missingMaterials.map((item, i) => <p key={i} className="break-words">{item.section} → {item.lesson}</p>)}
      </div>}
    </div>}
  </section>;
}
