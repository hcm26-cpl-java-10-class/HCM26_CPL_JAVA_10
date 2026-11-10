import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, BookPlus, Check,
  ChevronDown, ChevronRight, FileText, Info, Link2Off, LockKeyhole,
  Pencil, Plus, RotateCcw, Save, Trash2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";
import { categoryApi } from "@/api/features/demo/category.api";
import { courseApi } from "@/api/features/demo/course.api";
import { syllabusApi, type SyllabusSection, type Topic } from "@/api/features/demo/syllabus.api";
import { COURSE_LEVEL_OPTIONS, type CourseLevel } from "@/types";
import GeneralInformationPanel from "./GeneralInformationPanel";
import { CloPanel, MaterialsPanel } from "./SyllabusContentPanels";
import SyllabusWorkflowPanel from "./SyllabusWorkflowPanel";
import { flattenCategoryTree, recommendCategoryIds, recommendCourseLevel } from "./courseFromSyllabusSuggestions";
import {
  makeWorkspaceDraft, readWorkspaceDraft, writeWorkspaceDraft, syncWorkspaceDraft,
  normalizeTitle, validateWorkspaceCourse,
  type WorkspaceCourseDraft, type WorkspaceLesson, type WorkspaceSection,
} from "./SyllabusCourseWorkspaceDraft";

const normalizeKey = (title: string) => normalizeTitle(title).toLocaleLowerCase("vi");
const iconButton = "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

function requestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const first = body?.errors && Object.values(body.errors).flat()[0];
    return first || body?.message || (error.response?.status === 403 ? "Missing permission for this operation." : "Request failed; check Backend and input.");
  }
  return error instanceof Error ? error.message : "Unable to save changes.";
}
function validSectionTitle(value: string, sections: SyllabusSection[], ownId?: number): string | null {
  const title = normalizeTitle(value);
  if (title.length < 3 || title.length > 150 || !/\p{L}/u.test(title)) return "Section title: 3–150 characters, including letters.";
  if (sections.some((s) => s.id !== ownId && normalizeKey(s.title) === normalizeKey(title))) return "Section title already exists in this Syllabus.";
  return null;
}
function validTopicTitle(value: string, topics: Topic[], ownId?: number): string | null {
  const title = normalizeTitle(value);
  if (title.length < 3 || title.length > 200 || !/\p{L}/u.test(title)) return "Topic title: 3–200 characters, including letters.";
  if (topics.some((t) => t.id !== ownId && normalizeKey(t.title) === normalizeKey(title))) return "Topic title already exists in this Section.";
  return null;
}

export default function SyllabusCourseWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const syllabusId = Number(id);
  const validId = Number.isSafeInteger(syllabusId) && syllabusId > 0;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("SYLLABUS_UPDATE");
  const canCreateSyllabus = hasPermission("SYLLABUS_CREATE");
  const canDeleteSyllabus = hasPermission("SYLLABUS_DELETE");
  const canCreateCourse = ["SYLLABUS_READ", "COURSE_CREATE", "SECTION_CREATE", "LESSON_CREATE"].every(hasPermission);
  const canReadCategories = hasPermission("CATEGORY_READ") || hasPermission("COURSE_READ");

  const query = useQuery({ queryKey: ["syllabus", syllabusId], queryFn: () => syllabusApi.get(syllabusId), enabled: validId });
  const progressQuery = useQuery({ queryKey: ["syllabus-progress", syllabusId], queryFn: () => syllabusApi.progress(syllabusId), enabled: validId });
  const categoryQuery = useQuery({
    queryKey: ["course-creation-category-tree", "active"],
    queryFn: () => hasPermission("CATEGORY_READ") ? categoryApi.getTree(true) : courseApi.getCatalogCategories(),
    enabled: validId && canReadCategories,
  });
  const categoryOptions = useMemo(() => flattenCategoryTree(categoryQuery.data ?? []), [categoryQuery.data]);
  const syllabus = query.data;
  const published = syllabus?.status === "PUBLISHED";
  const editable = canEdit && !published;
  const [sectionEdits, setSectionEdits] = useState<Record<number, { title: string; mission: string }>>({});
  const [topicEdits, setTopicEdits] = useState<Record<number, string>>({});
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionMission, setNewSectionMission] = useState("");
  const [newTopics, setNewTopics] = useState<Record<number, string>>({});
  const [showAddSection, setShowAddSection] = useState(false);
  const [showBulkSections, setShowBulkSections] = useState(false);
  const [bulkSectionCount, setBulkSectionCount] = useState(3);
  const [openSections, setOpenSections] = useState<number[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<{ type: "topic" | "section"; sectionId: number; topicId?: number } | null>(null);
  const [draft, setDraft] = useState<WorkspaceCourseDraft | null>(null);
  const [openPreviewSections, setOpenPreviewSections] = useState<string[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showClos, setShowClos] = useState(false);
  const [showSectionsAndTopics, setShowSectionsAndTopics] = useState(true);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const initialOpenId = useRef<number | null>(null);
  const initialPreviewOpenId = useRef<number | null>(null);
  const nextId = useRef(0);
  const makeKey = () => `local-${Date.now()}-${++nextId.current}`;

  const effectiveSections = useMemo<SyllabusSection[]>(() => (syllabus?.sections ?? []).map((section) => ({
    ...section,
    title: sectionEdits[section.id]?.title ?? section.title,
    mission: sectionEdits[section.id]?.mission ?? section.mission,
    topics: section.topics.map((topic) => ({ ...topic, title: topicEdits[topic.id] ?? topic.title })),
  })), [syllabus?.sections, sectionEdits, topicEdits]);

  const pendingSyllabus = (syllabus?.sections ?? []).some((section) => {
    const edit = sectionEdits[section.id];
    return (edit && (edit.title !== section.title || edit.mission !== (section.mission ?? ""))) ||
      section.topics.some((topic) => topicEdits[topic.id] !== undefined && topicEdits[topic.id] !== topic.title);
  });
  const pendingNewInputs = Boolean(newSectionTitle.trim() || newSectionMission.trim() || Object.values(newTopics).some((s) => s.trim()));
  const hasPendingInput = pendingSyllabus || pendingNewInputs;

  useEffect(() => {
    if (!syllabus) return;
    setDraft((previous) => {
      const base = previous?.syllabusId === syllabus.id ? previous :
        readWorkspaceDraft(syllabus.id) ?? makeWorkspaceDraft(syllabus.id, syllabus.name, syllabus.description ?? "",
          recommendCourseLevel(syllabus.name, syllabus.description).level);
      const reconciled = syncWorkspaceDraft(base, effectiveSections);
      return { ...reconciled,
        name: reconciled.nameCustomized ? reconciled.name : `${syllabus.name} - Class 01`.slice(0, 150),
        description: reconciled.descriptionCustomized ? reconciled.description : (syllabus.description ?? "").slice(0, 500),
        level: reconciled.levelCustomized ? reconciled.level : recommendCourseLevel(syllabus.name, syllabus.description).level,
      };
    });
  }, [syllabus, effectiveSections]);

  useEffect(() => {
    if (!syllabus?.sections.length || initialOpenId.current === syllabus.id) return;
    initialOpenId.current = syllabus.id;
    setOpenSections([syllabus.sections[0].id]);
  }, [syllabus]);

  useEffect(() => {
    if (!draft?.sections.length || initialPreviewOpenId.current === draft.syllabusId) return;
    initialPreviewOpenId.current = draft.syllabusId;
    setOpenPreviewSections([draft.sections[0].key]);
  }, [draft]);

  useEffect(() => { if (draft) writeWorkspaceDraft(draft); }, [draft]);

  useEffect(() => {
    if (!syllabus || !categoryQuery.data || !draft || draft.categoryCustomized) return;
    const suggested = recommendCategoryIds(syllabus.name, syllabus.description, categoryOptions);
    if (JSON.stringify(suggested) !== JSON.stringify(draft.categoryIds)) {
      setDraft((current) => current && !current.categoryCustomized ? { ...current, categoryIds: suggested } : current);
    }
  }, [syllabus, categoryQuery.data, categoryOptions, draft?.categoryCustomized, draft?.categoryIds]);

  useEffect(() => {
    if (!hasPendingInput) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPendingInput]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["syllabus", syllabusId] }),
      qc.invalidateQueries({ queryKey: ["syllabus-progress", syllabusId] }),
      qc.invalidateQueries({ queryKey: ["syllabuses"] }),
    ]);
  };
  const updateDraft = (change: (current: WorkspaceCourseDraft) => WorkspaceCourseDraft) => setDraft((current) => current ? change(current) : current);
  const syncError = (key: string, message: string | null) => setFieldError((previous) => {
    const next = { ...previous }; if (message) next[key] = message; else delete next[key]; return next;
  });

  async function saveSection(section: SyllabusSection) {
    if (!editable || busyKey) return;
    const edit = sectionEdits[section.id];
    if (!edit) return;
    const title = normalizeTitle(edit.title);
    const error = validSectionTitle(title, effectiveSections, section.id) ||
      (edit.mission.length > 2000 ? "Mission cannot exceed 2000 characters." : null);
    if (error) { syncError(`section-${section.id}`, error); return; }
    setBusyKey(`section-${section.id}`);
    try {
      await syllabusApi.editSection(syllabusId, section.id, title, section.orderIndex, edit.mission.trim());
      setSectionEdits((old) => { const next = { ...old }; delete next[section.id]; return next; });
      syncError(`section-${section.id}`, null);
      await refresh();
      toast.success("Syllabus Section saved.");
    } catch (e) { syncError(`section-${section.id}`, requestError(e)); }
    finally { setBusyKey(null); }
  }

  async function saveTopic(section: SyllabusSection, topic: Topic) {
    if (!editable || busyKey) return;
    const newTitle = topicEdits[topic.id];
    if (newTitle === undefined || newTitle === topic.title) return;
    const error = validTopicTitle(newTitle, effectiveSections.find((s) => s.id === section.id)?.topics ?? section.topics, topic.id);
    if (error) { syncError(`topic-${topic.id}`, error); return; }
    setBusyKey(`topic-${topic.id}`);
    try {
      await syllabusApi.editTopic(syllabusId, section.id, topic.id, normalizeTitle(newTitle));
      setTopicEdits((old) => { const next = { ...old }; delete next[topic.id]; return next; });
      syncError(`topic-${topic.id}`, null);
      await refresh();
      toast.success("Syllabus Topic saved.");
    } catch (e) { syncError(`topic-${topic.id}`, requestError(e)); }
    finally { setBusyKey(null); }
  }

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || busyKey || !syllabus) return;
    const error = validSectionTitle(newSectionTitle, effectiveSections) ||
      (newSectionMission.length > 2000 ? "Mission cannot exceed 2000 characters." : null);
    if (error) { syncError("new-section", error); return; }
    setBusyKey("new-section");
    try {
      const order = Math.max(0, ...syllabus.sections.map((s) => s.orderIndex)) + 1;
      await syllabusApi.addSection(syllabusId, normalizeTitle(newSectionTitle), order, newSectionMission.trim());
      setNewSectionTitle(""); setNewSectionMission(""); setShowAddSection(false);
      syncError("new-section", null); await refresh(); toast.success("Syllabus Section added.");
    } catch (e) { syncError("new-section", requestError(e)); }
    finally { setBusyKey(null); }
  }

  async function addBulkSections(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || !canCreateSyllabus || busyKey || !syllabus) return;
    if (!Number.isInteger(bulkSectionCount) || bulkSectionCount < 1 || bulkSectionCount > 30) {
      syncError("bulk-sections", "Choose between 1 and 30 Sections.");
      return;
    }
    const used = new Set(syllabus.sections.map((section) => normalizeKey(section.title)));
    const titles: string[] = [];
    let nextNumber = Math.max(0, ...syllabus.sections.map((section) => section.orderIndex)) + 1;
    while (titles.length < bulkSectionCount) {
      const title = `Section ${nextNumber++}`;
      if (used.has(normalizeKey(title))) continue;
      used.add(normalizeKey(title));
      titles.push(title);
    }
    setBusyKey("bulk-sections");
    try {
      // Reuse the transactional bulk endpoint from Syllabus Detail.
      await syllabusApi.bulkSections(syllabusId, titles);
      syncError("bulk-sections", null);
      setShowBulkSections(false);
      await refresh();
      toast.success(`${titles.length} Sections created. Add Missions and Topics to complete them.`);
    } catch (error) { syncError("bulk-sections", requestError(error)); }
    finally { setBusyKey(null); }
  }

  async function addTopic(event: FormEvent<HTMLFormElement>, section: SyllabusSection) {
    event.preventDefault();
    if (!editable || busyKey) return;
    const title = newTopics[section.id] ?? "";
    const error = validTopicTitle(title, effectiveSections.find((s) => s.id === section.id)?.topics ?? section.topics);
    if (error) { syncError(`new-topic-${section.id}`, error); return; }
    setBusyKey(`new-topic-${section.id}`);
    try {
      await syllabusApi.addTopic(syllabusId, section.id, normalizeTitle(title));
      setNewTopics((old) => ({ ...old, [section.id]: "" }));
      syncError(`new-topic-${section.id}`, null);
      await refresh(); toast.success("Syllabus Topic added.");
    } catch (e) { syncError(`new-topic-${section.id}`, requestError(e)); }
    finally { setBusyKey(null); }
  }

  async function removeSource() {
    if (!editable || busyKey || !deleting) return;
    if (deleting.type === "section" && syllabus?.sections.find((s) => s.id === deleting.sectionId)?.topics.length) {
      toast.error("Remove all Topics before deleting a Syllabus Section."); setDeleting(null); return;
    }
    setBusyKey("delete");
    try {
      if (deleting.type === "section") await syllabusApi.deleteSection(syllabusId, deleting.sectionId);
      else if (deleting.topicId != null) await syllabusApi.deleteTopic(syllabusId, deleting.sectionId, deleting.topicId);
      setDeleting(null); await refresh(); toast.success("Syllabus content deleted.");
    } catch (e) { toast.error(requestError(e)); }
    finally { setBusyKey(null); }
  }

  const editPreviewSection = (key: string, change: (section: WorkspaceSection) => WorkspaceSection) =>
    updateDraft((p) => ({ ...p, sections: p.sections.map((s) => s.key === key ? change(s) : s) }));
  const movePreviewSection = (index: number, dir: number) => updateDraft((p) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= p.sections.length) return p;
    const sections = [...p.sections]; [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    return { ...p, sections };
  });
  const movePreviewLesson = (sectionKey: string, index: number, dir: number) => editPreviewSection(sectionKey, (s) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= s.lessons.length) return s;
    const lessons = [...s.lessons]; [lessons[index], lessons[newIndex]] = [lessons[newIndex], lessons[index]];
    return { ...s, lessons };
  });
  const removePreviewSection = (row: WorkspaceSection) => updateDraft((p) => ({
    ...p, sections: p.sections.filter((s) => s.key !== row.key),
    ignoredSectionIds: row.sourceSectionId == null ? p.ignoredSectionIds : [...new Set([...p.ignoredSectionIds, row.sourceSectionId])],
  }));
  const removePreviewLesson = (sectionKey: string, lesson: WorkspaceLesson) => updateDraft((p) => ({
    ...p, ignoredTopicIds: lesson.sourceTopicId == null ? p.ignoredTopicIds : [...new Set([...p.ignoredTopicIds, lesson.sourceTopicId])],
    sections: p.sections.map((s) => s.key === sectionKey ? { ...s, lessons: s.lessons.filter((l) => l.key !== lesson.key) } : s),
  }));
  const resetPreview = () => {
    if (!syllabus || !draft || !window.confirm("Reset the Course outline to the current Syllabus? Manually customized outline changes will be lost.")) return;
    updateDraft((p) => syncWorkspaceDraft({ ...p, sections: [], ignoredTopicIds: [], ignoredSectionIds: [] }, effectiveSections));
  };

  const leave = () => !hasPendingInput || window.confirm("You have unsaved Syllabus edits. Leave without saving them? Course preview changes stay only in this browser session.");
  const courseError = draft ? validateWorkspaceCourse(draft) : null;
  const lessonCount = draft?.sections.reduce((n, s) => n + s.lessons.length, 0) ?? 0;
  const totalSourceTopics = syllabus?.sections.reduce((n, s) => n + s.topics.length, 0) ?? 0;
  const savedProgress = progressQuery.data?.completionPercent ?? syllabus?.completionPercent ?? 0;
  const canContinue = published && syllabus?.isActive && !hasPendingInput && !courseError && canCreateCourse;
  const selectedCategories = categoryOptions.filter((c) => draft?.categoryIds.includes(c.id));
  const filteredCategories = categoryOptions.filter((c) => `${c.path} ${c.code}`.toLowerCase().includes(categorySearch.toLowerCase()));

  return (
    <MainLayout pathName={{ syllabuses: "Syllabuses", workspace: "Syllabus & Course Workspace" }}>
      <div className="mx-auto w-full max-w-[1680px] space-y-3 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/syllabuses/${syllabusId}`} onClick={(e) => { if (!leave()) e.preventDefault(); }}
              className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5"/> Syllabus Detail</Link>
            <h1 className="text-xl font-semibold tracking-tight">Syllabus & Course Workspace</h1>
            <p className="mt-1 text-xs text-muted-foreground">Edit and save Syllabus on the left; customize a separate Course preview on the right.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Syllabus: {published ? "Published" : "Draft"}</Badge>
            <Badge variant="secondary">Course: Preview only</Badge>
          </div>
        </div>
        {!validId || query.isError || !syllabus ? (
          <div role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
            {!validId ? "Invalid Syllabus ID." : query.isPending ? "Loading Syllabus..." : "Unable to load Syllabus. Try returning to Detail."}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                {hasPendingInput ? <Badge variant="outline" className="border-amber-500/40 text-amber-600">Syllabus: Unsaved edits</Badge> :
                  <Badge variant="outline" className="border-green-500/30 text-green-600"><Check className="mr-1 size-3"/> Syllabus: Saved</Badge>}
                <span className="hidden text-muted-foreground sm:inline">Course Preview is kept in this browser tab; it is not a database Course.</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Completion {savedProgress}%</span><Progress value={savedProgress} className="h-1.5 w-20 sm:w-28"/>
              </div>
            </div>
            <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2">
              {/* Syllabus is always authoritative: save via existing M3 APIs. */}
              <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4" aria-label="Editable Syllabus">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold"><BookOpen className="size-4"/> Syllabus Editor</h2>
                  {published ? <Badge variant="outline"><LockKeyhole className="mr-1 size-3"/> Read-only</Badge> : <Badge variant="outline">Save changes on left</Badge>}
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-mono text-muted-foreground">{syllabus.code}</p>
                  <p className="mt-1 break-words font-semibold">{syllabus.name}</p>
                  {syllabus.description && <p className="mt-1 text-xs text-muted-foreground">{syllabus.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{syllabus.sections.length} Sections</span><span>·</span><span>{totalSourceTopics} Topics</span></div>
                </div>
                {/* Keep the section order aligned with the regular Syllabus Detail page. */}
                {[
                  { title: "General Information", open: showInfo, setOpen: setShowInfo,
                    content: <GeneralInformationPanel syllabusId={syllabusId} readOnly={published}/> },
                  { title: "Completion Progress", open: showWorkflow, setOpen: setShowWorkflow,
                    content: <SyllabusWorkflowPanel syllabusId={syllabusId}/> },
                  { title: "Course Learning Outcomes", open: showClos, setOpen: setShowClos,
                    content: <CloPanel syllabusId={syllabusId} readOnly={published}/> },
                ].map((panel) => <Collapsible key={panel.title} open={panel.open} onOpenChange={panel.setOpen} className="rounded-lg border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
                    <span>{panel.title}</span>{panel.open ? <ChevronDown className="size-4 shrink-0"/> : <ChevronRight className="size-4 shrink-0"/>}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t p-2 sm:p-3">
                    {panel.title === "Completion Progress" && hasPendingInput ?
                      <p role="status" className="rounded-md border border-amber-500/30 p-3 text-xs text-amber-600">Save or clear unfinished Syllabus fields before publishing. The progress indicator above shows the last saved data.</p>
                      : panel.content}
                  </CollapsibleContent>
                </Collapsible>)}

                <Collapsible open={showSectionsAndTopics} onOpenChange={setShowSectionsAndTopics} className="rounded-lg border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
                    <span>Sections &amp; Topics</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {syllabus.sections.length} / {totalSourceTopics}
                      {showSectionsAndTopics ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 border-t p-2 sm:p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Edit Syllabus Sections, Missions and Topics; save each change.</p>
                      {editable && canCreateSyllabus && <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setShowBulkSections((v) => !v); setShowAddSection(false); syncError("bulk-sections", null); }} disabled={!!busyKey}>Add Multiple Sections</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddSection((v) => !v); setShowBulkSections(false); }} disabled={!!busyKey}><Plus className="size-3.5"/> Add Section</Button>
                      </div>}
                    </div>
                      {showBulkSections && editable && canCreateSyllabus && <form onSubmit={(e) => void addBulkSections(e)} className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="space-y-1">
                          <label htmlFor="workspace-bulk-section-count" className="text-xs font-medium">Number of Sections (1–30)</label>
                          <Input id="workspace-bulk-section-count" type="number" min={1} max={30} step={1} value={bulkSectionCount} className="h-9 max-w-32"
                            onChange={(e) => { setBulkSectionCount(Number(e.target.value)); syncError("bulk-sections", null); }} disabled={!!busyKey}/>
                          <p className="text-xs text-muted-foreground">Titles are numbered automatically, as in Syllabus Detail. Add Missions and Topics after creation. Course Preview will sync the new Sections.</p>
                        </div>
                        {fieldError["bulk-sections"] && <p role="alert" className="text-xs text-destructive">{fieldError["bulk-sections"]}</p>}
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="ghost" disabled={!!busyKey} onClick={() => setShowBulkSections(false)}>Cancel</Button>
                          <Button type="submit" size="sm" disabled={!!busyKey || !Number.isInteger(bulkSectionCount) || bulkSectionCount < 1 || bulkSectionCount > 30}>
                            {busyKey === "bulk-sections" ? "Creating..." : `Create ${bulkSectionCount} Sections`}
                          </Button>
                        </div>
                      </form>}
                      {showAddSection && editable && <form onSubmit={(e) => void addSection(e)} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                        <label className="text-xs font-medium" htmlFor="workspace-new-section">New Section title</label>
                        <Input id="workspace-new-section" value={newSectionTitle} maxLength={150} onChange={(e) => { setNewSectionTitle(e.target.value); syncError("new-section", null); }} placeholder="e.g. Introduction to Java" />
                        <Textarea aria-label="New Section mission" value={newSectionMission} maxLength={2000} rows={2} onChange={(e) => setNewSectionMission(e.target.value)} placeholder="Mission (optional while Draft)" />
                        {fieldError["new-section"] && <p role="alert" className="text-xs text-destructive">{fieldError["new-section"]}</p>}
                        <div className="flex justify-end gap-2"><Button size="sm" type="button" variant="ghost" onClick={() => { setShowAddSection(false); setNewSectionTitle(""); setNewSectionMission(""); }}>Cancel</Button><Button size="sm" disabled={!!busyKey}>Save Section</Button></div>
                      </form>}
                      <div className="space-y-2">
                        {syllabus.sections.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">No Sections yet. Add a Section to build both outlines.</p>}
                        {syllabus.sections.map((section, index) => {
                          const edit = sectionEdits[section.id];
                          const title = edit?.title ?? section.title;
                          const mission = edit?.mission ?? section.mission ?? "";
                          const changed = Boolean(edit && (edit.title !== section.title || edit.mission !== (section.mission ?? "")));
                          const opened = openSections.includes(section.id);
                          return <div key={section.id} className="overflow-hidden rounded-lg border">
                            <div className="flex items-center gap-1 bg-muted/30 px-2 py-2">
                              <button type="button" className={iconButton} aria-label={opened ? "Collapse Section" : "Expand Section"} onClick={() => setOpenSections((rows) => opened ? rows.filter((n) => n !== section.id) : [...rows, section.id])}>
                                {opened ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}
                              </button>
                              <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                              <Input aria-label={`Syllabus Section ${index + 1} title`} className="h-8 min-w-0 flex-1 text-sm font-semibold" value={title} maxLength={150}
                                onChange={(e) => { setSectionEdits((p) => ({ ...p, [section.id]: { title: e.target.value, mission } })); syncError(`section-${section.id}`, null); }} disabled={!editable || !!busyKey}/>
                              {changed && <Button variant="outline" size="icon-sm" title="Save Syllabus Section" aria-label="Save Syllabus Section" disabled={!!busyKey} onClick={() => void saveSection(section)}><Save className="size-3.5"/></Button>}
                              {editable && canDeleteSyllabus && <button type="button" className={`${iconButton} hover:text-destructive`} disabled={!!busyKey || !!section.topics.length} title={section.topics.length ? "Remove Topics first" : "Delete Section"} aria-label="Delete Section" onClick={() => setDeleting({ type: "section", sectionId: section.id })}><Trash2 className="size-3.5"/></button>}
                            </div>
                            {fieldError[`section-${section.id}`] && <p role="alert" className="px-3 py-1 text-xs text-destructive">{fieldError[`section-${section.id}`]}</p>}
                            {opened && <div className="space-y-3 p-2 sm:p-3">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground" htmlFor={`mission-${section.id}`}>Section Mission</label>
                                <Textarea id={`mission-${section.id}`} rows={2} maxLength={2000} value={mission} disabled={!editable || !!busyKey}
                                  onChange={(e) => { setSectionEdits((p) => ({ ...p, [section.id]: { title, mission: e.target.value } })); syncError(`section-${section.id}`, null); }}/>
                                {changed && <p className="text-[11px] text-amber-600">Unsaved Syllabus change — click the save icon on the Section row.</p>}
                              </div>
                              <div className="space-y-1.5 border-t pt-2">
                                {section.topics.map((topic, topicIndex) => {
                                  const current = topicEdits[topic.id] ?? topic.title;
                                  const changedTopic = current !== topic.title;
                                  return <div key={topic.id}>
                                    <div className="flex items-center gap-1">
                                      <FileText className="size-3.5 shrink-0 text-muted-foreground"/>
                                      <span className="w-4 shrink-0 text-[11px] text-muted-foreground">{topicIndex + 1}.</span>
                                      <Input value={current} maxLength={200} aria-label={`Syllabus Topic ${topicIndex + 1}`} className="h-8 min-w-0 flex-1 text-xs" disabled={!editable || !!busyKey}
                                        onChange={(e) => { setTopicEdits((p) => ({ ...p, [topic.id]: e.target.value })); syncError(`topic-${topic.id}`, null); }}/>
                                      {changedTopic && <Button size="icon-sm" variant="outline" disabled={!!busyKey} aria-label="Save Syllabus Topic" title="Save Topic" onClick={() => void saveTopic(section, topic)}><Save className="size-3.5"/></Button>}
                                      {editable && canDeleteSyllabus && <button className={`${iconButton} hover:text-destructive`} type="button" disabled={!!busyKey} aria-label="Delete Syllabus Topic" title="Delete Topic" onClick={() => setDeleting({ type: "topic", sectionId: section.id, topicId: topic.id })}><Trash2 className="size-3.5"/></button>}
                                    </div>
                                    {fieldError[`topic-${topic.id}`] && <p role="alert" className="pl-6 text-xs text-destructive">{fieldError[`topic-${topic.id}`]}</p>}
                                  </div>;
                                })}
                                {editable && canCreateSyllabus && <form onSubmit={(e) => void addTopic(e, section)} className="flex items-center gap-1 pt-1">
                                  <Input aria-label={`New Topic in ${section.title}`} className="h-8 min-w-0 flex-1 text-xs" maxLength={200} value={newTopics[section.id] ?? ""} placeholder="New Topic title" onChange={(e) => { setNewTopics((p) => ({ ...p, [section.id]: e.target.value })); syncError(`new-topic-${section.id}`, null); }} disabled={!!busyKey}/>
                                  <Button type="submit" variant="outline" size="sm" disabled={!!busyKey}><Plus className="size-3.5"/> Add</Button>
                                </form>}
                                {fieldError[`new-topic-${section.id}`] && <p role="alert" className="text-xs text-destructive">{fieldError[`new-topic-${section.id}`]}</p>}
                              </div>
                            </div>}
                          </div>;
                        })}
                      </div>
                      {hasPendingInput && <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-600">Changes on the left are visible in the Course Preview immediately, but they are not saved until you click Save/Add. Publish is unavailable here until edits are saved.</p>}

                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={showMaterials} onOpenChange={setShowMaterials} className="rounded-lg border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
                    <span>General Learning Materials</span>
                    {showMaterials ? <ChevronDown className="size-4 shrink-0"/> : <ChevronRight className="size-4 shrink-0"/>}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t p-2 sm:p-3">
                    <MaterialsPanel syllabusId={syllabusId} readOnly={published}/>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              {/* Course remains session-only until the Syllabus is Published and the user confirms. */}
              <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4 xl:sticky xl:top-3 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto" aria-label="Editable Course preview">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold"><BookPlus className="size-4"/> Course Preview</h2>
                  <Badge variant="secondary">Not saved to LMS</Badge>
                </div>
                {draft ? <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label htmlFor="workspace-course-name" className="text-xs font-medium">Course Name *</label>
                      <Input id="workspace-course-name" maxLength={150} value={draft.name}
                        onChange={(e) => updateDraft((p) => ({ ...p, name: e.target.value, nameCustomized: true }))}/>
                      <p className="text-[11px] text-muted-foreground">Provisional name. Availability is verified on the final Create Course page.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Difficulty (Course Level)</label>
                      <Select value={draft.level} onValueChange={(value) => updateDraft((p) => ({ ...p, level: value as CourseLevel, levelCustomized: true }))}>
                        <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                        <SelectContent>{COURSE_LEVEL_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Categories</label>
                      <Popover>
                        <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-between text-xs" disabled={!canReadCategories}>
                          <span className="truncate">{draft.categoryIds.length ? `${draft.categoryIds.length} selected` : "Choose Categories"}</span><ChevronDown className="size-4"/>
                        </Button></PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(92vw,340px)] space-y-2 p-3">
                          <Input placeholder="Search Categories" aria-label="Search Categories" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}/>
                          <div className="max-h-48 space-y-1 overflow-y-auto">{filteredCategories.map((cat) => <label key={cat.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-xs hover:bg-accent">
                            <Checkbox checked={draft.categoryIds.includes(cat.id)} onCheckedChange={(v) => updateDraft((p) => ({ ...p, categoryCustomized: true,
                              categoryIds: v ? [...new Set([...p.categoryIds, cat.id])] : p.categoryIds.filter((n) => n !== cat.id) }))}/><span>{cat.path}</span>
                          </label>)}{!filteredCategories.length && <p className="text-xs text-muted-foreground">No matching Categories.</p>}</div>
                        </PopoverContent>
                      </Popover>
                      {!!selectedCategories.length && <p className="text-[11px] text-muted-foreground">{selectedCategories.map((c) => c.name).join(", ")}</p>}
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label htmlFor="workspace-course-description" className="text-xs font-medium">Course Description</label>
                      <Textarea id="workspace-course-description" rows={2} maxLength={500} value={draft.description}
                        onChange={(e) => updateDraft((p) => ({ ...p, description: e.target.value, descriptionCustomized: true }))}/>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div><h3 className="text-sm font-semibold">Course Structure</h3><p className="text-xs text-muted-foreground">{draft.sections.length} Sections · {lessonCount} Lessons</p></div>
                    <Button size="sm" variant="outline" onClick={resetPreview}><RotateCcw className="size-3.5"/> Reset outline</Button>
                  </div>
                  {draft.sections.length === 0 && <p className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">Add a Section on the left to start the Course outline, or add one here.</p>}
                  <div className="space-y-2">
                    {draft.sections.map((section, index) => {
                      const opened = openPreviewSections.includes(section.key);
                      return <div key={section.key} className="overflow-hidden rounded-lg border">
                        <div className="flex min-w-0 items-center gap-1 bg-muted/30 px-2 py-2">
                          <button className={iconButton} type="button" aria-label="Expand Course Section" onClick={() => setOpenPreviewSections((p) => opened ? p.filter((id) => id !== section.key) : [...p, section.key])}>
                            {opened ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}</button>
                          <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                          <Input aria-label={`Course Section ${index + 1} title`} className="h-8 min-w-0 flex-1 text-sm font-semibold" maxLength={150} value={section.title}
                            onChange={(e) => editPreviewSection(section.key, (s) => ({ ...s, title: e.target.value, titleCustomized: true }))}/>
                          <button type="button" className={iconButton} disabled={index === 0} aria-label="Move Course Section up" onClick={() => movePreviewSection(index, -1)}><ArrowUp className="size-3.5"/></button>
                          <button type="button" className={iconButton} disabled={index === draft.sections.length - 1} aria-label="Move Course Section down" onClick={() => movePreviewSection(index, 1)}><ArrowDown className="size-3.5"/></button>
                          <button type="button" className={`${iconButton} hover:text-destructive`} aria-label="Remove Course Section from preview" onClick={() => { if (window.confirm(`Remove Course Section “${section.title}” from the Preview? The Syllabus is unchanged.`)) removePreviewSection(section); }}><Trash2 className="size-3.5"/></button>
                        </div>
                        {(section.detached || section.titleCustomized) && <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">{section.detached ? <><Link2Off className="size-3"/> Source removed; kept your edits</> : <><Pencil className="size-3"/> Custom title protected from sync</>}</span>
                          {section.sourceSectionId != null && section.titleCustomized && <button type="button" className="underline" onClick={() => { const source = effectiveSections.find((s) => s.id === section.sourceSectionId); if (source) editPreviewSection(section.key, (s) => ({ ...s, title: source.title, titleCustomized: false })); }}>Use Syllabus title</button>}
                        </div>}
                        {opened && <div className="space-y-2 p-2 sm:p-3">
                          {section.lessons.map((lesson, lessonIndex) => <div key={lesson.key} className="space-y-1">
                            <div className="flex min-w-0 items-center gap-1">
                              <FileText className="size-3.5 shrink-0 text-muted-foreground"/>
                              <Input aria-label={`Course Lesson ${lessonIndex + 1}`} className="h-8 min-w-0 flex-1 text-xs" maxLength={200} value={lesson.title}
                                onChange={(e) => editPreviewSection(section.key, (s) => ({ ...s, lessons: s.lessons.map((l) => l.key === lesson.key ? { ...l, title: e.target.value, titleCustomized: true } : l) }))}/>
                              <button type="button" className={iconButton} disabled={lessonIndex === 0} aria-label="Move Course Lesson up" onClick={() => movePreviewLesson(section.key, lessonIndex, -1)}><ArrowUp className="size-3.5"/></button>
                              <button type="button" className={iconButton} disabled={lessonIndex === section.lessons.length - 1} aria-label="Move Course Lesson down" onClick={() => movePreviewLesson(section.key, lessonIndex, 1)}><ArrowDown className="size-3.5"/></button>
                              <button type="button" className={`${iconButton} hover:text-destructive`} aria-label="Remove Course Lesson" onClick={() => removePreviewLesson(section.key, lesson)}><Trash2 className="size-3.5"/></button>
                            </div>
                            {(lesson.titleCustomized || lesson.detached) && <div className="flex items-center justify-between gap-2 px-5 text-[11px] text-muted-foreground">
                              <span>{lesson.detached ? "Source Topic removed; custom Lesson kept" : "Custom Lesson title protected"}</span>
                              {lesson.sourceTopicId != null && lesson.titleCustomized && <button type="button" className="underline" onClick={() => {
                                const topic = effectiveSections.flatMap((s) => s.topics).find((t) => t.id === lesson.sourceTopicId);
                                if (topic) editPreviewSection(section.key, (s) => ({ ...s, lessons: s.lessons.map((l) => l.key === lesson.key ? { ...l, title: topic.title, titleCustomized: false } : l) }));
                              }}>Use Topic title</button>}
                            </div>}
                          </div>)}
                          <Button type="button" size="sm" variant="outline" disabled={section.lessons.length >= 200} onClick={() => editPreviewSection(section.key, (s) => ({ ...s, lessons: [...s.lessons, { key: makeKey(), sourceTopicId: null, title: "New Lesson", titleCustomized: true }] }))}><Plus className="size-3.5"/> Add Lesson</Button>
                        </div>}
                      </div>;
                    })}
                  </div>
                  <Button type="button" variant="outline" className="w-full" disabled={draft.sections.length >= 100} onClick={() => {
                    const key = makeKey();
                    updateDraft((p) => ({ ...p, sections: [...p.sections, { key, sourceSectionId: null, title: "New Section", titleCustomized: true,
                      lessons: [{ key: makeKey(), sourceTopicId: null, title: "New Lesson", titleCustomized: true }] }] }));
                    setOpenPreviewSections((rows) => [...rows, key]);
                  }}><Plus className="size-4"/> Add Course Section</Button>
                  {courseError && <p role="alert" className="rounded-md border border-amber-500/30 p-2 text-xs text-amber-600">{courseError}</p>}
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0"/>
                      <p>Course changes are independent and are kept in this browser session only. Syllabus updates automatically sync unmodified titles; your manually customized titles are protected.</p>
                    </div>
                    {hasPendingInput && <p className="mt-2 text-amber-600">Save outstanding Syllabus edits before continuing.</p>}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => { if (draft) writeWorkspaceDraft(draft); navigate(`/syllabuses/${syllabusId}/create-course`); }} disabled={!canContinue}>
                      Continue to Create Course <ArrowRight className="size-4"/>
                    </Button>
                  </div>
                  {!published && <p className="text-xs text-muted-foreground">Publish the Syllabus on the left when all 6 checks pass. Course is not created until you confirm on the next page.</p>}
                </> : <div className="p-5 text-sm text-muted-foreground">Preparing Course preview...</div>}
              </section>
            </div>
            <ConfirmDialog open={deleting !== null} title={deleting?.type === "section" ? "Delete Syllabus Section?" : "Delete Syllabus Topic?"}
              description="This change is saved to the Syllabus. Matching, uncustomized Course Preview rows will be removed; customized content will be kept for review."
              confirmLabel="Delete" onCancel={() => { if (!busyKey) setDeleting(null); }} onConfirm={() => void removeSource()} loading={Boolean(busyKey)}/>
          </>
        )}
      </div>
    </MainLayout>
  );
}
