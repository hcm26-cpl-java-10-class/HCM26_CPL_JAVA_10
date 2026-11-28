import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowUp, BookPlus, Check, CheckCircle2,
  ChevronDown, Plus, RotateCcw, RefreshCw, Tag, ExternalLink,
  Trash2, FileText, Video, Music2, Link2, ClipboardList, GraduationCap, FolderOpen, AlertCircle, Sparkles, ShieldCheck,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExamConfigFields } from "@/pages/management/exam/ExamConfigFields";
import { DEFAULT_CONFIG, buildExamRequest, validateConfig, type ExamConfigForm } from "@/pages/management/exam/examConfig";
import type { ExamCategory, QuestionDTO } from "@/types";
import ExamDetailPage from "@/pages/management/exam/ExamDetailPage";
import { allowedQuestionTypes } from "@/pages/management/exam/ExamQuestionsPanel";
import { courseApi, type CourseSyllabusPreview, type CourseAiSuggestion, type CourseAiResource, type CourseAiJob } from "@/api/features/demo/course.api";
import { syllabusExtrasApi } from "@/api/features/demo/syllabus-extras.api";
import { lessonApi } from "@/api/features/demo/lesson.api";
import { categoryApi } from "@/api/features/demo/category.api";
import { COURSE_LEVEL_OPTIONS, type CourseLevel } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import SyllabusSourcePreviewPanel from "./SyllabusSourcePreviewPanel";
import CourseDisclosureChevron from "./CourseDisclosureChevron";
import CourseCoveragePanel from "./CourseCoveragePanel";
import { isAssessmentLesson, lessonContentIssue, lessonDraftSaveIssue, requiresResourceUrl } from "./courseLessonContent";
import { LESSON_CONTENT_TYPE_OPTIONS, type LessonContentType } from "@/types/features/demo/lesson";
import { flattenCategoryTree, recommendCategoryIds, recommendCourseLevel } from "./courseFromSyllabusSuggestions";
import { usePermissions } from "@/hooks/usePermissions";
import { readWorkspaceDraft, syncWorkspaceDraft, clearWorkspaceDraft } from "./SyllabusCourseWorkspaceDraft";
import { allSourceTopicIds, buildCourseOutline, scopeSignature, suggestFocusedCourseTitle, type CourseScopeMode } from "./courseFromSyllabusScope";

type AssessmentType = "QUIZ" | "EXAM" | "ASSIGNMENT";
type AssessmentDraft = { cfg: ExamConfigForm; duration: string; instructions: string; questions?: QuestionDTO[] };
type DraftLesson = { key: string; title: string; sourceTopicId?: number | null; material?: string; contentType?: LessonContentType; contentUrl?: string; duration?: number; planned?: boolean; assessment?: AssessmentDraft };
const assessmentCategories = (type: AssessmentType): ExamCategory[] => type === "EXAM" ? ["MIDTERM", "FINAL_TEST"] : [type];
const MAX_ASSESSMENT_MINUTES = Math.floor(2147483647 / 60);
function assessmentIssue(type: AssessmentType, title: string, draft?: AssessmentDraft): string | null {
  if (!draft) return "Configure this assessment before creating the Course.";
  const { cfg, duration, instructions } = draft;
  if (!title.trim() || title.trim().length > 200) return "Enter a title of up to 200 characters.";
  if (!instructions.trim() || instructions.trim().length > 12000) return "Enter assessment instructions (1–12,000 characters).";
  if (!duration.trim() || !Number.isInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > MAX_ASSESSMENT_MINUTES) return "Duration must be a positive whole number of minutes within range.";
  if (!assessmentCategories(type).includes(cfg.category as ExamCategory)) return "Select a category matching the Lesson type.";
  if (cfg.maxAttempts.trim() && (!Number.isSafeInteger(Number(cfg.maxAttempts)) || Number(cfg.maxAttempts) < 1 || Number(cfg.maxAttempts) > 2147483647)) return "Maximum attempts must be a positive whole number.";
  for (const [value, min, max, label] of [[cfg.lateGraceMinutes, 0, 2147483647, "Grace period"], [cfg.headTurnAngleDeg, 10, 80, "Head-turn angle"], [cfg.headTurnSeconds, 1, 30, "Head-turn time"], [cfg.fastSubmitPercent, 1, 50, "Fast-submission threshold"], [cfg.latePolicy === "ALLOWED_WITH_PENALTY" ? cfg.latePenaltyPercent : "", 1, 100, "Late penalty"]] as const) {
    if (value.trim() && (!Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max)) return `${label} must be a whole number between ${min} and ${max}.`;
  }
  if (cfg.accessCode.length > 100) return "Access code must not exceed 100 characters.";
  if (cfg.passScore.trim() && !Number.isFinite(Number(cfg.passScore))) return "Passing score must be a valid number.";
  if (cfg.maxScore.trim() && (!Number.isFinite(Number(cfg.maxScore)) || Number(cfg.maxScore) < 0.01)) return "Max score must be at least 0.01.";
  if (cfg.peerReviewCount.trim() && (!Number.isInteger(Number(cfg.peerReviewCount)) || Number(cfg.peerReviewCount) < 1 || Number(cfg.peerReviewCount) > 5)) return "Number of peer reviewers must be between 1 and 5.";
  return validateConfig(Number(duration), cfg);
}
function draftLessonIssue(lesson: DraftLesson): string | null {
  const type = lesson.contentType ?? "TEXT";
  return isAssessmentLesson(type) ? assessmentIssue(type as AssessmentType, lesson.title, lesson.assessment) : lessonContentIssue(lesson);
}

function draftSaveIssue(lesson: DraftLesson): string | null {
  const type = lesson.contentType ?? "TEXT";
  const issue = lessonDraftSaveIssue(lesson);
  if (issue) return issue;
  if (isAssessmentLesson(type)) {
    if (!lesson.assessment) return null;
    return assessmentIssue(type as AssessmentType, lesson.title, lesson.assessment);
  }
  return null;
}

/** Reuse the group's actual Assessment fields; this dialog only edits the unsaved Course preview. */
function AssessmentPreviewDialog({ lesson, type, onClose, onApply }: { lesson: DraftLesson; type: AssessmentType; onClose: () => void; onApply: (title: string, draft: AssessmentDraft) => void }) {
  const [title, setTitle] = useState(lesson.title);
  const [duration, setDuration] = useState(lesson.assessment?.duration ?? (lesson.duration && lesson.duration > 0 ? String(Math.ceil(lesson.duration / 60)) : "60"));
  const [instructions, setInstructions] = useState(lesson.assessment?.instructions ?? "");
  const [cfg, setCfg] = useState<ExamConfigForm>(lesson.assessment?.cfg ?? { ...DEFAULT_CONFIG, category: assessmentCategories(type)[0], maxAttempts: "1" });
  const [showErrors, setShowErrors] = useState(false);
  const error = assessmentIssue(type, title, { cfg, duration, instructions });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
      <DialogHeader><DialogTitle>Configure {type === "QUIZ" ? "Quiz" : type === "EXAM" ? "Exam" : "Assignment"} lesson</DialogTitle>
        <DialogDescription>Configuration stays in this Course preview until Create Draft Course. Use Manage questions to select questions.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto p-1">
        <ExamConfigFields title={title} setTitle={setTitle} duration={duration} setDuration={setDuration} cfg={cfg} setCfg={setCfg} showErrors={showErrors} showCourseLink={false} categoryOptions={assessmentCategories(type)} />
        <label className="grid gap-2 text-sm font-medium">Assessment instructions
          <Textarea value={instructions} maxLength={12000} onChange={event => setInstructions(event.target.value)} placeholder="Tell students how to complete this assessment." />
        </label>
        {showErrors && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter className="shrink-0 border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={() => { setShowErrors(true); if (!error) onApply(title.trim(), { cfg, duration, instructions: instructions.trim() }); }}>Apply to Preview</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
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
  let weightHundredths = 0;
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
      const issue = draftSaveIssue(lesson);
      if (issue) return `“${lesson.title}”: ${issue}`;
      if (isAssessmentLesson(lesson.contentType ?? "TEXT") && lesson.assessment) {
        weightHundredths += Math.round(Number(lesson.assessment.cfg.courseWeight || 0) * 100);
      }
    }
  }
  if (weightHundredths > 10000) return "Total Course assessment weights must not exceed 100%.";
  if (totalLessons > 1000) return "Course can contain at most 1000 Lessons.";
  return null;
}

function backendError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { errors?: Record<string, string[]>; message?: string } | undefined;
    const items = data?.errors && Object.values(data.errors).flat();
    if (items?.length) return items.join("; ");
    if (error.response?.status === 403) return "You do not have sufficient permissions.";
    if (error.response?.status === 409) return data?.message ?? "Course name or Syllabus Topic scope already exists.";
    if (data?.message) return data.message;
    if (!error.response) return "Cannot connect to the Backend.";
  }
  return "Could not create the Course. Please check your input and try again.";
}

const lessonIcons: Record<LessonContentType, typeof FileText> = {
  TEXT: FileText, VIDEO: Video, AUDIO: Music2, DOCUMENT: FolderOpen,
  LINK: Link2, QUIZ: ClipboardList, EXAM: GraduationCap, ASSIGNMENT: ClipboardList,
};
const lessonTypeLabel = (type: LessonContentType) =>
  LESSON_CONTENT_TYPE_OPTIONS.find(option => option.value === type)?.label ?? type;

const iconButton = "rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

export default function CreateCourseFromSyllabusPage() {
  const { id } = useParams<{ id: string }>();
  const syllabusId = Number(id);
  const validId = Number.isSafeInteger(syllabusId) && syllabusId > 0;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [assessmentEditor, setAssessmentEditor] = useState<{ sectionKey: string; lessonKey: string; type: AssessmentType } | null>(null);
  const editingAssessmentLesson = assessmentEditor ? draftSections.find(s => s.key === assessmentEditor.sectionKey)?.lessons.find(l => l.key === assessmentEditor.lessonKey) : undefined;
  const questionSection = searchParams.get("draftSection");
  const questionLesson = searchParams.get("draftQuestions");
  const questionTarget = questionSection && questionLesson ? draftSections.find(s => s.key === questionSection)?.lessons.find(l => l.key === questionLesson) : undefined;
  const questionDraft = questionTarget?.assessment;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [uploadingLessonKey, setUploadingLessonKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [scopeMode, setScopeMode] = useState<CourseScopeMode>("FULL");
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [appliedScopeSignature, setAppliedScopeSignature] = useState("FULL");
  const [outlineEdited, setOutlineEdited] = useState(false);
  const [creationMode, setCreationMode] = useState<"MANUAL" | "AI">("AI");
  const [aiInstruction, setAiInstruction] = useState("");
  const researchExternal = false; // Text-only pilot: no optional external research calls
  const [appliedResources, setAppliedResources] = useState<CourseAiResource[]>([]);
  const [aiProposal, setAiProposal] = useState<{ suggestion: CourseAiSuggestion; signature: string } | null>(null);
  // A single Backend job handles the whole Course. It can outlive the current page
  // and is restored from this tab's session storage if the page is reloaded.
  const [aiJob, setAiJob] = useState<CourseAiJob | null>(null);
  const [aiJobSignature, setAiJobSignature] = useState("");
  const [aiFeedback, setAiFeedback] = useState<{ kind: "error" | "info"; message: string } | null>(null);
  const currentScopeSignature = scopeSignature(scopeMode, selectedTopicIds);
  const scopePending = currentScopeSignature !== appliedScopeSignature;
  const sourceTopicCount = source ? allSourceTopicIds(source).length : 0;
  const selectedCount = scopeMode === "FULL" ? sourceTopicCount : selectedTopicIds.length;
  // Backend identity is the canonical SET of Topic IDs; Full == Focused (all selected).
  const effectiveTopicIds = source ? (scopeMode === "FULL" ? allSourceTopicIds(source) :
    selectedTopicIds.filter((topicId) => allSourceTopicIds(source).includes(topicId))) : [];
  const effectiveTopicKey = [...new Set(effectiveTopicIds)].sort((a, b) => a - b).join(",");
  // Prompt and research changes also invalidate a pending AI suggestion.
  const generationSignature = `${syllabusId}|${effectiveTopicKey}|${aiInstruction.trim()}|${researchExternal}`;
  const aiJobStorageKey = `lms-m3-ai-course-job-${syllabusId}`;
  const generationSignatureRef = useRef(generationSignature);
  generationSignatureRef.current = generationSignature;
  const startingAiRef = useRef(false);
  const aiJobIsActive = aiJob?.status === "QUEUED" || aiJob?.status === "RUNNING";
  const aiJobMatches = aiJobSignature === generationSignature;
  const aiIsPartial = aiJobMatches && aiJob?.status === "PARTIAL";
  const aiIsComplete = aiJobMatches && aiJob?.status === "COMPLETED";
  useEffect(() => { setAiFeedback(null); }, [generationSignature]);
  const scopeCheckQuery = useQuery({
    queryKey: ["syllabus-course-source-scope", syllabusId, effectiveTopicKey],
    queryFn: () => courseApi.checkFromSyllabusScope(syllabusId, effectiveTopicIds),
    enabled: validId && allowed && Boolean(source) && effectiveTopicIds.length > 0,
    retry: false, refetchOnWindowFocus: false,
  });

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
      lessons: section.lessons.map((lesson) => ({ key: lesson.key, title: lesson.title, sourceTopicId: lesson.sourceTopicId, material: "", contentType: "TEXT", contentUrl: "" })),
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
    setExpanded(initial.length ? [initial[0].key] : []);
    setAssessmentEditor(null);
    setDirty(Boolean(restored));
    setShowValidation(false);
    setAiProposal(null);
    setAppliedResources([]);
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

  const hasLearningLesson = draftSections.some(section => section.lessons.some(
    lesson => !isAssessmentLesson(lesson.contentType ?? "TEXT")));
  const courseError = useMemo(() => validateDraft(courseName, description, draftSections)
    ?? (draftSections.some(s => s.lessons.some(l => isAssessmentLesson(l.contentType ?? "TEXT") && Boolean(l.assessment))) && !hasPermission("EXAM_CREATE") ? "Assessment creation permission is required." : null)
    ?? (draftSections.some(s => s.lessons.some(l => Boolean(l.assessment?.questions?.length))) && !hasPermission("QUESTION_READ") ? "Question library permission is required." : null)
    ?? (appliedResources.length > 0 && !hasLearningLesson
      ? "Remove the external references or add a learning Lesson to attach them." : null),
    [courseName, description, draftSections, appliedResources.length, hasLearningLesson, hasPermission]);
  const lessonCount = draftSections.reduce((sum, section) => sum + section.lessons.length, 0);
  const mappedTopicIds = draftSections.flatMap((section) => section.lessons
    .map((lesson) => lesson.sourceTopicId).filter((id): id is number => id != null));
  const mappingComplete = effectiveTopicIds.length > 0 &&
    mappedTopicIds.every((id) => effectiveTopicIds.includes(id)) &&
    effectiveTopicIds.every((id) => mappedTopicIds.includes(id));
  const materialCount = draftSections.reduce((n, section) => n + section.lessons.filter(l => !draftLessonIssue(l)).length, 0);
  const materialsReady = lessonCount > 0 && draftSections.every(section => section.lessons.every(l => !draftSaveIssue(l)));

  const reflectAiJob = (job: CourseAiJob, signature: string) => {
    setAiJob(job);
    setAiJobSignature(signature);
    if (job.suggestion) setAiProposal({ suggestion: job.suggestion, signature });
    if (signature !== generationSignatureRef.current) return;
    if (job.status === "COMPLETED") {
      setAiFeedback({ kind: "info", message:
        `Course preview ready: ${job.done}/${job.total} Lesson entries generated. Text content is written; planned activities need setup before publishing. Review before applying.` });
    } else if (job.status === "PARTIAL" || job.status === "FAILED") {
      setAiFeedback({ kind: "error", message:
        `${job.done}/${job.total} Lesson entries generated. ${job.error ?? "AI generation was interrupted."} `
        + "Generated content is retained in the Backend. Retry the remaining Lessons when the service is available." });
    }
  };

  const startAiJobMutation = useMutation({
    mutationFn: (args: { ids: number[]; instruction: string; signature: string; mode: CourseScopeMode }) =>
      courseApi.startFromSyllabusAiJob(syllabusId, args.ids, args.instruction),
    onSuccess: (job, args) => {
      setAiProposal(null);
      try { window.sessionStorage.setItem(aiJobStorageKey,
        JSON.stringify({ jobId: job.jobId, signature: args.signature,
          ids: args.ids, instruction: args.instruction, mode: args.mode })); }
      catch { /* Browser storage may be blocked; polling still works in this tab. */ }
      reflectAiJob(job, args.signature);
    },
    onError: (error: unknown) => setAiFeedback({ kind: "error", message: backendError(error) }),
    onSettled: () => { startingAiRef.current = false; },
  });
  const resumeAiJobMutation = useMutation({
    mutationFn: (jobId: string) => courseApi.resumeFromSyllabusAiJob(syllabusId, jobId),
    onSuccess: (job) => { setAiFeedback(null); reflectAiJob(job, aiJobSignature); },
    onError: (error: unknown) => setAiFeedback({ kind: "error", message: backendError(error) }),
  });

  // Read-only polls: no repeated Generate POSTs from the browser.
  useEffect(() => {
    if (!aiJob?.jobId || !aiJobIsActive) return;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const next = await courseApi.getFromSyllabusAiJob(syllabusId, aiJob.jobId);
        if (!cancelled) reflectAiJob(next, aiJobSignature);
      } catch (error) {
        if (!cancelled) setAiFeedback({ kind: "error", message:
          `Could not read generation progress. ${backendError(error)} You can reload this page to reconnect.` });
      } finally { inFlight = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [aiJob?.jobId, aiJob?.status, syllabusId, aiJobSignature]);

  // Resume tracking after a page reload; jobs live in Backend memory for a limited time.
  useEffect(() => {
    if (!validId || !source) return;
    let entry: string | null = null;
    try { entry = window.sessionStorage.getItem(aiJobStorageKey); } catch { return; }
    if (!entry) return;
    let cancelled = false;
    try {
      const saved = JSON.parse(entry) as { jobId?: string; signature?: string;
        ids?: number[]; instruction?: string; mode?: CourseScopeMode };
      if (!saved.jobId || !saved.signature) return;
      void courseApi.getFromSyllabusAiJob(syllabusId, saved.jobId).then(job => {
        if (cancelled) return;
        // Restore the exact source scope for a focused job; do not mutate Course edits.
        if (saved.mode === "FOCUSED" && Array.isArray(saved.ids)) {
          const validIds = new Set(allSourceTopicIds(source));
          setScopeMode("FOCUSED");
          setSelectedTopicIds(saved.ids.filter(id => validIds.has(id)));
        }
        if (saved.instruction !== undefined) setAiInstruction(saved.instruction);
        reflectAiJob(job, saved.signature!);
      }).catch(() => { if (!cancelled) try { window.sessionStorage.removeItem(aiJobStorageKey); } catch { /* ignore */ } });
    } catch { try { window.sessionStorage.removeItem(aiJobStorageKey); } catch { /* ignore */ } }
    return () => { cancelled = true; };
  }, [syllabusId, validId, source]);

  const generateAi = () => {
    if (!source || !effectiveTopicIds.length || aiJobIsActive || startAiJobMutation.isPending
      || resumeAiJobMutation.isPending || createMutation.isPending || startingAiRef.current) return;
    if (effectiveTopicIds.length > 80) { toast.error("Select at most 80 Topics for AI generation."); return; }
    if (aiJob && aiJob.done > 0 && !window.confirm("Start a new AI generation? The previous generated result will be replaced. Your editable Course draft is kept.")) return;
    startingAiRef.current = true;
    setAiFeedback(null);
    startAiJobMutation.mutate({ ids: effectiveTopicIds, instruction: aiInstruction,
      signature: generationSignature, mode: scopeMode });
  };
  const applyAi = () => {
    if (!aiProposal || aiProposal.signature !== generationSignature || createMutation.isPending) return;
    if ((dirty || outlineEdited) && !window.confirm("Apply AI suggestion? It will replace the current Course Sections and Lessons. Course settings and Syllabus Source stay unchanged.")) return;
    const suggestion = aiProposal.suggestion;
    const next: DraftSection[] = suggestion.sections.map((section, i) => ({
      key: `ai-section-${i}-${nextKey()}`, title: section.title,
      lessons: section.lessons.map((title, j) => ({
        key: nextKey(), title, sourceTopicId: section.sourceTopicIds?.[j] ?? null,
        material: section.lessonMaterials?.[j] ?? "",
        contentType: section.lessonTypes?.[j] ?? "TEXT",
        contentUrl: section.lessonUrls?.[j] ?? "",
        duration: section.lessonDurations?.[j] ?? 0,
        planned: (section.lessonTypes?.[j] ?? "TEXT") !== "TEXT",
      })),
    }));
    setDraftSections(next);
    setExpanded(next.length ? [next[0].key] : []);
    // Keep the available name and user-selected settings (AI job returns generic metadata).
    // Applying replaces the outline only after explicit confirmation, not Course settings.
    setAppliedScopeSignature(currentScopeSignature);
    setOutlineEdited(true); setDirty(true); setShowValidation(false);
    setAppliedResources(suggestion.resources ?? []);
    setAiProposal(null);
  };

  const createMutation = useMutation({
    mutationFn: () => courseApi.createCustomizedFromSyllabus({
      course: { syllabusId, name: clean(courseName), description: description.trim(), status: "DRAFT", level: courseLevel, categoryIds },
      sections: draftSections.map((section) => ({
        title: clean(section.title), lessons: section.lessons.map((lesson) => clean(lesson.title)),
        sourceTopicIds: section.lessons.map((lesson) => lesson.sourceTopicId ?? null),
        lessonMaterials: section.lessons.map((lesson) => isAssessmentLesson(lesson.contentType ?? "TEXT") ? lesson.assessment?.instructions ?? "" : lesson.material?.trim() ?? ""),
        lessonTypes: section.lessons.map((lesson) => lesson.contentType ?? "TEXT"),
        lessonUrls: section.lessons.map((lesson) => requiresResourceUrl(lesson.contentType ?? "TEXT") ? lesson.contentUrl?.trim() ?? "" : ""),
        lessonDurations: section.lessons.map((lesson) => isAssessmentLesson(lesson.contentType ?? "TEXT") && lesson.assessment ? Number(lesson.assessment.duration) * 60 : lesson.duration ?? 0),
        lessonAssessments: section.lessons.map((lesson) => isAssessmentLesson(lesson.contentType ?? "TEXT") && lesson.assessment ? { ...buildExamRequest(clean(lesson.title), lesson.assessment.duration, lesson.assessment.cfg, true), questionIds: lesson.assessment.questions?.length ? lesson.assessment.questions.map(q => q.id) : undefined } : null),
      })),
      selectedTopicIds: effectiveTopicIds,
      resources: appliedResources,
    }),
    onSuccess: async (created) => {
      setDirty(false);
      clearWorkspaceDraft(syllabusId);
      toast.success("Draft Course created. Lesson content is editable in Course Curriculum.");
      await queryClient.invalidateQueries({ queryKey: ["section-courses"] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-course-usage"] });
      await Promise.all(["lessons", "exam-management", "course-exams", "curriculum", "course-assessment-allocation", "course-assessment-plan", "course-selected-curriculum", "section-lessons"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
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
  /** Reuses the same Lesson upload endpoints as Course Manager (Audio / Document). */
  const uploadLessonFile = async (sectionKey: string, lessonKey: string, type: "AUDIO" | "DOCUMENT", file?: File) => {
    if (!file || uploadingLessonKey) return;
    if (file.size === 0 || file.size > 25 * 1024 * 1024) {
      toast.error("Choose a non-empty file up to 25 MB."); return;
    }
    if (type === "AUDIO" && (!file.type.startsWith("audio/") || !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name))) {
      toast.error("Supported audio files: MP3, WAV, OGG, M4A, AAC, FLAC, WEBM."); return;
    }
    if (type === "DOCUMENT" && !/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(file.name)) {
      toast.error("Supported documents: PDF, Office files and TXT."); return;
    }
    setUploadingLessonKey(lessonKey);
    try {
      const response = type === "AUDIO" ? await lessonApi.uploadAudio(file) : await lessonApi.uploadDocument(file);
      updateSection(sectionKey, row => ({ ...row, lessons: row.lessons.map(item =>
        item.key === lessonKey && item.contentType === type ? { ...item, contentUrl: response.url } : item) }));
      toast.success("Resource uploaded and added to the Lesson.");
    } catch (error) {
      toast.error(backendError(error));
    } finally {
      setUploadingLessonKey(null);
    }
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
    setExpanded(initial.length ? [initial[0].key] : []);
    setAssessmentEditor(null);
    setScopeMode("FULL");
    setSelectedTopicIds(allSourceTopicIds(source));
    setAppliedScopeSignature("FULL");
    setOutlineEdited(false);
    setShowValidation(false);
    setDirty(false);
    setAiProposal(null);
    setAppliedResources([]);
  };
  /** Keeps Topic IDs internal; educators need not manage IDs in the Course editor. */
  const restoreCoverage = () => {
    if (!source || !effectiveTopicIds.length || createMutation.isPending) return;
    const missing = effectiveTopicIds.filter((id) => !mappedTopicIds.includes(id));
    const titles = new Map(source.sections.flatMap((section) => section.topics.map((topic) => [topic.id, topic.title] as const)));
    const restored = missing.map((id) => ({ key: nextKey(), title: titles.get(id) ?? "Required Topic", sourceTopicId: id }));
    // Older mappings may no longer be in the selected source scope.
    const cleaned = draftSections.map((section) => ({ ...section, lessons: section.lessons.map((lesson) =>
      lesson.sourceTopicId != null && !effectiveTopicIds.includes(lesson.sourceTopicId)
        ? { ...lesson, sourceTopicId: null } : lesson) }));
    const target = cleaned.find((s) => titleKey(s.title) === titleKey("Required Syllabus Topics"));
    const next = !restored.length ? cleaned : target
      ? cleaned.map((s) => s.key === target.key ? { ...s, lessons: [...s.lessons, ...restored] } : s)
      : cleaned.length >= 100
        ? cleaned.map((s, i) => i === 0 ? { ...s, lessons: [...s.lessons, ...restored] } : s)
        : [...cleaned, { key: nextKey(), title: "Required Syllabus Topics", lessons: restored }];
    setDraftSections(next);
    setExpanded(next.map((s) => s.key));
    setDirty(true);
    setOutlineEdited(true);
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
    setExpanded(outline.length ? [outline[0].key] : []);
    setOutlineEdited(false);
    setAppliedScopeSignature(currentScopeSignature);
    setAppliedResources([]); // old links may no longer match this source Topic selection
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
    if (!mappingComplete) {
      toast.error("Every selected Topic needs at least one linked Lesson. Restore or expand its Lessons, or change your source selection.");
      return;
    }
    if (courseError || nameIsDuplicate || createMutation.isPending || uploadingLessonKey || !source) return;
    createMutation.mutate();
  };

  const closeQuestions = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("draftSection"); params.delete("draftQuestions");
    setSearchParams(params, { replace: true });
  };
  const questionsOpen = Boolean(!createMutation.isPending && allowed && hasPermission("EXAM_CREATE") && hasPermission("QUESTION_READ") && questionTarget && questionDraft && isAssessmentLesson(questionTarget.contentType ?? "TEXT") && !assessmentIssue(questionTarget.contentType as AssessmentType, questionTarget.title, questionDraft));
  return (<>
    {/* Keep the existing Course form mounted, including native disclosure and AI state. */}
    <div className={questionsOpen ? "hidden" : "contents"}>
    <MainLayout pathName={{ syllabuses: "Syllabuses", "create-course": "Create Course" }}>
      <div className="w-full min-w-0 space-y-4 pb-8">
        <Link to={`/syllabuses/${id ?? ""}`} onClick={(event) => { if (!confirmLeaving()) event.preventDefault(); }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Syllabus Detail
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Course from Syllabus</h1>
            <p className="mt-1 text-sm text-muted-foreground">Generate a complete Course with Lesson Materials. Compare, refine, and save only when ready.</p>
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
            <div className="rounded-lg border bg-card px-3 py-2" aria-label="Course creation mode">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Creation mode</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Manual editing or AI-assisted Course creation</p>
                </div>
                <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-1">
                  <Button type="button" size="sm" variant={creationMode === "MANUAL" ? "default" : "ghost"} onClick={() => setCreationMode("MANUAL")}><BookPlus className="size-3.5"/> Manual</Button>
                  <Button type="button" size="sm" variant={creationMode === "AI" ? "default" : "ghost"} onClick={() => setCreationMode("AI")}><Sparkles className="size-3.5"/> Create with AI</Button>
                </div>
              </div>
            </div>
            {(Boolean(scopeCheckQuery.data?.sameScopeCourseCount) || Boolean(scopeCheckQuery.data?.legacyUnverifiedCourseCount) || linkedCourses.length > 0) && <details className="group rounded-lg border bg-card p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 break-words">Existing Course links and duplicate checks · {linkedCourses.length} linked</span>
                <CourseDisclosureChevron native />
              </summary>
            {Boolean(scopeCheckQuery.data?.sameScopeCourseCount) && <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4"/> Similar source scope found</div>
              <p className="mt-1 text-xs">{scopeCheckQuery.data?.sameScopeCourseCount} Course(s) already use these Topic IDs. You may create a genuinely different outline, but identical Section/Lesson structures and duplicate Course names will be rejected by the Backend.</p>
              {scopeCheckQuery.data?.existingCourseId && <Link className="text-xs underline" to={`/courses/${scopeCheckQuery.data.existingCourseId}`} target="_blank" rel="noreferrer">Review an existing Course</Link>}
            </div>}
            {Boolean(scopeCheckQuery.data?.legacyUnverifiedCourseCount) && <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0"/><span>{scopeCheckQuery.data?.legacyUnverifiedCourseCount} existing Course(s) are missing source Topic ID metadata. Check them manually; exact-scope matching cannot be guaranteed for older Course records.</span></div>}
            {linkedCourses.length > 0 && <div className="rounded-xl border bg-card px-4 py-3 text-sm" role="status">
              <p className="font-medium">This Syllabus is linked to {linkedCourses.length} existing Course{linkedCourses.length === 1 ? "" : "s"}.</p>
              <p className="mt-1 text-xs text-muted-foreground">Review before creating a duplicate. Identical Course names and outlines are blocked.</p>
              <div className="mt-2 flex flex-wrap gap-2">{linkedCourses.slice(0, 4).map((linked) => <Link key={linked.id} to={`/courses/${linked.id}`} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs hover:bg-accent">{linked.name} ({linked.status})</Link>)}{linkedCourses.length > 4 && <span className="text-xs text-muted-foreground">+{linkedCourses.length - 4} more</span>}</div>
            </div>}
            </details>}
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(270px,0.36fr)_minmax(0,0.64fr)]">
              <SyllabusSourcePreviewPanel source={source} syllabusId={syllabusId}
                scopeMode={scopeMode} onScopeModeChange={setScopeMode}
                selectedTopicIds={selectedTopicIds} onToggleTopic={toggleTopic} onToggleSection={toggleSection}
                selectedCount={selectedCount} scopePending={scopePending} onApplyScope={applyScope}
                selectionDisabled={createMutation.isPending} compact />
              <section className="min-w-0 space-y-4 rounded-xl border bg-card p-3 sm:p-4" aria-label="Editable Course preview">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold"><BookPlus className="size-4"/> New Course</h2>
                  <Badge variant="outline">Draft • Editable</Badge>
                </div>
                {creationMode === "AI" && <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4"/> AI Course Generator</h3>
                    <Badge variant="secondary">{effectiveTopicIds.length} selected Topics</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">One-click Course generation: AI writes Text lessons and plans relevant video, audio, reading and assessment activities. All selected Syllabus Topics stay covered.</p>
                  <label className="text-xs font-medium" htmlFor="ai-course-instructions">Instructions (Vietnamese or English)</label>
                  <Textarea id="ai-course-instructions" aria-label="AI Course instructions" value={aiInstruction} maxLength={1000} rows={3} placeholder="Ví dụ: Tạo khóa học nhập môn có nhiều bài thực hành. Output is always English." onChange={(event) => setAiInstruction(event.target.value)} />
                  <p className="text-xs text-muted-foreground">AI uses exactly the currently selected Topics ({effectiveTopicIds.length}). No separate Apply Topic Selection is required for generation. Text content is generated; other Lesson types are editable headings with estimated durations. Add resources or configure assessments before publishing.</p>
                  {effectiveTopicIds.length > 80 && <p role="alert" className="text-xs text-destructive">Select at most 80 Topics for AI generation.</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={generateAi}
                      disabled={aiJobIsActive || startAiJobMutation.isPending || resumeAiJobMutation.isPending || createMutation.isPending || !effectiveTopicIds.length || effectiveTopicIds.length > 80 || scopeCheckQuery.isFetching}>
                      <Sparkles className="size-3.5"/>{aiJobIsActive || startAiJobMutation.isPending ? "Generating Course…" : aiIsComplete ? "Regenerate Course" : "Generate Course"}
                    </Button>
                    {aiIsPartial || (aiJobMatches && aiJob?.status === "FAILED") ?
                      <Button type="button" variant="outline" size="sm" disabled={resumeAiJobMutation.isPending || aiJobIsActive}
                        onClick={() => aiJob && resumeAiJobMutation.mutate(aiJob.jobId)}>
                        <RefreshCw className="size-3.5"/> Retry remaining Lessons
                      </Button> : null}
                  </div>
                  {aiJob && <div className="space-y-1.5 rounded-md border bg-background/60 p-3" role="status">
                    <div className="flex flex-wrap justify-between gap-2 text-xs">
                      <span className="font-medium">{aiJobIsActive ? "Generating your Course" : aiJob.status === "COMPLETED" ? "Course ready for review" : "Course generation paused"}</span>
                      <span className="tabular-nums">{aiJob.done}/{aiJob.total} Lessons ready</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${aiJob.total ? aiJob.done / aiJob.total * 100 : 0}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{aiJob.stage}{!aiJobMatches ? " · Selection or instructions have changed since this job started." : ""}</p>
                  </div>}
                  {aiFeedback && <div
                    role={aiFeedback.kind === "error" ? "alert" : "status"}
                    className={`rounded-md border px-3 py-2 text-xs ${aiFeedback.kind === "error" ? "border-destructive/30 bg-destructive/5 text-foreground" : "border-border bg-muted/30 text-muted-foreground"}`}
                  >
                    <p className="font-medium">{aiFeedback.kind === "error" ? "Course generation needs attention" : "Course generation update"}</p>
                    <p className="mt-1 break-words">{aiFeedback.message}</p>
                    {aiFeedback.kind === "error" && <p className="mt-1 text-muted-foreground">Nothing has been saved to the database. Incomplete Text content must be generated or edited before saving. Planned non-Text headings may be saved in Draft.</p>}
                  </div>}
                  {aiProposal && <div className="space-y-2 rounded-md border bg-background/70 p-3">
                    <p className="text-sm font-semibold">{aiIsPartial && aiProposal.signature === generationSignature ? "Course preview — incomplete" : "Unsaved AI suggestion"}</p>
                    {aiProposal.signature !== generationSignature ? <p role="status" className="text-xs text-amber-600">Syllabus Topics, instructions or research preference changed. Generate again before applying.</p> : <>
                      {aiIsPartial && <p role="status" className="text-xs text-muted-foreground">{aiJob?.done}/{aiJob?.total} Lesson entries generated. Remaining Text Lessons are still in the outline, ready for retry or manual editing.</p>}
                      <p className="text-sm">{courseName}</p>
                      <p className="text-xs text-muted-foreground">{aiProposal.suggestion.sections.length} Sections · {aiProposal.suggestion.sections.reduce((n, section) => n + section.lessons.length, 0)} Lessons · {aiProposal.suggestion.sections.reduce((n, section) => n + (section.lessonMaterials?.filter(m => m.trim().length >= 80).length ?? 0), 0)} Lessons with content · {courseLevel}</p>
                      <div className="max-h-56 overflow-y-auto space-y-2 text-xs">{aiProposal.suggestion.sections.map((section, i) => <div key={i}><strong>{section.title}</strong><ul className="list-inside list-disc text-muted-foreground">{section.lessons.map((title, j) => <li key={j}>{title} <span className="text-muted-foreground">· {lessonTypeLabel(section.lessonTypes?.[j] ?? "TEXT")}</span></li>)}</ul></div>)}</div>
                      {aiProposal.suggestion.researchStatus === "GROUNDED_SOURCES_FOUND" && <p className="text-xs text-green-600">Research-informed outline · {aiProposal.suggestion.resources.length} verified references used as evidence.</p>}
                      {Boolean(aiProposal.suggestion.resources?.length) && <div className="space-y-1 border-t pt-2 text-xs">
                        <strong>Grounded external references</strong>
                        {aiProposal.suggestion.resources.map((r, i) => <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block break-all underline underline-offset-2">{r.title} <ExternalLink className="inline size-3"/></a>)}
                        <p className="text-muted-foreground">Verified external links are additional reading; original instructional Material is generated for each Lesson.</p>
                      </div>}
                      {aiProposal.suggestion.researchStatus === "NO_GROUNDED_SOURCES" && <p role="status" className="text-xs text-muted-foreground">Course generated from the selected Syllabus Topics. No verified external references were available, so no media links were added.</p>}
                      <Button type="button" size="sm" onClick={applyAi} disabled={createMutation.isPending || aiJobIsActive || startAiJobMutation.isPending || resumeAiJobMutation.isPending}>{aiIsPartial ? "Apply Incomplete Draft for Manual Editing" : "Apply AI Suggestion to Draft"}</Button>
                    </>}
                  </div>}
                  <p className="text-xs text-muted-foreground">One click starts a Backend generation job. You can return to this tab to view progress; generated work is kept in Backend memory until the job expires or Backend restarts. Nothing is saved to Course until you apply and create the Draft.</p>
                </div>}
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
                <details className="group rounded-lg border p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 break-words">Course settings · Level, Categories, Description</span>
                    <CourseDisclosureChevron native />
                  </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                </details>
              </section>
            </div>
            <section className="min-w-0 space-y-4 rounded-xl border bg-card p-3 sm:p-4" aria-label="Editable Course sections and lessons">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><BookPlus className="size-4" /> Course Sections &amp; Lessons</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Editable outline • Not yet saved</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={createMutation.isPending} onClick={reset}>
                    <RotateCcw className="size-3.5" /> Reset
                  </Button>
                </div>
                {!scopePending && !mappingComplete && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 p-3 text-xs text-destructive" role="alert">
                  <span>Some source Topics are not covered by the current Course outline.</span>
                  <Button type="button" size="sm" variant="outline" onClick={restoreCoverage} disabled={createMutation.isPending}>Restore missing Lessons</Button>
                </div>}
                {scopePending && <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs" role="status">You changed the Syllabus scope. Apply it in the left panel before creating the Course. Existing manual edits are kept until you confirm replacement.</div>}
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[["Sections", draftSections.length], ["Lessons", lessonCount], ["Content-ready Lessons", `${materialCount}/${lessonCount}`], ["Topics covered", `${new Set(mappedTopicIds).size}/${effectiveTopicIds.length}`]].map(([label, value]) => <div key={label} className="min-w-0 rounded-md border bg-muted/20 p-2"><p className="text-base font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
                </div>
                <CourseCoveragePanel source={source} selectedIds={effectiveTopicIds} draft={draftSections.map(section => ({ ...section, lessons: section.lessons.map(lesson => ({ ...lesson, assessmentIssue: isAssessmentLesson(lesson.contentType ?? "TEXT") && lesson.assessment ? draftLessonIssue(lesson) : null })) }))} focused={scopeMode === "FOCUSED"} />
                {appliedResources.length > 0 && <div className="mb-3 space-y-2 rounded-lg border p-3 text-xs">
                  <strong>External learning references ({appliedResources.length})</strong>
                  <p className="text-muted-foreground">{hasLearningLesson ? "These verified references are attached to the first non-assessment Lesson. Individual media links remain editable below." : "Remove these references or add a learning Lesson before saving. Assessment headings never contain learning references."}</p>
                  {appliedResources.map((r, i) => <div key={`${r.url}-${i}`} className="flex items-center justify-between gap-2"><a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate underline">{r.title}</a><Button type="button" size="sm" variant="ghost" onClick={() => { setAppliedResources(items => items.filter((_, index) => index !== i)); setDirty(true); }}>Remove</Button></div>)}
                </div>}
                <div className="space-y-3">
                  {draftSections.map((section, index) => {
                    const isExpanded = expanded.includes(section.key);
                    return (
                      <div key={section.key} className="rounded-lg border">
                        <div className="flex min-w-0 flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
                          <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                          <Input aria-label={`Section ${index + 1} title`} value={section.title} maxLength={150} disabled={createMutation.isPending}
                            onChange={(event) => updateSection(section.key, (s) => ({ ...s, title: event.target.value }))} className="min-w-[140px] flex-1 font-semibold" />
                          <button type="button" className={iconButton} disabled={index === 0 || createMutation.isPending} onClick={() => moveSection(index, -1)} aria-label={`Move Section ${index + 1} up`} title="Move up"><ArrowUp className="size-4" /></button>
                          <button type="button" className={iconButton} disabled={index === draftSections.length - 1 || createMutation.isPending} onClick={() => moveSection(index, 1)} aria-label={`Move Section ${index + 1} down`} title="Move down"><ArrowDown className="size-4" /></button>
                          <button type="button" className={`${iconButton} hover:text-destructive`} disabled={createMutation.isPending} onClick={() => { setDraftSections((rows) => rows.filter((row) => row.key !== section.key)); setDirty(true); setOutlineEdited(true); }} aria-label={`Remove Section ${index + 1}`} title="Remove Section"><Trash2 className="size-4" /></button>
                          <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${isExpanded ? "Collapse" : "Expand"} Section ${index + 1}`} aria-expanded={isExpanded} onClick={() => setExpanded((current) => isExpanded ? current.filter((key) => key !== section.key) : [...current, section.key])}>
                            <CourseDisclosureChevron open={isExpanded} />
                          </button>
                        </div>
                        {isExpanded && <div className="space-y-2 p-3">
                          {section.lessons.map((lesson, lessonIndex) => {
                            const type = lesson.contentType ?? "TEXT";
                            const Icon = lessonIcons[type];
                            const assessment = isAssessmentLesson(type);
                            const issue = draftLessonIssue(lesson);
                            const planned = Boolean(lesson.planned && issue && !draftSaveIssue(lesson));
                            const optionalAssessment = assessment && !lesson.assessment;
                            return (
                              <div key={lesson.key} className="min-w-0 rounded-lg border bg-background px-3 py-2">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                  <Input aria-label={`Section ${index + 1} Lesson ${lessonIndex + 1} title`} value={lesson.title} maxLength={200} disabled={createMutation.isPending}
                                    onChange={(event) => updateSection(section.key, row => ({ ...row, lessons: row.lessons.map(item => item.key === lesson.key ? { ...item, title: event.target.value } : item) }))}
                                    className="h-9 min-w-0 flex-[1_1_220px] font-medium" />
                                  <Badge variant="secondary" className="max-w-full font-normal">{lessonTypeLabel(type)}</Badge>
                                  <div className="flex items-center gap-0.5">
                                    <button type="button" className={iconButton} disabled={lessonIndex === 0 || createMutation.isPending} onClick={() => moveLesson(section.key, lessonIndex, -1)} aria-label="Move Lesson up" title="Move up"><ArrowUp className="size-3.5" /></button>
                                    <button type="button" className={iconButton} disabled={lessonIndex === section.lessons.length - 1 || createMutation.isPending} onClick={() => moveLesson(section.key, lessonIndex, 1)} aria-label="Move Lesson down" title="Move down"><ArrowDown className="size-3.5" /></button>
                                    <button type="button" className={`${iconButton} hover:text-destructive`} disabled={createMutation.isPending} onClick={() => updateSection(section.key, row => ({ ...row, lessons: row.lessons.filter(item => item.key !== lesson.key) }))} aria-label="Remove Lesson" title="Remove Lesson"><Trash2 className="size-3.5" /></button>
                                  </div>
                                </div>
                                <details className="group mt-2 rounded-md border border-border/70 bg-muted/10 px-3 py-2">
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-foreground hover:text-primary [&::-webkit-details-marker]:hidden">
                                    <span className="min-w-0 break-words">Lesson details <span className="font-normal text-muted-foreground">· {optionalAssessment ? "Not configured" : planned ? "Planned" : issue ? "Needs setup" : assessment ? "Configured" : "Ready"}</span></span>
                                    <CourseDisclosureChevron native />
                                  </summary>
                                  <div className="mt-3 space-y-3 border-t pt-3">
                                    <div className={assessment ? "grid items-end gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)]" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
                                      <div className="min-w-0 space-y-1.5">
                                        <label className="text-xs font-medium" htmlFor={`lesson-type-${lesson.key}`}>Content type</label>
                                        <Select value={type} onValueChange={(value) => {
                                          const next = value as LessonContentType;
                                          if (isAssessmentLesson(next) && !hasPermission("EXAM_CREATE")) { toast.error("Assessment creation permission is required."); return; }
                                          if (next !== type && lesson.assessment && !window.confirm("Changing Lesson type will discard its assessment configuration. Continue?")) return;
                                          updateSection(section.key, row => ({ ...row, lessons: row.lessons.map(item => item.key === lesson.key ? { ...item, contentType: next, planned: next === type ? item.planned : false, assessment: next === type ? item.assessment : undefined } : item) }));
                                          if (isAssessmentLesson(next)) setAssessmentEditor({ sectionKey: section.key, lessonKey: lesson.key, type: next as AssessmentType });
                                        }} disabled={createMutation.isPending || uploadingLessonKey === lesson.key}>
                                          <SelectTrigger id={`lesson-type-${lesson.key}`} className="w-full"><SelectValue /></SelectTrigger>
                                          <SelectContent>{LESSON_CONTENT_TYPE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </div>
                                      {!assessment && <div className="min-w-0 space-y-1.5">
                                        <label className="text-xs font-medium" htmlFor={`lesson-duration-${lesson.key}`}>Duration (seconds)</label>
                                        <Input id={`lesson-duration-${lesson.key}`} type="number" min={0} max={2147483647} step={1} value={lesson.duration ?? 0} disabled={createMutation.isPending}
                                          onChange={event => updateSection(section.key, row => ({ ...row, lessons: row.lessons.map(item => item.key === lesson.key ? { ...item, duration: event.target.value === "" ? 0 : Number(event.target.value) } : item) }))} />
                                        {(!Number.isInteger(lesson.duration ?? 0) || (lesson.duration ?? 0) < 0 || (lesson.duration ?? 0) > 2147483647) && <p role="alert" className="text-xs text-destructive">Duration must be a non-negative whole number within range.</p>}
                                      </div>}
                                      {assessment && <div className="min-w-0 flex flex-wrap items-center gap-2">
                                        {!lesson.assessment && lesson.planned && <span className="text-xs text-muted-foreground">Estimated {Math.ceil((lesson.duration ?? 0) / 60)} min</span>}
                                        <Button type="button" variant="outline" className="h-9" disabled={createMutation.isPending || !hasPermission("EXAM_CREATE")} onClick={() => setAssessmentEditor({ sectionKey: section.key, lessonKey: lesson.key, type: type as AssessmentType })}>{lesson.assessment ? "Edit assessment" : "Configure assessment"}</Button>
                                        <Button type="button" variant="outline" className="h-9" disabled={createMutation.isPending || Boolean(uploadingLessonKey) || !hasPermission("EXAM_CREATE") || !hasPermission("QUESTION_READ") || !lesson.assessment || Boolean(issue)} title={!lesson.assessment ? "Configure assessment before selecting questions" : !hasPermission("QUESTION_READ") ? "Question library permission is required" : undefined} onClick={() => {
                                          const params = new URLSearchParams(searchParams);
                                          params.set("draftSection", section.key); params.set("draftQuestions", lesson.key);
                                          setSearchParams(params);
                                        }}>Manage questions ({lesson.assessment?.questions?.length ?? 0})</Button>
                                      </div>}
                                    </div>
                                    {requiresResourceUrl(type) && <div className="space-y-1.5">
                                      <label htmlFor={`lesson-url-${lesson.key}`} className="text-xs font-medium">{lessonTypeLabel(type)} URL</label>
                                      <Input id={`lesson-url-${lesson.key}`} type="url" maxLength={500} value={lesson.contentUrl ?? ""} disabled={createMutation.isPending}
                                        placeholder="https://..." onChange={event => updateSection(section.key, row => ({ ...row, lessons: row.lessons.map(item => item.key === lesson.key ? { ...item, contentUrl: event.target.value } : item) }))} />
                                      <p className="text-xs text-muted-foreground">Use a working external URL. Video lessons use a video URL, as in Course Manager.</p>
                                      {(type === "AUDIO" || type === "DOCUMENT") && <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <label htmlFor={`lesson-file-${lesson.key}`} className="text-xs font-medium">Upload {type === "AUDIO" ? "audio" : "document"} (max 25 MB)</label>
                                        <Input id={`lesson-file-${lesson.key}`} type="file" className="h-auto min-w-0 max-w-sm cursor-pointer py-1.5 text-xs"
                                          accept={type === "AUDIO" ? ".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,audio/*" : ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"}
                                          disabled={createMutation.isPending || Boolean(uploadingLessonKey)}
                                          onChange={event => { void uploadLessonFile(section.key, lesson.key, type, event.target.files?.[0]); event.target.value = ""; }} />
                                        {uploadingLessonKey === lesson.key && <span role="status" className="text-xs text-muted-foreground">Uploading…</span>}
                                      </div>}
                                    </div>}
                                    {assessment ? <div className="space-y-1 text-xs text-muted-foreground">
                                      <p className={issue && !optionalAssessment ? "text-destructive" : undefined}>{optionalAssessment ? "Assessment not configured · Optional for draft" : issue ?? `Configured · ${lesson.assessment?.duration} min · ${lesson.assessment?.questions?.length ?? 0} questions`}</p>
                                      {(lesson.material?.trim() || lesson.contentUrl?.trim()) && <p>Previous learning content is kept in this preview if you switch back, but will not be saved with this assessment.</p>}
                                    </div> : <div className="space-y-1.5">
                                      <label htmlFor={`lesson-material-${lesson.key}`} className="text-xs font-medium">{type === "TEXT" ? "Lesson content" : "Learning notes (optional)"}</label>
                                      <Textarea id={`lesson-material-${lesson.key}`} aria-label={`Material for ${lesson.title}`} value={lesson.material ?? ""}
                                        onChange={event => updateSection(section.key, row => ({ ...row, lessons: row.lessons.map(item => item.key === lesson.key ? { ...item, material: event.target.value } : item) }))}
                                        rows={6} className="min-w-0 resize-y" maxLength={12000} disabled={createMutation.isPending}
                                        placeholder={type === "TEXT" ? "Learning objectives, explanations, practical activities and review." : "Optional notes about this resource."} />
                                      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                                        <span>{planned ? "Planned resource · add URL before publishing." : issue ?? "Content is ready for the Draft Course."}</span>
                                        <span className="tabular-nums">{(lesson.material ?? "").trim().length}/12,000</span>
                                      </div>
                                    </div>}
                                  </div>
                                </details>
                                {lesson.sourceTopicId == null && <span className="mt-2 inline-flex text-xs text-muted-foreground">Additional Lesson</span>}
                              </div>
                            );
                          })}
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
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium"><Check className="size-4 text-green-600" /> Course will be created as Draft</p>
                  <p className="mt-1 text-xs text-muted-foreground">Text requires learning content. Assessment headings and AI-planned resources may be saved in Draft; complete them before publishing. Configured assessments still use the native Assessment Management form. All edits stay in this Course Draft, not the Syllabus.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => { if (confirmLeaving()) navigate(`/syllabuses/${syllabusId}`); }}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || Boolean(uploadingLessonKey) || Boolean(courseError) || nameIsDuplicate || scopePending || !mappingComplete || !materialsReady || scopeCheckQuery.isFetching}>
                    <BookPlus className="size-4" /> {createMutation.isPending ? "Creating Course..." : "Create Draft Course"}
                  </Button>
                </div>
              </div>
              {(showValidation || courseError) && courseError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="size-4" /> {courseError}</p>}
            </div>
          </form>
        )}
        {assessmentEditor && editingAssessmentLesson && <AssessmentPreviewDialog key={`${assessmentEditor.lessonKey}-${assessmentEditor.type}`} lesson={editingAssessmentLesson} type={assessmentEditor.type}
          onClose={() => setAssessmentEditor(null)} onApply={(title, assessment) => {
            const previous = editingAssessmentLesson.assessment?.questions ?? [];
            const allowedTypes = allowedQuestionTypes(assessment.cfg.examType || undefined);
            const questions = previous.filter(q => allowedTypes.includes(q.type));
            if (questions.length !== previous.length && !window.confirm("Changing the question format removes incompatible selected questions. Continue?")) return;
            updateSection(assessmentEditor.sectionKey, row => ({ ...row, lessons: row.lessons.map(item => item.key === assessmentEditor.lessonKey ? { ...item, title, assessment: { ...assessment, questions } } : item) }));
            setAssessmentEditor(null);
          }} />}
      </div>
    </MainLayout>
    </div>
    {questionsOpen && questionTarget && questionDraft && questionSection && questionLesson && <ExamDetailPage key={`${questionSection}:${questionLesson}`} preview={{
      exam: { ...buildExamRequest(clean(questionTarget.title), questionDraft.duration, questionDraft.cfg, true), courseName },
      selected: questionDraft.questions ?? [],
      onBack: () => { if (window.confirm("Return to Course Preview? Unapplied question selections will be discarded.")) closeQuestions(); },
      onSave: questions => {
        updateSection(questionSection, row => ({ ...row, lessons: row.lessons.map(item => item.key === questionLesson && item.assessment ? { ...item, assessment: { ...item.assessment, questions } } : item) }));
        closeQuestions();
      },
    }} />}
  </>);
}
