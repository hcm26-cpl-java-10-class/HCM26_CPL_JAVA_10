import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowUp, BookPlus, Check, CheckCircle2,
  ChevronDown, ChevronRight, Plus, RotateCcw, RefreshCw, Tag,
  Trash2, FileText, AlertCircle,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { courseApi, type CourseSyllabusPreview } from "@/api/features/demo/course.api";
import { syllabusExtrasApi } from "@/api/features/demo/syllabus-extras.api";
import { categoryApi } from "@/api/features/demo/category.api";
import { COURSE_LEVEL_OPTIONS, type CourseLevel } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import SyllabusSourcePreviewPanel from "./SyllabusSourcePreviewPanel";
import { flattenCategoryTree, recommendCategoryIds, recommendCourseLevel } from "./courseFromSyllabusSuggestions";
import { usePermissions } from "@/hooks/usePermissions";
import { readWorkspaceDraft, syncWorkspaceDraft, clearWorkspaceDraft } from "./SyllabusCourseWorkspaceDraft";
import { allSourceTopicIds, buildCourseOutline, scopeSignature, suggestFocusedCourseTitle, type CourseScopeMode } from "./courseFromSyllabusScope";

type DraftLesson = { key: string; title: string };
type DraftSection = { key: string; title: string; lessons: DraftLesson[] };

const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const titleKey = (value: string) => clean(value).toLocaleLowerCase("vi");

function makeDraft(source: CourseSyllabusPreview): DraftSection[] {
  return buildCourseOutline(source, "FULL", []);
}

function validateDraft(name: string, description: string, sections: DraftSection[]): string | null {
  if (!clean(name) || clean(name).length > 150) return "Course name must have 1–150 characters.";
  if (description.length > 500) return "Description must not exceed 500 characters.";
  if (sections.length === 0) return "Add at least one Section before creating the Course.";
  if (sections.length > 100) return "Course can contain at most 100 Sections.";
  const seen = new Set<string>();
  let totalLessons = 0;
  for (const section of sections) {
    const title = clean(section.title);
    if (title.length < 3 || title.length > 150 || !/\p{L}/u.test(title)) {
      return "Each Section title must contain letters and have 3–150 characters.";
    }
    if (seen.has(titleKey(title))) return `Duplicate Section name: ${title}`;
    seen.add(titleKey(title));
    if (section.lessons.length === 0) return `Add a Lesson to Section “${title}”.`;
    if (section.lessons.length > 200) return `Section “${title}” has more than 200 Lessons.`;
    totalLessons += section.lessons.length;
    for (const lesson of section.lessons) {
      if (!clean(lesson.title) || clean(lesson.title).length > 200) {
        return `Lesson titles must contain 1–200 characters (Section “${title}”).`;
      }
    }
  }
  if (totalLessons > 1000) return "Course can contain at most 1000 Lessons.";
  return null;
}

function backendError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { errors?: Record<string, string[]>; message?: string } | undefined;
    const items = data?.errors && Object.values(data.errors).flat();
    if (items?.length) return items.join("; ");
    if (error.response?.status === 403) return "You do not have sufficient permissions.";
    if (error.response?.status === 409) return "Course name already exists.";
    if (data?.message) return data.message;
    if (!error.response) return "Cannot connect to the Backend.";
  }
  return "Could not create the Course. Please check your input and try again.";
}

const iconButton = "rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

export default function CreateCourseFromSyllabusPage() {
  const { id } = useParams<{ id: string }>();
  const syllabusId = Number(id);
  const validId = Number.isSafeInteger(syllabusId) && syllabusId > 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const allowed = ["SYLLABUS_READ", "COURSE_CREATE", "SECTION_CREATE", "LESSON_CREATE"].every(hasPermission);
  const sequence = useRef(0);
  const initializedSyllabusId = useRef<number | null>(null);
  const nextKey = () => `new-${++sequence.current}`;

  const sourceQuery = useQuery({
    queryKey: ["course-from-syllabus-preview", syllabusId],
    queryFn: () => courseApi.getFromSyllabusPreview(syllabusId),
    enabled: validId && allowed,
    retry: false,
    refetchOnWindowFocus: false, // preserve unsaved inline edits when switching windows
  });
  const source = sourceQuery.data;
  // Existing Courses are advisory: multiple focused Courses may legitimately use one Syllabus.
  const existingCoursesQuery = useQuery({
    queryKey: ["syllabus-course-usage"],
    queryFn: () => syllabusExtrasApi.courseUsage(),
    enabled: validId && allowed && hasPermission("COURSE_READ"),
    retry: false,
  });
  const linkedCourses = existingCoursesQuery.data?.find((row) => row.syllabusId === syllabusId)?.courses ?? [];
  const nameTouchedRef = useRef(false);
  const categoryTouchedRef = useRef(false);
  const levelTouchedRef = useRef(false);
  const [nameStartAt, setNameStartAt] = useState(1);
  const suggestionQuery = useQuery({
    queryKey: ["syllabus-course-name-suggestion", syllabusId, nameStartAt],
    queryFn: () => courseApi.suggestFromSyllabusName(syllabusId, nameStartAt),
    enabled: validId && allowed && Boolean(source),
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["course-creation-category-tree", hasPermission("CATEGORY_READ") ? "all-active" : "catalog-fallback"],
    // /categories/tree?onlyActive=true prunes categories without published Courses.
    // The Course creation form must also offer unused active categories.
    queryFn: () => hasPermission("CATEGORY_READ") ? categoryApi.getTree(false) : courseApi.getCatalogCategories(),
    enabled: allowed && (hasPermission("CATEGORY_READ") || hasPermission("COURSE_READ")), retry: false,
  });
  const categoryOptions = useMemo(() => flattenCategoryTree(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const [courseLevel, setCourseLevel] = useState<CourseLevel>("BEGINNER");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [scopeMode, setScopeMode] = useState<CourseScopeMode>("FULL");
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [appliedScopeSignature, setAppliedScopeSignature] = useState("FULL");
  const [outlineEdited, setOutlineEdited] = useState(false);
  const currentScopeSignature = scopeSignature(scopeMode, selectedTopicIds);
  const scopePending = currentScopeSignature !== appliedScopeSignature;
  const sourceTopicCount = source ? allSourceTopicIds(source).length : 0;
  const selectedCount = scopeMode === "FULL" ? sourceTopicCount : selectedTopicIds.length;

  useEffect(() => {
    if (!source || initializedSyllabusId.current === source.syllabusId) return;
    initializedSyllabusId.current = source.syllabusId;
    const session = readWorkspaceDraft(source.syllabusId);
    const publishedSource = source.sections.map((section, orderIndex) => ({
      id: section.id, title: section.title, mission: section.mission, orderIndex,
      topics: section.topics.map((topic, topicOrder) => ({ id: topic.id, title: topic.title, orderIndex: topicOrder })),
    }));
    const restored = session ? syncWorkspaceDraft(session, publishedSource) : null;
    const initial: DraftSection[] = restored ? restored.sections.map((section) => ({
      key: section.key, title: section.title,
      lessons: section.lessons.map((lesson) => ({ key: lesson.key, title: lesson.title })),
    })) : makeDraft(source);
    nameTouchedRef.current = Boolean(restored?.nameCustomized);
    categoryTouchedRef.current = Boolean(restored?.categoryCustomized);
    levelTouchedRef.current = Boolean(restored?.levelCustomized);
    setNameStartAt(1);
    setScopeMode("FULL");
    setSelectedTopicIds(allSourceTopicIds(source));
    setAppliedScopeSignature("FULL");
    setOutlineEdited(Boolean(restored));
    setCourseName(restored?.name ?? `${source.syllabusName} - Course 01`.slice(0, 150));
    setCourseLevel(restored?.level ?? recommendCourseLevel(source.syllabusName, source.syllabusDescription).level);
    setCategoryIds(restored?.categoryIds ?? []);
    setDescription((restored?.description ?? source.syllabusDescription ?? "").slice(0, 500));
    setDraftSections(initial);
    setExpanded(initial.map((row) => row.key));
    setDirty(Boolean(restored));
    setShowValidation(false);
  }, [source]);

  useEffect(() => {
    // A delayed server name suggestion must never overwrite a focused title or manual edit.
    if (scopeMode === "FULL" && suggestionQuery.data && !nameTouchedRef.current) {
      setCourseName(suggestionQuery.data.name);
    }
  }, [suggestionQuery.data, scopeMode]);

  useEffect(() => {
    if (!source || !categoriesQuery.data || categoryTouchedRef.current) return;
    setCategoryIds(recommendCategoryIds(source.syllabusName, source.syllabusDescription, categoryOptions));
  }, [source, categoriesQuery.data, categoryOptions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedName(clean(courseName)), 450);
    return () => window.clearTimeout(timeout);
  }, [courseName]);
  const nameCheckQuery = useQuery({
    queryKey: ["syllabus-course-name-availability", syllabusId, debouncedName],
    queryFn: () => courseApi.checkFromSyllabusName(syllabusId, debouncedName),
    enabled: validId && allowed && Boolean(source) && Boolean(debouncedName),
    retry: false,
  });
  const nameIsDuplicate = clean(courseName) === debouncedName && nameCheckQuery.data?.available === false;
  const levelHint = source ? recommendCourseLevel(courseName || source.syllabusName, source.syllabusDescription).reason : "";
  const categorySuggestions = source ? recommendCategoryIds(source.syllabusName, source.syllabusDescription, categoryOptions) : [];
  const selectedCategoryNames = categoryOptions.filter((cat) => categoryIds.includes(cat.id));
  const filteredCategories = categoryOptions.filter((cat) => `${cat.path} ${cat.code}`.toLowerCase().includes(categorySearch.toLowerCase()));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const courseError = useMemo(() => validateDraft(courseName, description, draftSections),
    [courseName, description, draftSections]);
  const lessonCount = draftSections.reduce((sum, section) => sum + section.lessons.length, 0);

  const createMutation = useMutation({
    mutationFn: () => courseApi.createCustomizedFromSyllabus({
      course: { syllabusId, name: clean(courseName), description: description.trim(), status: "DRAFT", level: courseLevel, categoryIds },
      sections: draftSections.map((section) => ({
        title: clean(section.title), lessons: section.lessons.map((lesson) => clean(lesson.title)),
      })),
    }),
    onSuccess: async (created) => {
      setDirty(false);
      clearWorkspaceDraft(syllabusId);
      toast.success("Draft Course created. Complete Lesson content in Curriculum.");
      await queryClient.invalidateQueries({ queryKey: ["section-courses"] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-course-usage"] });
      if (hasPermission("SECTION_READ")) navigate(`/curriculum?courseId=${created.id}`);
      else if (hasPermission("COURSE_READ")) navigate(`/courses/${created.id}`);
      else navigate(`/syllabuses/${syllabusId}`);
    },
    onError: (error: unknown) => toast.error(backendError(error)),
  });

  const updateSection = (key: string, fn: (section: DraftSection) => DraftSection) => {
    setDraftSections((current) => current.map((row) => row.key === key ? fn(row) : row));
    setDirty(true);
    setOutlineEdited(true);
  };
  const moveSection = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftSections.length) return;
    setDraftSections((rows) => {
      const next = [...rows];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setDirty(true);
    setOutlineEdited(true);
  };
  const moveLesson = (sectionKey: string, index: number, direction: number) => {
    updateSection(sectionKey, (row) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= row.lessons.length) return row;
      const lessons = [...row.lessons];
      [lessons[index], lessons[nextIndex]] = [lessons[nextIndex], lessons[index]];
      return { ...row, lessons };
    });
  };
  const reset = () => {
    if (!source || createMutation.isPending) return;
    clearWorkspaceDraft(syllabusId);
    const initial = makeDraft(source);
    setDraftSections(initial);
    setCourseName(suggestionQuery.data?.name ?? `${source.syllabusName} - Course 01`.slice(0, 150));
    nameTouchedRef.current = false;
    categoryTouchedRef.current = false;
    levelTouchedRef.current = false;
    setCourseLevel(recommendCourseLevel(source.syllabusName, source.syllabusDescription).level);
    setCategoryIds(categorySuggestions);
    setDescription((source.syllabusDescription ?? "").slice(0, 500));
    setExpanded(initial.map((s) => s.key));
    setScopeMode("FULL");
    setSelectedTopicIds(allSourceTopicIds(source));
    setAppliedScopeSignature("FULL");
    setOutlineEdited(false);
    setShowValidation(false);
    setDirty(false);
  };
  const addSection = () => {
    if (draftSections.length >= 100) return;
    const key = nextKey();
    setDraftSections((s) => [...s, { key, title: "New Section", lessons: [{ key: nextKey(), title: "New Lesson" }] }]);
    setExpanded((s) => [...s, key]);
    setDirty(true);
    setOutlineEdited(true);
  };
  const toggleTopic = (topicId: number, checked: boolean) => {
    setSelectedTopicIds((current) => checked
      ? [...new Set([...current, topicId])]
      : current.filter((id) => id !== topicId));
  };
  const toggleSection = (topicIds: number[], checked: boolean) => {
    setSelectedTopicIds((current) => checked
      ? [...new Set([...current, ...topicIds])]
      : current.filter((id) => !topicIds.includes(id)));
  };
  /** Apply selected source scope explicitly so manual Course edits are never silently overwritten. */
  const applyScope = () => {
    if (!source || createMutation.isPending || !scopePending) return;
    const outline = buildCourseOutline(source, scopeMode, selectedTopicIds);
    if (outline.length === 0) {
      toast.error("Choose at least one Topic from the Syllabus.");
      return;
    }
    if (outlineEdited && !window.confirm("Applying this scope will replace your edited Course Sections and Lessons. Continue?")) return;
    setDraftSections(outline);
    setExpanded(outline.map((section) => section.key));
    setOutlineEdited(false);
    setAppliedScopeSignature(currentScopeSignature);
    setDirty(true);
    const proposedName = scopeMode === "FOCUSED"
      ? suggestFocusedCourseTitle(source, selectedTopicIds)
      : null;
    if (!nameTouchedRef.current) {
      setCourseName(proposedName ?? suggestionQuery.data?.name ?? `${source.syllabusName} - Course 01`.slice(0, 150));
    }
    if (!levelTouchedRef.current) {
      setCourseLevel(recommendCourseLevel(proposedName ?? source.syllabusName, source.syllabusDescription).level);
    }
    if (!categoryTouchedRef.current) {
      setCategoryIds(recommendCategoryIds(proposedName ?? source.syllabusName, source.syllabusDescription, categoryOptions));
    }
  };
  const confirmLeaving = () => !dirty || window.confirm("Discard unsaved Course preview changes?");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowValidation(true);
    if (scopePending) {
      toast.error("Apply the selected Syllabus scope to Course Preview before creating the Course.");
      return;
    }
    if (courseError || nameIsDuplicate || createMutation.isPending || !source) return;
    createMutation.mutate();
  };

  return (
    <MainLayout pathName={{ syllabuses: "Syllabuses", "create-course": "Create Course" }}>
      <div className="mx-auto w-full max-w-[1580px] space-y-5 pb-8">
        <Link to={`/syllabuses/${id ?? ""}`} onClick={(event) => { if (!confirmLeaving()) event.preventDefault(); }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Syllabus Detail
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Course from Syllabus</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review the Published outline on the left and edit your Course on the right. Nothing is saved until you confirm.</p>
          </div>
          <Badge variant="outline">New Course: Draft</Badge>
        </div>
        {!validId || !allowed || sourceQuery.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-5 text-sm text-destructive">
            {!validId ? "Invalid Syllabus ID." : !allowed
              ? "You need Syllabus Read, Course Create, Section Create and Lesson Create permissions."
              : backendError(sourceQuery.error)}
          </div>
        ) : sourceQuery.isPending || !source ? (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading the active Syllabus outline...</div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {linkedCourses.length > 0 && <div className="rounded-xl border bg-card px-4 py-3 text-sm" role="status">
              <p className="font-medium">This Syllabus is linked to {linkedCourses.length} existing Course{linkedCourses.length === 1 ? "" : "s"}.</p>
              <p className="mt-1 text-xs text-muted-foreground">You can create a different Course from this source. Review existing Courses first to avoid accidental duplicates.</p>
              <div className="mt-2 flex flex-wrap gap-2">{linkedCourses.slice(0, 4).map((linked) => <Link key={linked.id} to={`/courses/${linked.id}`} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs hover:bg-accent">{linked.name} ({linked.status})</Link>)}{linkedCourses.length > 4 && <span className="text-xs text-muted-foreground">+{linkedCourses.length - 4} more</span>}</div>
            </div>}
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
              <SyllabusSourcePreviewPanel source={source} syllabusId={syllabusId}
                scopeMode={scopeMode} onScopeModeChange={setScopeMode}
                selectedTopicIds={selectedTopicIds} onToggleTopic={toggleTopic} onToggleSection={toggleSection}
                selectedCount={selectedCount} scopePending={scopePending} onApplyScope={applyScope}
                selectionDisabled={createMutation.isPending} />
              <section className="min-w-0 space-y-4 rounded-xl border bg-card p-4" aria-label="Editable Course preview">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold"><BookPlus className="size-4"/> New Course</h2>
                  <Badge variant="outline">Draft • Editable</Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="course-from-syllabus-name" className="text-sm font-medium">Course name <span className="text-destructive">*</span></label>
                    <Button type="button" variant="ghost" size="sm" disabled={suggestionQuery.isFetching || createMutation.isPending} onClick={() => {
                      nameTouchedRef.current = false;
                      setNameStartAt((current) => Math.max(current + 1, (suggestionQuery.data?.sequence ?? 0) + 1));
                    }}><RefreshCw className="size-3.5"/> Suggest another</Button>
                  </div>
                  <Input id="course-from-syllabus-name" value={courseName} maxLength={150}
                    onChange={(event) => { nameTouchedRef.current = true; setCourseName(event.target.value); setDirty(true); }} disabled={createMutation.isPending} />
                  {nameIsDuplicate ? <p role="alert" className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="size-3.5"/> This name already exists. Edit it or suggest another.</p>
                    : !debouncedName || clean(courseName) !== debouncedName || nameCheckQuery.isPending
                    ? <p className="text-xs text-muted-foreground">Checking availability…</p>
                    : nameCheckQuery.data?.available ? <p className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="size-3.5"/> Available at the moment (rechecked on Save).</p>
                    : <p className="text-xs text-muted-foreground">Name availability could not be verified; Backend will check on Save.</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="course-from-syllabus-level" className="text-sm font-medium">Course Level</label>
                    <Select value={courseLevel} onValueChange={(value) => { levelTouchedRef.current = true; setCourseLevel(value as CourseLevel); setDirty(true); }}>
                      <SelectTrigger id="course-from-syllabus-level" className="w-full"><SelectValue placeholder="Choose difficulty"/></SelectTrigger>
                      <SelectContent>{COURSE_LEVEL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{levelHint} Degree Level is separate.</p>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label className="text-sm font-medium">Categories</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between overflow-hidden font-normal" disabled={createMutation.isPending || (!hasPermission("CATEGORY_READ") && !hasPermission("COURSE_READ"))}>
                          <span className="truncate">{selectedCategoryNames.length ? `${selectedCategoryNames.length} selected` : "Choose Categories"}</span><ChevronDown className="size-4 shrink-0"/>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[min(92vw,350px)] space-y-2 p-3">
                        <Input aria-label="Filter Categories" placeholder="Find a Category…" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} />
                        <div className="max-h-52 space-y-1 overflow-y-auto">
                          {filteredCategories.map((cat) => <label key={cat.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-2 text-xs hover:bg-accent">
                            <Checkbox checked={categoryIds.includes(cat.id)} onCheckedChange={(checked) => {
                              categoryTouchedRef.current = true;
                              setCategoryIds((current) => checked ? [...current, cat.id] : current.filter((id) => id !== cat.id));
                              setDirty(true);
                            }}/><span className="break-words">{cat.path}</span>
                          </label>)}
                          {!filteredCategories.length && <p className="py-2 text-xs text-muted-foreground">No matching categories.</p>}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedCategoryNames.length ? <div className="flex flex-wrap gap-1">{selectedCategoryNames.map((cat) => <Badge variant="secondary" key={cat.id}>{cat.name}</Badge>)}</div> :
                      <p className="text-xs text-muted-foreground">{!hasPermission("CATEGORY_READ") ? "CATEGORY_READ or COURSE_READ is needed to choose categories." : categoriesQuery.isPending ? "Loading active Categories…" : categoriesQuery.isError ? "Unable to load Categories. You can add them later in Course Edit." : "No confident match. Select a Category, or add it later."}</p>}
                    {categorySuggestions.length > 0 && <p className="text-xs text-muted-foreground"><Tag className="mr-1 inline size-3"/> Suggested from the title; you can change selections.</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="course-from-syllabus-description" className="text-sm font-medium">Course description</label>
                  <Textarea id="course-from-syllabus-description" value={description} maxLength={500}
                    onChange={(event) => { setDescription(event.target.value); setDirty(true); }} disabled={createMutation.isPending} rows={3}/>
                </div>
                <div className="border-t pt-4"/>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><BookPlus className="size-4" /> Course Structure</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Editable outline • Not yet saved</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={createMutation.isPending} onClick={reset}>
                    <RotateCcw className="size-3.5" /> Reset
                  </Button>
                </div>
                {scopePending && <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs" role="status">You changed the Syllabus scope. Apply it in the left panel before creating the Course. Existing manual edits are kept until you confirm replacement.</div>}
                <p className="mb-3 text-xs text-muted-foreground">{draftSections.length} Sections • {lessonCount} Lessons. Change titles and order, add or remove rows.</p>
                <div className="space-y-3">
                  {draftSections.map((section, index) => {
                    const isExpanded = expanded.includes(section.key);
                    return (
                      <div key={section.key} className="rounded-lg border">
                        <div className="flex items-center gap-1 border-b bg-muted/30 p-2">
                          <button type="button" className={iconButton} aria-label={`${isExpanded ? "Collapse" : "Expand"} Section ${index + 1}`} onClick={() => setExpanded((current) => isExpanded ? current.filter((key) => key !== section.key) : [...current, section.key])}>
                            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                          <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                          <Input aria-label={`Section ${index + 1} title`} value={section.title} maxLength={150} disabled={createMutation.isPending}
                            onChange={(event) => updateSection(section.key, (s) => ({ ...s, title: event.target.value }))} className="min-w-0 flex-1 font-semibold" />
                          <button type="button" className={iconButton} disabled={index === 0 || createMutation.isPending} onClick={() => moveSection(index, -1)} aria-label={`Move Section ${index + 1} up`} title="Move up"><ArrowUp className="size-4" /></button>
                          <button type="button" className={iconButton} disabled={index === draftSections.length - 1 || createMutation.isPending} onClick={() => moveSection(index, 1)} aria-label={`Move Section ${index + 1} down`} title="Move down"><ArrowDown className="size-4" /></button>
                          <button type="button" className={`${iconButton} hover:text-destructive`} disabled={createMutation.isPending} onClick={() => { setDraftSections((rows) => rows.filter((row) => row.key !== section.key)); setDirty(true); setOutlineEdited(true); }} aria-label={`Remove Section ${index + 1}`} title="Remove Section"><Trash2 className="size-4" /></button>
                        </div>
                        {isExpanded && <div className="space-y-2 p-3">
                          {section.lessons.map((lesson, lessonIndex) => (
                            <div key={lesson.key} className="flex min-w-0 items-center gap-1">
                              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                              <Input aria-label={`Section ${index + 1} Lesson ${lessonIndex + 1} title`} value={lesson.title} maxLength={200} disabled={createMutation.isPending}
                                onChange={(event) => updateSection(section.key, (row) => ({ ...row, lessons: row.lessons.map((current) => current.key === lesson.key ? { ...current, title: event.target.value } : current) }))} className="min-w-0 flex-1" />
                              <button type="button" className={iconButton} disabled={lessonIndex === 0 || createMutation.isPending} onClick={() => moveLesson(section.key, lessonIndex, -1)} aria-label="Move Lesson up" title="Move Lesson up"><ArrowUp className="size-3.5" /></button>
                              <button type="button" className={iconButton} disabled={lessonIndex === section.lessons.length - 1 || createMutation.isPending} onClick={() => moveLesson(section.key, lessonIndex, 1)} aria-label="Move Lesson down" title="Move Lesson down"><ArrowDown className="size-3.5" /></button>
                              <button type="button" className={`${iconButton} hover:text-destructive`} disabled={createMutation.isPending} onClick={() => updateSection(section.key, (row) => ({ ...row, lessons: row.lessons.filter((current) => current.key !== lesson.key) }))} aria-label="Remove Lesson" title="Remove Lesson"><Trash2 className="size-3.5" /></button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" disabled={createMutation.isPending || section.lessons.length >= 200} onClick={() => updateSection(section.key, (row) => ({ ...row, lessons: [...row.lessons, { key: nextKey(), title: "New Lesson" }] }))}>
                            <Plus className="size-3.5" /> Add Lesson
                          </Button>
                        </div>}
                      </div>
                    );
                  })}
                </div>
                <Button type="button" variant="outline" className="mt-4 w-full" onClick={addSection} disabled={draftSections.length >= 100 || createMutation.isPending}>
                  <Plus className="size-4" /> Add Section
                </Button>
              </section>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium"><Check className="size-4 text-green-600" /> Course will be created as Draft</p>
                  <p className="mt-1 text-xs text-muted-foreground">Lessons start with empty TEXT content. Add content and teaching details in Curriculum before publishing. Editing this preview will not modify the Syllabus.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => { if (confirmLeaving()) navigate(`/syllabuses/${syllabusId}`); }}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || Boolean(courseError) || nameIsDuplicate || scopePending}>
                    <BookPlus className="size-4" /> {createMutation.isPending ? "Creating Course..." : "Create Draft Course"}
                  </Button>
                </div>
              </div>
              {(showValidation || courseError) && courseError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="size-4" /> {courseError}</p>}
            </div>
          </form>
        )}
      </div>
    </MainLayout>
  );
}
