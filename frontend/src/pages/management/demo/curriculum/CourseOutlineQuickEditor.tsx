import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Check, FileText, FolderOpen, Pencil, X } from "lucide-react";
import { lessonApi } from "@/api/features/demo/lesson.api";
import { sectionApi } from "@/api/features/demo/section.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SectionDTO } from "@/types/features/demo/section";

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { errors?: Record<string, string[]>; message?: string } | undefined;
    const messages = payload?.errors && Object.values(payload.errors).flat();
    if (messages?.length) return messages.join("; ");
    if (error.response?.status === 403) return "Insufficient permission to edit this Course.";
    if (payload?.message) return payload.message;
  }
  return "Unable to save changes. Please try again.";
}

/** Small inline editor for courses generated from Syllabus. The full CRUD UI remains below. */
export default function CourseOutlineQuickEditor({ courseId, sections, onOpenAdvanced }: {
  courseId: number;
  sections: SectionDTO[];
  onOpenAdvanced: (sectionId: number) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEditSections = hasPermission("SECTION_UPDATE");
  const canEditLessons = hasPermission("LESSON_UPDATE");
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<null | { type: "section" | "lesson"; id: number }>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sections.length === 0) {
      setSelected(null);
      return;
    }
    if (!sections.some((s) => s.id === selected)) setSelected(sections[0].id ?? null);
  }, [sections, selected]);

  const lessonsQuery = useQuery({
    queryKey: ["lessons", selected],
    queryFn: () => lessonApi.getBySection(selected!),
    enabled: selected !== null,
  });
  const lessons = [...(lessonsQuery.data ?? [])].sort((a, b) =>
    (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  );
  const currentSection = sections.find((section) => section.id === selected);

  const startEdit = (type: "section" | "lesson", id: number, value: string) => {
    setEditing({ type, id });
    setTitle(value);
  };
  const save = async () => {
    if (!editing || saving) return;
    const normalized = title.trim().replace(/\s+/g, " ");
    if (!normalized || normalized.length > (editing.type === "section" ? 150 : 200)) {
      toast.error("Title is required and cannot exceed its length limit.");
      return;
    }
    if (editing.type === "section" && (normalized.length < 3 || !/\p{L}/u.test(normalized))) {
      toast.error("Section title must have at least 3 characters and contain letters.");
      return;
    }
    setSaving(true);
    try {
      if (editing.type === "section") {
        const target = sections.find((section) => section.id === editing.id);
        if (!target) return;
        await sectionApi.update(editing.id, {
          courseId, title: normalized, orderIndex: target.orderIndex,
        });
        await queryClient.invalidateQueries({ queryKey: ["sections", courseId] });
      } else {
        await lessonApi.update(String(editing.id), { title: normalized });
        await queryClient.invalidateQueries({ queryKey: ["lessons", selected] });
      }
      setEditing(null);
      toast.success("Title saved successfully.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const titleEditor = (type: "section" | "lesson", id: number, value: string) => {
    const active = editing?.type === type && editing.id === id;
    return active ? (
      <div className="flex min-w-[200px] items-center gap-1">
        <Input autoFocus value={title} maxLength={type === "section" ? 150 : 200} disabled={saving}
          aria-label={`Edit ${type} title`} onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape") setEditing(null); }}/>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => void save()} disabled={saving} aria-label="Save title"><Check className="size-4" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditing(null)} disabled={saving} aria-label="Cancel editing"><X className="size-4" /></Button>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <span className="break-words">{value}</span>
        {(type === "section" ? canEditSections : canEditLessons) && (
          <Button type="button" size="icon-xs" variant="ghost" aria-label={`Edit ${type} title`} disabled={saving}
            onClick={(event) => { event.stopPropagation(); startEdit(type, id, value); }}><Pencil className="size-3" /></Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">Quick Curriculum Editor</h2>
        <p className="text-sm text-muted-foreground">This Course was created from a Syllabus. Edit names in the two tables, then use the advanced Lesson editor for video, text and documents. Changes here only affect this Course.</p>
      </div>
      <section className="space-y-2" aria-label="Course Sections table">
        <h3 className="text-sm font-semibold">Table 1 — Sections</h3>
        <div className="rounded-md border">
          <Table className="min-w-[440px]">
            <TableHeader className="bg-muted/40"><TableRow><TableHead className="w-16">Order</TableHead><TableHead>Section name</TableHead><TableHead className="w-28">Select</TableHead></TableRow></TableHeader>
            <TableBody>
              {sections.map((section, index) => (
                <TableRow key={section.id} data-state={selected === section.id ? "selected" : undefined}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="whitespace-normal">{section.id != null && titleEditor("section", section.id, section.title)}</TableCell>
                  <TableCell><Button type="button" size="sm" variant={selected === section.id ? "secondary" : "outline"}
                    onClick={() => { setSelected(section.id ?? null); setEditing(null); }}>
                    <FolderOpen className="size-3.5" /> {selected === section.id ? "Selected" : "View"}
                  </Button></TableCell>
                </TableRow>
              ))}
              {!sections.length && <TableRow><TableCell className="py-4 text-muted-foreground" colSpan={3}>No Sections yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="space-y-2" aria-label="Course Lessons table">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Table 2 — Lessons {currentSection ? `in ${currentSection.title}` : ""}</h3>
          {currentSection?.id && <Button type="button" size="sm" variant="outline" onClick={() => onOpenAdvanced(currentSection.id!)}>
            <FileText className="size-3.5" /> Open full Lesson editor below
          </Button>}
        </div>
        <div className="rounded-md border">
          <Table className="min-w-[440px]">
            <TableHeader className="bg-muted/40"><TableRow><TableHead className="w-16">Order</TableHead><TableHead>Lesson name</TableHead><TableHead className="w-24">Type</TableHead></TableRow></TableHeader>
            <TableBody>
              {lessonsQuery.isLoading && <TableRow><TableCell colSpan={3} className="py-4 text-muted-foreground">Loading Lessons...</TableCell></TableRow>}
              {lessonsQuery.isError && <TableRow><TableCell colSpan={3} className="py-4 text-destructive">Could not load Lessons.</TableCell></TableRow>}
              {!lessonsQuery.isLoading && !lessonsQuery.isError && lessons.map((lesson, index) => (
                <TableRow key={lesson.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="whitespace-normal">{lesson.id != null && titleEditor("lesson", lesson.id, lesson.title ?? "")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{lesson.contentType ?? "TEXT"}</TableCell>
                </TableRow>
              ))}
              {selected !== null && !lessonsQuery.isLoading && !lessonsQuery.isError && !lessons.length && <TableRow><TableCell colSpan={3} className="py-4 text-muted-foreground">No Lessons in this Section.</TableCell></TableRow>}
              {selected === null && <TableRow><TableCell colSpan={3} className="py-4 text-muted-foreground">Select a Section first.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
