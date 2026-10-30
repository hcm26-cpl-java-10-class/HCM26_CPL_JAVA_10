import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Layers,
  RefreshCw,
} from "lucide-react";
import {
  classSetupApi,
  type ClassPlanSummary,
  type ClassProgramSubjectItem,
  type ClassProgramSubjects,
  type ClassSetupOverview,
  type ClassSubjectOption,
  type SharedClass,
  type SharedClassRequest,
  type TeachingAssignment,
  type TopicCourseSaveItem,
} from "@/api/features/class-setup.api";
import { programApi, type TrainingProgramResponse } from "@/api/features/program.api";
import { sessionApi } from "@/api/features/demo/session.api";
import type { ImportResult, SessionDTO } from "@/types";
import { ImportModal } from "@/components/datatable/dataio/ImportModal";
import { ImportResultModal } from "@/components/datatable/dataio/ImportResultModal";
import { MainLayout } from "@/components/layout/MainLayout";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { ClassContextCard, type ClassSetupTab } from "./ClassContextCard";
import { ClassCrudDialog, type ClassCrudMode } from "./ClassCrudDialog";
import { ClassSetupListCard, isOverviewClassActive } from "./ClassSetupListCard";
import { PlanSummaryTab } from "./PlanSummaryTab";
import { ProgramSubjectsTab } from "./ProgramSubjectsTab";
import { TopicCoursesTab } from "./TopicCoursesTab";

const VALID_TABS: ClassSetupTab[] = ["program", "courses", "summary"];

const classImportTable = {
  schema: { entityName: "class-setup" },
  importFile: classSetupApi.importClasses,
};

function parseTab(raw: string | null): ClassSetupTab {
  if (raw && VALID_TABS.includes(raw as ClassSetupTab)) {
    return raw as ClassSetupTab;
  }
  return "program";
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if ([502, 503, 504].includes(error.response?.status ?? 0)) {
      return "Dịch vụ dữ liệu dùng chung đang tạm thời không khả dụng. Vui lòng thử tải lại sau.";
    }
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    if (!error.response) return "Không thể kết nối máy chủ backend. Hãy kiểm tra kết nối và thử lại.";
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi khi xử lý kế hoạch môn học của lớp.";
}

function toFallbackSharedClass(item: ClassSetupOverview): SharedClass {
  return {
    id: item.classId,
    code: item.code,
    name: item.name,
    programId: item.programId,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status ?? "active",
    plannedSize: item.plannedSize,
    enrolledCount: item.enrolledCount,
    formatType: item.formatType,
    site: item.site,
    location: item.location,
  };
}

export default function ClassSetupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();

  const canCreateClass = hasPermission("CLASS_CREATE");
  const canUpdateClass = hasPermission("CLASS_UPDATE");
  const canDeleteClass = hasPermission("CLASS_DELETE");
  const canAssignProgram = hasPermission("CLASS_UPDATE_PROGRAM");
  const canUpdateCourse = hasPermission("CLASS_UPDATE_COURSE");
  const canReadCourseCatalog = hasPermission("COURSE_READ");
  const canReadAssignment = hasPermission("ASSIGNMENT_READ");
  const canCreateAssignment = hasPermission("ASSIGNMENT_CREATE");
  const canReadSession = hasPermission("SESSION_READ");
  const canCreateSession = hasPermission("SESSION_CREATE");
  const canReadProgramList = hasPermission("PROGRAM_READ") || canAssignProgram;

  const selectedClassId = searchParams.get("classId") ?? "";
  const activeTab = parseTab(searchParams.get("tab"));

  const [overviewItems, setOverviewItems] = useState<ClassSetupOverview[]>([]);
  const [sharedClasses, setSharedClasses] = useState<SharedClass[]>([]);
  const [programs, setPrograms] = useState<TrainingProgramResponse[]>([]);
  const [sampleData, setSampleData] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [classData, setClassData] = useState<ClassProgramSubjects | null>(null);
  const [planSummary, setPlanSummary] = useState<ClassPlanSummary | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<ClassSubjectOption[]>([]);
  const [ownerAssignments, setOwnerAssignments] = useState<TeachingAssignment[] | null>(null);
  const [ownerSessions, setOwnerSessions] = useState<SessionDTO[] | null>(null);
  const [loadingClass, setLoadingClass] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // State cho CRUD Lớp học & Import Excel
  const [crudDialog, setCrudDialog] = useState<{
    open: boolean;
    mode: ClassCrudMode;
    overview: ClassSetupOverview | null;
  }>({ open: false, mode: "create", overview: null });
  const [classCrudSaving, setClassCrudSaving] = useState(false);
  const [classCrudError, setClassCrudError] = useState("");
  const [pendingDeleteClass, setPendingDeleteClass] = useState<ClassSetupOverview | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);

  const syncUrlParams = useCallback(
    (nextClassId: string, nextTab: ClassSetupTab) => {
      const next = new URLSearchParams(searchParams);
      if (nextClassId) next.set("classId", nextClassId);
      else next.delete("classId");
      next.set("tab", nextTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSelectClass = useCallback(
    (nextClassId: string) => {
      setError("");
      setNotice("");
      syncUrlParams(nextClassId, activeTab);
    },
    [activeTab, syncUrlParams],
  );

  const handleSelectTab = useCallback(
    (nextTab: ClassSetupTab) => {
      syncUrlParams(selectedClassId, nextTab);
    },
    [selectedClassId, syncUrlParams],
  );

  const loadOverviewResources = useCallback(
    async (preferredClassId?: string) => {
      setLoadingOverview(true);
      setOverviewError("");
      try {
        const [overviewResult, sharedResult, programResult, dataSourceResult] =
          await Promise.allSettled([
            classSetupApi.getSetupOverview(),
            classSetupApi.getClasses(),
            canReadProgramList ? programApi.getAll({ status: "ACTIVE" }) : Promise.resolve([]),
            classSetupApi.getDataSource(),
          ]);

        const list = overviewResult.status === "fulfilled" ? overviewResult.value : [];
        setOverviewItems(list);
        setSharedClasses(sharedResult.status === "fulfilled" ? sharedResult.value : []);
        setPrograms(programResult.status === "fulfilled" ? programResult.value : []);
        setSampleData(
          dataSourceResult.status === "fulfilled" && Boolean(dataSourceResult.value.sampleData),
        );

        if (overviewResult.status === "rejected") {
          setOverviewError(getErrorMessage(overviewResult.reason));
        }

        const candidateId = preferredClassId ?? selectedClassId;
        if (list.length > 0) {
          const exists = list.some((item) => String(item.classId) === candidateId);
          if (!candidateId || !exists) {
            const defaultClass = list.find(isOverviewClassActive) ?? list[0];
            syncUrlParams(String(defaultClass.classId), activeTab);
          } else if (preferredClassId && preferredClassId !== selectedClassId) {
            syncUrlParams(preferredClassId, activeTab);
          }
        } else if (selectedClassId) {
          syncUrlParams("", activeTab);
        }
        return list;
      } finally {
        setLoadingOverview(false);
      }
    },
    [activeTab, canReadProgramList, selectedClassId, syncUrlParams],
  );

  const loadSelectedClassPlan = useCallback(
    async (classId: number) => {
      setLoadingClass(true);
      setError("");
      try {
        const [planRes, summaryRes, optionsRes, assignmentsRes, sessionsRes] =
          await Promise.allSettled([
            classSetupApi.getProgramSubjects(classId),
            classSetupApi.getPlanSummary(classId),
            classSetupApi.getSubjectOptions(classId),
            canReadAssignment ? classSetupApi.getAssignments(classId) : Promise.resolve(null),
            canReadSession
              ? sessionApi.getPage({ page: 0, size: 500 }, undefined, { ids: [], classId })
              : Promise.resolve(null),
          ]);

        if (planRes.status === "rejected") {
          throw planRes.reason;
        }

        setClassData(planRes.value);
        setPlanSummary(summaryRes.status === "fulfilled" ? summaryRes.value : null);
        setSubjectOptions(optionsRes.status === "fulfilled" ? optionsRes.value : []);
        setOwnerAssignments(
          assignmentsRes.status === "fulfilled" ? assignmentsRes.value : null,
        );
        setOwnerSessions(
          sessionsRes.status === "fulfilled" && sessionsRes.value
            ? sessionsRes.value.content ?? sessionsRes.value.items ?? []
            : null,
        );
      } catch (loadErr) {
        setClassData(null);
        setPlanSummary(null);
        setSubjectOptions([]);
        setError(getErrorMessage(loadErr));
      } finally {
        setLoadingClass(false);
      }
    },
    [canReadAssignment, canReadSession],
  );

  useEffect(() => {
    void loadOverviewResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadProgramList]);

  useEffect(() => {
    if (selectedClassId) {
      void loadSelectedClassPlan(Number(selectedClassId));
    } else {
      setClassData(null);
      setPlanSummary(null);
      setSubjectOptions([]);
    }
  }, [loadSelectedClassPlan, selectedClassId]);

  const enrichedSubjects = useMemo<ClassProgramSubjectItem[]>(() => {
    if (!classData) return [];
    return classData.subjects.map((subject) => {
      const syncedAssignments = ownerAssignments
        ? ownerAssignments.filter((item) => item.programSubjectId === subject.programSubjectId)
        : subject.assignments;

      if (!ownerSessions) {
        return {
          ...subject,
          assignments: syncedAssignments,
        };
      }

      const assignmentIds = new Set(syncedAssignments.map((a) => a.id));
      const matchedSessions = ownerSessions.filter(
        (s) =>
          s.isActive !== false &&
          s.status !== "CANCELLED" &&
          (s.topicId === subject.subjectId ||
            (s.teachingAssignmentId != null && assignmentIds.has(s.teachingAssignmentId))),
      );
      const completedCount = matchedSessions.filter((s) => s.status === "COMPLETED").length;

      return {
        ...subject,
        assignments: syncedAssignments,
        scheduledSessionCount: matchedSessions.length,
        completedSessionCount: completedCount,
      };
    });
  }, [classData, ownerAssignments, ownerSessions]);

  const refreshAll = async () => {
    setError("");
    setNotice("");
    await loadOverviewResources();
    if (selectedClassId) {
      await loadSelectedClassPlan(Number(selectedClassId));
    }
  };

  // --- Xử lý CRUD Lớp học & Import Excel ---
  const openCreateClassDialog = () => {
    setClassCrudError("");
    setCrudDialog({ open: true, mode: "create", overview: null });
  };

  const openViewClassDialog = (item: ClassSetupOverview) => {
    setClassCrudError("");
    setCrudDialog({ open: true, mode: "view", overview: item });
  };

  const openEditClassDialog = (item: ClassSetupOverview) => {
    setClassCrudError("");
    setCrudDialog({ open: true, mode: "edit", overview: item });
  };

  const handleSaveClassCrud = async (
    request: SharedClassRequest,
    selectedProgId: string,
    programChanged: boolean,
  ) => {
    setClassCrudError("");
    setClassCrudSaving(true);
    try {
      const editingOverview = crudDialog.mode === "edit" ? crudDialog.overview : null;
      const saved = editingOverview
        ? await classSetupApi.updateClass(editingOverview.classId, request)
        : await classSetupApi.createClass(request);

      if (canAssignProgram && (!editingOverview || programChanged)) {
        if (selectedProgId && request.status === "active") {
          await classSetupApi.assignProgram(saved.id, Number(selectedProgId));
        } else if (!selectedProgId && editingOverview && editingOverview.programId) {
          await classSetupApi.removeProgram(saved.id);
        }
      }

      setCrudDialog((prev) => ({ ...prev, open: false }));
      const nextTargetId = String(saved.id);
      await loadOverviewResources(nextTargetId);
      if (nextTargetId === selectedClassId) {
        await loadSelectedClassPlan(saved.id);
      }

      setError("");
      setNotice(
        editingOverview
          ? `Đã cập nhật thông tin lớp ${saved.code} — ${saved.name}.`
          : `Đã tạo mới lớp học ${saved.code} — ${saved.name}.`,
      );
    } catch (crudErr) {
      setClassCrudError(getErrorMessage(crudErr));
    } finally {
      setClassCrudSaving(false);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!pendingDeleteClass) return;
    setClassCrudSaving(true);
    setError("");
    setNotice("");
    try {
      const deletedCode = pendingDeleteClass.code;
      const deletedId = String(pendingDeleteClass.classId);
      await classSetupApi.deleteClass(pendingDeleteClass.classId);
      setPendingDeleteClass(null);

      const list = await loadOverviewResources(
        deletedId === selectedClassId ? undefined : selectedClassId,
      );
      if (list.length === 0) {
        setClassData(null);
      }
      setNotice(`Đã xóa lớp học ${deletedCode}.`);
    } catch (delErr) {
      setPendingDeleteClass(null);
      setError(getErrorMessage(delErr));
    } finally {
      setClassCrudSaving(false);
    }
  };

  const handleImportClassesSuccess = (result: ImportResult) => {
    setImportResult(result);
    setImportResultOpen(true);
    if (result.successCount > 0) {
      setError("");
      setNotice(`Đã import thành công ${result.successCount} lớp học từ file Excel.`);
      void loadOverviewResources();
    }
  };

  // --- Xử lý Chương trình & Course theo Topic ---
  const handleAssignProgram = async (programId: number) => {
    if (!selectedClassId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await classSetupApi.assignProgram(Number(selectedClassId), programId);
      await Promise.all([
        loadOverviewResources(),
        loadSelectedClassPlan(Number(selectedClassId)),
      ]);
      setNotice(
        `Đã gán chương trình ${updated.program?.code ?? ""} (v${updated.program?.version ?? ""}) cho lớp ${updated.classCode}.`,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveProgram = async () => {
    if (!selectedClassId || !classData) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const prevCode = classData.program?.code ?? "";
      await classSetupApi.removeProgram(Number(selectedClassId));
      await Promise.all([
        loadOverviewResources(),
        loadSelectedClassPlan(Number(selectedClassId)),
      ]);
      setNotice(`Đã bỏ chương trình ${prevCode} khỏi lớp ${classData.classCode}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTopicCourses = async (items: TopicCourseSaveItem[]) => {
    if (!selectedClassId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await classSetupApi.saveTopicCourses(Number(selectedClassId), items);
      await Promise.all([
        loadOverviewResources(),
        loadSelectedClassPlan(Number(selectedClassId)),
      ]);
      setNotice(response.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const activeDialogSharedClass = useMemo<SharedClass | null>(() => {
    if (!crudDialog.overview) return null;
    return (
      sharedClasses.find((c) => c.id === crudDialog.overview?.classId) ??
      toFallbackSharedClass(crudDialog.overview)
    );
  }, [crudDialog.overview, sharedClasses]);

  const activeDialogCurrentProgram = useMemo<ClassProgramSubjects["program"]>(() => {
    const ov = crudDialog.overview;
    if (!ov || !ov.programId || !ov.programCode || !ov.programName || !ov.programVersion) {
      return null;
    }
    if (classData && classData.classId === ov.classId && classData.program) {
      return classData.program;
    }
    return {
      id: ov.programId,
      code: ov.programCode,
      name: ov.programName,
      version: ov.programVersion,
      status: "ACTIVE",
      totalDurationHours: 0,
    };
  }, [classData, crudDialog.overview]);

  const activeDialogProgramBlocked = useMemo<boolean>(() => {
    const ov = crudDialog.overview;
    if (!ov) return false;
    if (classData && classData.classId === ov.classId) {
      return classData.programChangeBlocked;
    }
    return (
      ov.enrolledCount > 0 ||
      ov.coursesAssignedCount > 0 ||
      ov.subjectsWithTrainerCount > 0 ||
      ov.scheduledSessionCount > 0
    );
  }, [classData, crudDialog.overview]);

  const missingTotal =
    (planSummary?.missingCourses.length ?? 0) +
    (planSummary?.missingAssignments.length ?? 0) +
    (planSummary?.missingSchedules.length ?? 0);

  return (
    <MainLayout pathName={{ "class-setup": "Quản lý lớp & Kế hoạch môn học" }}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Quản lý lớp học & Kế hoạch môn học của lớp
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Quản lý hồ sơ lớp học (tạo mới, chỉnh sửa, xóa, import hàng loạt từ Excel), gán chương trình đào tạo ACTIVE, liên kết Course LMS theo Topic và kiểm tra tổng hợp kế hoạch lớp.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={loadingOverview || loadingClass || saving || classCrudSaving}
            onClick={() => void refreshAll()}
          >
            <RefreshCw
              className={`size-4 ${loadingOverview || loadingClass ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Làm mới dữ liệu
          </Button>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>Không thể hoàn tất thao tác</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            <AlertTitle>Đã cập nhật thành công</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {sampleData && (
          <Alert>
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>Đang chạy nguồn dữ liệu mẫu (Local Profile)</AlertTitle>
            <AlertDescription>
              Dữ liệu lớp, giảng viên, phòng học và Course LMS đang chạy chế độ local mẫu để kiểm thử đầy đủ CRUD lớp học, Import Excel và thiết lập kế hoạch lớp.
            </AlertDescription>
          </Alert>
        )}

        {/* 1. Chức năng chính ở đầu trang: CRUD Lớp học (Create, Import Excel, View, Update, Delete) & Chọn lớp */}
        <ClassSetupListCard
          items={overviewItems}
          selectedClassId={selectedClassId}
          loading={loadingOverview}
          busy={saving || classCrudSaving}
          error={overviewError}
          canCreateClass={canCreateClass}
          canUpdateClass={canUpdateClass}
          canDeleteClass={canDeleteClass}
          onSelectClass={handleSelectClass}
          onCreateClass={openCreateClassDialog}
          onImportExcel={() => setImportModalOpen(true)}
          onViewClass={openViewClassDialog}
          onEditClass={openEditClassDialog}
          onDeleteClass={(item) => setPendingDeleteClass(item)}
        />

        {/* 2. Ngữ cảnh lớp đang chọn & các Tab thiết lập kế hoạch môn học */}
        {loadingClass ? (
          <div className="space-y-4" aria-live="polite" aria-label="Đang tải kế hoạch lớp">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        ) : (
          classData && (
            <section className="space-y-5">
              <ClassContextCard
                classes={overviewItems}
                selectedClassId={selectedClassId}
                classData={classData}
                summary={planSummary}
                canUpdateProgram={canAssignProgram}
                canUpdateCourse={canUpdateCourse}
                canReadAssignment={canReadAssignment}
                canCreateSession={canCreateSession}
                canReadSession={canReadSession}
                onSelectClass={handleSelectClass}
                onSelectTab={handleSelectTab}
              />

              <Tabs
                value={activeTab}
                onValueChange={(val) => handleSelectTab(parseTab(val))}
                className="space-y-4"
              >
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
                  <TabsTrigger value="program" className="gap-1.5 px-3 py-1.5">
                    <Layers className="size-4" aria-hidden="true" />
                    Chương trình & Môn học
                    {classData.program && (
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                        {enrichedSubjects.length}
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger value="courses" className="gap-1.5 px-3 py-1.5">
                    <BookOpen className="size-4" aria-hidden="true" />
                    Course theo Topic
                    {planSummary && planSummary.missingCourses.length > 0 && (
                      <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                        Thiếu {planSummary.missingCourses.length}
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger value="summary" className="gap-1.5 px-3 py-1.5">
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    Tổng hợp kế hoạch
                    {classData.program && (
                      <Badge
                        variant={missingTotal > 0 ? "outline" : "secondary"}
                        className="ml-1 px-1.5 py-0 text-xs"
                      >
                        {missingTotal > 0 ? `${missingTotal} mục thiếu` : "Hoàn tất"}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="program">
                  <ProgramSubjectsTab
                    classData={classData}
                    enrichedSubjects={enrichedSubjects}
                    programs={programs}
                    canAssignProgram={canAssignProgram}
                    canUpdateCourse={canUpdateCourse}
                    canReadAssignment={canReadAssignment}
                    canCreateSession={canCreateSession}
                    canReadSession={canReadSession}
                    saving={saving}
                    onAssignProgram={handleAssignProgram}
                    onRemoveProgram={handleRemoveProgram}
                    onOpenTab={handleSelectTab}
                  />
                </TabsContent>

                <TabsContent value="courses">
                  <TopicCoursesTab
                    classData={classData}
                    canUpdateCourse={canUpdateCourse}
                    canReadCourseCatalog={canReadCourseCatalog}
                    saving={saving}
                    onSaveCourses={handleSaveTopicCourses}
                    onOpenTab={handleSelectTab}
                  />
                </TabsContent>

                <TabsContent value="summary">
                  <PlanSummaryTab
                    classData={classData}
                    summary={planSummary}
                    subjectOptions={subjectOptions}
                    canUpdateCourse={canUpdateCourse}
                    canReadAssignment={canReadAssignment}
                    canCreateAssignment={canCreateAssignment}
                    canCreateSession={canCreateSession}
                    canReadSession={canReadSession}
                    onOpenTab={handleSelectTab}
                  />
                </TabsContent>
              </Tabs>
            </section>
          )
        )}
      </div>

      {/* Modal Tạo mới / Chỉnh sửa / Xem chi tiết Lớp học */}
      <ClassCrudDialog
        open={crudDialog.open}
        mode={crudDialog.mode}
        classItem={activeDialogSharedClass}
        currentProgram={activeDialogCurrentProgram}
        programChangeBlocked={activeDialogProgramBlocked}
        programs={programs}
        canAssignProgram={canAssignProgram}
        saving={classCrudSaving}
        error={classCrudError}
        onOpenChange={(open) => setCrudDialog((prev) => ({ ...prev, open }))}
        onSubmit={handleSaveClassCrud}
      />

      {/* Hộp thoại xác nhận Xóa lớp học */}
      <ConfirmDialog
        open={pendingDeleteClass !== null}
        title="Xóa lớp học?"
        description={
          pendingDeleteClass
            ? `Bạn sắp xóa lớp ${pendingDeleteClass.code} — ${pendingDeleteClass.name}. Lưu ý: các lớp đã phát sinh liên kết Course, phân công giảng dạy hoặc buổi học trên lịch sẽ được hệ thống bảo vệ không cho xóa.`
            : undefined
        }
        confirmLabel="Xóa lớp học"
        cancelLabel="Giữ lại"
        loading={classCrudSaving}
        onCancel={() => setPendingDeleteClass(null)}
        onConfirm={() => void handleConfirmDeleteClass()}
      />

      {/* Modal Import Lớp học từ Excel (.xlsx / .csv) kèm tải file mẫu */}
      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        table={classImportTable}
        title="Import danh sách lớp học từ Excel"
        description="Tải file Excel mẫu (.xlsx), điền danh sách lớp học (có thể điền sẵn Training Program Code / Version) và tải lên để tạo hàng loạt."
        onImportSuccess={handleImportClassesSuccess}
        canImport={canCreateClass}
      />

      <ImportResultModal
        open={importResultOpen}
        onOpenChange={setImportResultOpen}
        result={importResult}
        onBackToImport={() => {
          setImportResultOpen(false);
          setImportModalOpen(true);
        }}
      />
    </MainLayout>
  );
}
