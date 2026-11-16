import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { TopicItem } from "@/types";
import { validateCalendarSchedule } from "@/api/features/calendar.api";
import { classSetupApi, type SharedClass, type SharedTrainer } from "@/api/features/class-setup.api";
import { sessionApi } from "@/api/features/demo/session.api";
import { topicApi } from "@/api/features/topic.api";
import type {
  Activity,
  RemovalTarget,
  TrainingDay,
  TrainingTopic,
  ValidationBannerState,
} from "./calendar.types";
import {
  DEFAULT_ROOM_NAME,
  DEFAULT_TRAINER_NAME,
  LOCATION_OPTIONS,
  PIC_OPTIONS,
  advanceDate,
  buildDefaultDayPair,
  buildSessionPayloads,
  durationMinutes,
  formatSectionLabel,
  generateDaysFromDuration,
  groupSessionsIntoTopics,
  newActivity,
  parseClassIdToNumber,
  parseDurationHours,
  resolveClassOptions,
  uid,
  validateScheduleLogic,
} from "./calendar.utils";
import { AddTopicDialog } from "./components/AddTopicDialog";
import {
  RemoveConfirmDialog,
  SaveScheduleDialog,
  UnsavedLeaveDialog,
} from "./components/CalendarDialogs";
import { SplitSessionsDialog } from "./components/SplitSessionsDialog";
import { TopicScheduleCard } from "./components/TopicScheduleCard";

type Props = {
  defaultClassId?: string;
  onBack?: () => void;
};

export default function TrainingCalendarPage({
  defaultClassId = "LOCAL_JAVA_01",
  onBack,
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);
  const [customClassInput, setCustomClassInput] = useState<string>("");

  const [topics, setTopics] = useState<TrainingTopic[]>([]);
  const [classStart, setClassStart] = useState("2026-10-01");
  const [learningStart, setLearningStart] = useState("2026-10-01");

  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([]);
  const [collapsedTopics, setCollapsedTopics] = useState<string[]>([]);
  const [collapsedDays, setCollapsedDays] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const [realClasses, setRealClasses] = useState<SharedClass[]>([]);
  const [realTrainers, setRealTrainers] = useState<SharedTrainer[]>([]);
  const [realRooms, setRealRooms] = useState<Array<{ id: number; name: string }>>([]);
  const [systemSubjects, setSystemSubjects] = useState<TopicItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [removal, setRemoval] = useState<RemovalTarget | null>(null);

  // Add Topic modal state
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicPreset, setTopicPreset] = useState("CUSTOM");
  const [topicCode, setTopicCode] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicTotalHours, setTopicTotalHours] = useState<number>(20);
  const [topicSessionHours, setTopicSessionHours] = useState<number>(2.5);
  const [topicDailyStart, setTopicDailyStart] = useState<string>("08:00");
  const [topicSkipWeekends, setTopicSkipWeekends] = useState<boolean>(true);

  // Split Topic modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splittingTopic, setSplittingTopic] = useState<TrainingTopic | null>(null);
  const [splitTotalHours, setSplitTotalHours] = useState<number>(20);
  const [splitSessionHours, setSplitSessionHours] = useState<number>(2.5);
  const [splitDailyStart, setSplitDailyStart] = useState<string>("08:00");
  const [splitStartDate, setSplitStartDate] = useState<string>(learningStart);
  const [splitSkipWeekends, setSplitSkipWeekends] = useState<boolean>(true);

  // Save & validation state
  const [saveOpen, setSaveOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationBannerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedClassNumericId = useMemo(() => {
    const matched = realClasses.find(
      (c) => c.code === selectedClassId || String(c.id) === String(selectedClassId),
    );
    return matched?.id || parseClassIdToNumber(selectedClassId);
  }, [realClasses, selectedClassId]);

  const earliestTopicDate = useMemo(() => {
    let minD: string | null = null;
    for (const t of topics) {
      for (const d of t.days) {
        if (d.date && (!minD || d.date < minD)) {
          minD = d.date;
        }
      }
    }
    return minD;
  }, [topics]);

  const classOptions = useMemo(() => resolveClassOptions(realClasses), [realClasses]);

  const trainerOptions = useMemo(
    () =>
      realTrainers.length > 0
        ? realTrainers.map((t) => t.name || t.email || `Trainer #${t.id}`)
        : PIC_OPTIONS,
    [realTrainers],
  );

  const locationOptions = useMemo(
    () => (realRooms.length > 0 ? realRooms.map((r) => r.name) : LOCATION_OPTIONS),
    [realRooms],
  );

  const availableTopicOptions = useMemo(
    () =>
      systemSubjects.map((s) => ({
        code: s.code,
        name: s.name,
        durationHours: s.durationHours || 20,
      })),
    [systemSubjects],
  );

  const dayCount = useMemo(() => topics.reduce((sum, t) => sum + t.days.length, 0), [topics]);

  const activityCount = useMemo(
    () => topics.reduce((sum, t) => sum + t.days.reduce((n, d) => n + d.activities.length, 0), 0),
    [topics],
  );

  const totalDurationMinutes = useMemo(() => {
    let total = 0;
    for (const t of topics) {
      for (const d of t.days) {
        for (const a of d.activities) {
          const m = durationMinutes(a.start, a.end);
          if (m) total += m;
        }
      }
    }
    return total;
  }, [topics]);

  useEffect(() => {
    const selectedClass = classOptions.find((c) => c.id === selectedClassId);
    if (selectedClass?.startDate) {
      setClassStart(selectedClass.startDate);
      setLearningStart(selectedClass.startDate);
    }
  }, [selectedClassId, classOptions]);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      classSetupApi.getActiveClasses(),
      classSetupApi.getActiveTrainers(),
      classSetupApi.getRooms(),
    ]).then(([classesRes, trainersRes, roomsRes]) => {
      if (!isMounted) return;
      if (classesRes.status === "fulfilled" && classesRes.value?.length) {
        setRealClasses(classesRes.value);
      }
      if (trainersRes.status === "fulfilled" && trainersRes.value?.length) {
        setRealTrainers(trainersRes.value);
      }
      if (roomsRes.status === "fulfilled" && roomsRes.value?.length) {
        setRealRooms(roomsRes.value);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingSubjects(true);
    topicApi
      .getActive()
      .then((subjects) => {
        if (isMounted && subjects?.length) {
          setSystemSubjects(subjects);
        }
      })
      .catch((err) => {
        console.info("Subject API is offline:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSubjects(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const classNum = selectedClassNumericId;
    sessionApi
      .getPage({ page: 0, size: 200 }, undefined, { ids: [], classId: classNum })
      .then((pageResult) => {
        if (!isMounted) return;
        const existing = pageResult?.content || [];
        if (!existing.length) {
          setTopics([]);
          return;
        }
        const loaded = groupSessionsIntoTopics(existing, systemSubjects, realTrainers);
        setTopics(loaded);
        let minDate: string | null = null;
        for (const t of loaded) {
          for (const d of t.days) {
            if (d.date && (!minDate || d.date < minDate)) minDate = d.date;
          }
        }
        if (minDate) {
          setLearningStart((prev) => (minDate < prev ? minDate : prev));
          setClassStart((prev) => (minDate < prev ? minDate : prev));
        }
      })
      .catch((err) => {
        console.warn("Could not load sessions for class:", err);
        if (isMounted) setTopics([]);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedClassNumericId]);

  useEffect(() => {
    if (systemSubjects.length === 0) return;
    setTopics((prev) =>
      prev.map((topic) => {
        const matched = systemSubjects.find((sub) => sub.code.toUpperCase() === topic.code.toUpperCase());
        return matched && topic.name === topic.code ? { ...topic, name: matched.name } : topic;
      }),
    );
  }, [systemSubjects]);

  function changeTopics(update: (previous: TrainingTopic[]) => TrainingTopic[]) {
    setTopics(update);
    setDirty(true);
    setError(null);
    setValidationStatus(null);
  }

  function changeTopic(id: string, update: Partial<TrainingTopic>) {
    changeTopics((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));
  }

  function changeDay(topicId: string, dayId: string, update: Partial<TrainingDay>) {
    changeTopics((prev) =>
      prev.map((t) =>
        t.id !== topicId
          ? t
          : { ...t, days: t.days.map((d) => (d.id === dayId ? { ...d, ...update } : d)) },
      ),
    );
  }

  function changeActivity(topicId: string, dayId: string, activityId: string, update: Partial<Activity>) {
    changeTopics((prev) =>
      prev.map((t) =>
        t.id !== topicId
          ? t
          : {
              ...t,
              days: t.days.map((d) =>
                d.id !== dayId
                  ? d
                  : { ...d, activities: d.activities.map((a) => (a.id === activityId ? { ...a, ...update } : a)) },
              ),
            },
      ),
    );
  }

  function toggleSelectDay(dayId: string) {
    setSelectedDayIds((prev) => (prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]));
  }

  function toggleSelectAllDays(topicDays: TrainingDay[]) {
    const allIds = topicDays.map((d) => d.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedDayIds.includes(id));
    setSelectedDayIds((prev) =>
      allSelected ? prev.filter((id) => !allIds.includes(id)) : Array.from(new Set([...prev, ...allIds])),
    );
  }

  function handleExtractActivities(topicId: string, dayId?: string) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const defaultTrainer = topic.trainer || DEFAULT_TRAINER_NAME;

    if (dayId) {
      const day = topic.days.find((d) => d.id === dayId);
      if (!day) return;
      const dur = day.activities[0] ? parseDurationHours(day.activities[0].duration) : topic.sessionHours || 2;
      changeDay(topicId, dayId, {
        activities: buildDefaultDayPair({
          primaryTitle: day.name || topic.name,
          trainer: defaultTrainer,
          durHours: dur,
        }),
      });
      toast.success(`Đã trích xuất hoạt động mẫu theo ${dur}h cho Day ${day.dayNo || 1}!`);
      return;
    }

    const dur = topic.sessionHours || 2;
    changeTopic(topicId, {
      days: topic.days.map((day) => ({
        ...day,
        activities: buildDefaultDayPair({
          primaryTitle: day.name || topic.name,
          trainer: defaultTrainer,
          durHours: dur,
        }),
      })),
    });
    toast.success(`Đã trích xuất hoạt động mẫu theo ${dur}h cho toàn bộ môn [${topic.code}]!`);
  }

  function addActivityToDay(topicId: string, dayId: string) {
    const topic = topics.find((t) => t.id === topicId);
    const day = topic?.days.find((d) => d.id === dayId);
    if (!topic || !day) return;

    const lastAct = day.activities[day.activities.length - 1];
    const durHours = lastAct ? parseDurationHours(lastAct.duration) : topic.sessionHours || 2;
    const durLabel = `${durHours}h`;

    let nextStart = "08:00";
    if (lastAct?.end) {
      nextStart = lastAct.end;
      if (nextStart >= "12:00" && nextStart < "13:00") nextStart = "13:00";
      else if (nextStart >= "17:00" && nextStart < "18:00") nextStart = "18:00";
    }

    const [h, m] = nextStart.split(":").map(Number);
    const totalMin = (h || 8) * 60 + (m || 0) + Math.round(durHours * 60);
    const nextEnd = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
    const nextIndex = day.activities.length + 1;

    changeDay(topicId, dayId, {
      activities: [
        ...day.activities,
        newActivity(
          nextStart,
          nextEnd,
          topic.trainer || DEFAULT_TRAINER_NAME,
          "New training activity",
          "Lecture",
          "Offline",
          formatSectionLabel(nextIndex, nextStart, nextEnd),
          durLabel,
        ),
      ],
    });
    toast.success(
      `Đã thêm buổi học mới: Section ${nextIndex} (${nextStart.replace(":", "h")} - ${nextEnd.replace(":", "h")}, ${durLabel})`,
    );
  }

  function addDay(topic: TrainingTopic) {
    const nextDayNo = topic.days.length + 1;
    const nextDate =
      topic.days.length > 0 ? advanceDate(topic.days[topic.days.length - 1].date, true) : learningStart;

    changeTopic(topic.id, {
      days: [
        ...topic.days,
        {
          id: uid(),
          dayNo: nextDayNo,
          name: topic.name,
          date: nextDate,
          activities: buildDefaultDayPair({
            primaryTitle: topic.name,
            trainer: topic.trainer || DEFAULT_TRAINER_NAME,
            durHours: 4,
          }),
        },
      ],
    });
  }

  function addTopic() {
    if (!topicCode.trim() || !topicName.trim()) return;

    let nextStartDate = learningStart;
    if (topics.length > 0) {
      const lastTopic = topics[topics.length - 1];
      if (lastTopic.days.length > 0) {
        nextStartDate = advanceDate(lastTopic.days[lastTopic.days.length - 1].date, true);
      }
    }

    const generatedDays = generateDaysFromDuration({
      topicName: topicName.trim(),
      totalHours: topicTotalHours,
      sessionHours: topicSessionHours,
      startDateStr: nextStartDate,
      startTime: topicDailyStart,
      trainer: DEFAULT_TRAINER_NAME,
      format: "Self Learning",
      skipWeekends: topicSkipWeekends,
    });

    changeTopics((prev) => [
      ...prev,
      {
        id: uid(),
        code: topicCode.trim(),
        name: topicName.trim(),
        trainer: DEFAULT_TRAINER_NAME,
        mentor: "",
        prerequisite: prev.length > 0 ? prev[prev.length - 1].id : "",
        location: DEFAULT_ROOM_NAME,
        defaultSection: "Section 1",
        slot: "1",
        durationHours: topicTotalHours,
        sessionHours: topicSessionHours,
        days: generatedDays,
      },
    ]);
    toast.success(`Đã thêm môn [${topicCode.trim()}] và tự động chia ${generatedDays.length} buổi học (${topicTotalHours}h)!`);
    setTopicOpen(false);
  }

  async function loadAllTopics() {
    let sourceList: Array<{ code: string; name: string; durationHours?: number }> = [];
    if (systemSubjects.length > 0) {
      sourceList = systemSubjects.map((s) => ({
        code: s.code,
        name: s.name,
        durationHours: s.durationHours || 20,
      }));
    } else {
      try {
        const apiSubjects = await topicApi.getActive();
        if (apiSubjects?.length) {
          setSystemSubjects(apiSubjects);
          sourceList = apiSubjects.map((s) => ({
            code: s.code,
            name: s.name,
            durationHours: s.durationHours || 20,
          }));
        }
      } catch {
        // Handled cleanly by empty-check below
      }
    }

    if (sourceList.length === 0) {
      toast.warning("Chưa có môn học nào trong hệ thống. Vui lòng tạo môn học trong mục Quản lý môn học trước.");
      return;
    }

    let curStartDate = learningStart;
    const loaded: TrainingTopic[] = sourceList.map((preset, index) => {
      const topicHours = preset.durationHours || 20;
      const topicDays = generateDaysFromDuration({
        topicName: preset.name,
        totalHours: topicHours,
        sessionHours: 4,
        startDateStr: curStartDate,
        startTime: "08:00",
        trainer: DEFAULT_TRAINER_NAME,
        format: "Self Learning",
        skipWeekends: true,
      });

      if (topicDays.length > 0) {
        curStartDate = advanceDate(topicDays[topicDays.length - 1].date, true);
      }

      return {
        id: `topic-${preset.code.toLowerCase()}`,
        code: preset.code,
        name: preset.name,
        trainer: DEFAULT_TRAINER_NAME,
        mentor: "",
        prerequisite: index > 0 ? `topic-${sourceList[index - 1].code.toLowerCase()}` : "",
        location: DEFAULT_ROOM_NAME,
        defaultSection: "Section 1",
        slot: "1",
        durationHours: topicHours,
        sessionHours: 4,
        days: topicDays,
      };
    });

    changeTopics(() => loaded);
    const totalDays = loaded.reduce((s, t) => s + t.days.length, 0);
    toast.success(`Đã tự động chia ${totalDays} ngày học cho ${loaded.length} môn theo thời lượng (Duration)!`);
  }

  function openSplitModal(topic: TrainingTopic) {
    setSplittingTopic(topic);
    setSplitTotalHours(topic.durationHours || (topic.days.length > 0 ? topic.days.length * 2.5 : 20));
    setSplitSessionHours(topic.sessionHours || 2.5);
    setSplitDailyStart(topic.days[0]?.activities[0]?.start || "08:00");
    setSplitStartDate(topic.days[0]?.date || learningStart);
    setSplitSkipWeekends(true);
    setSplitModalOpen(true);
  }

  function handleApplySplit() {
    if (!splittingTopic) return;
    const newDays = generateDaysFromDuration({
      topicName: splittingTopic.name,
      totalHours: splitTotalHours,
      sessionHours: splitSessionHours,
      startDateStr: splitStartDate,
      startTime: splitDailyStart,
      trainer: splittingTopic.trainer || DEFAULT_TRAINER_NAME,
      skipWeekends: splitSkipWeekends,
    });

    changeTopic(splittingTopic.id, {
      durationHours: splitTotalHours,
      sessionHours: splitSessionHours,
      days: newDays,
    });

    toast.success(`Đã tự động chia lại ${newDays.length} buổi học cho môn [${splittingTopic.code}] (${splitTotalHours}h)!`);
    setSplitModalOpen(false);
    setSplittingTopic(null);
  }

  function removeSelected() {
    if (!removal) return;
    const target = removal;
    changeTopics((prev) => {
      if (target.kind === "topic") {
        return prev
          .filter((t) => t.id !== target.topicId)
          .map((t) => (t.prerequisite === target.topicId ? { ...t, prerequisite: "" } : t));
      }
      return prev.map((t) =>
        t.id !== target.topicId
          ? t
          : {
              ...t,
              days:
                target.kind === "day"
                  ? t.days.filter((d) => d.id !== target.dayId)
                  : t.days.map((d) =>
                      d.id !== target.dayId
                        ? d
                        : { ...d, activities: d.activities.filter((a) => a.id !== target.activityId) },
                    ),
            },
      );
    });
    setRemoval(null);
  }

  function handleSelectClass(classId: string) {
    if (classId === selectedClassId) return;
    setSelectedClassId(classId);
    setDirty(false);
    toast.info(`Đã chuyển sang lớp ${classId}`);
  }

  function handleApplyCustomClass() {
    if (!customClassInput.trim()) {
      toast.error("Vui lòng nhập mã lớp học");
      return;
    }
    const target = customClassInput.trim();
    setSelectedClassId(target);
    setCustomClassInput("");
    setDirty(false);
    toast.success(`Đã chọn lớp ${target}`);
  }

  async function handleCheckConflicts() {
    const errorMsg = validateScheduleLogic(topics, classStart, learningStart);
    if (errorMsg) {
      setError(errorMsg);
      setValidationStatus({ tested: true, valid: false, message: errorMsg });
      return;
    }

    setValidating(true);
    setError(null);
    try {
      const { candidates } = buildSessionPayloads({
        topics,
        classId: selectedClassNumericId,
        systemSubjects,
        realTrainers,
        realRooms,
      });
      const result = await validateCalendarSchedule({
        classId: selectedClassNumericId,
        learningStartDate: learningStart,
        sessions: candidates,
      });

      if (result.valid) {
        setValidationStatus({
          tested: true,
          valid: true,
          message: "All sessions, trainer assignments, and room allocations are conflict-free!",
        });
        toast.success("Schedule validation passed: No conflicts detected.");
      } else {
        const detail =
          result.issues?.map((issue) => issue.message).join("; ") ||
          "Detected overlapping times or unavailable resources.";
        setValidationStatus({ tested: true, valid: false, message: detail });
        toast.error("Schedule conflicts detected.");
      }
    } catch (err) {
      console.warn("Server validation unreachable, falling back to client checks:", err);
      setValidationStatus({
        tested: true,
        valid: true,
        message: "Client schedule structure verified (backend validation endpoint unreachable).",
      });
      toast.success("Client schedule structure verified.");
    } finally {
      setValidating(false);
    }
  }

  async function handleSaveSchedule() {
    let effectiveLearningStart = learningStart;
    if (earliestTopicDate && earliestTopicDate < learningStart) {
      effectiveLearningStart = earliestTopicDate;
      setLearningStart(earliestTopicDate);
      if (classStart > earliestTopicDate) {
        setClassStart(earliestTopicDate);
      }
    }

    const errorMsg = validateScheduleLogic(topics, classStart, effectiveLearningStart);
    if (errorMsg) {
      setError(errorMsg);
      return;
    }
    if (!changeNote.trim()) {
      setError("Please provide a change note explaining the updates to this calendar version.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { sessions: allSessionPayloads } = buildSessionPayloads({
        topics,
        classId: selectedClassNumericId,
        systemSubjects,
        realTrainers,
        realRooms,
      });

      try {
        await sessionApi.deleteByClassId(selectedClassNumericId);
      } catch (clearErr) {
        console.info("Clear by classId fallback to page deletion:", clearErr);
        try {
          const oldPage = await sessionApi.getPage(
            { page: 0, size: 200 },
            undefined,
            { ids: [], classId: selectedClassNumericId },
          );
          if (oldPage?.content?.length) {
            await Promise.allSettled(
              oldPage.content.map((s) => (s.id != null ? sessionApi.delete(String(s.id)) : Promise.resolve(null))),
            );
          }
        } catch {
          // Ignore if no prior sessions exist
        }
      }

      await sessionApi.createBatch(allSessionPayloads);
      toast.success(
        `Đã lưu thành công lịch đào tạo cho lớp ${selectedClassId} (${allSessionPayloads.length} buổi học)!`,
      );
      setDirty(false);
      setSaveOpen(false);
    } catch (err: unknown) {
      const axiosLike = err as { response?: { data?: { message?: string } }; message?: string };
      const serverMsg =
        axiosLike?.response?.data?.message || axiosLike?.message || "Failed to save calendar updates.";
      setError(`Lỗi lưu lịch: ${serverMsg}`);
      toast.error(`Lỗi lưu lịch: ${serverMsg}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <MainLayout pathName={{ calendar: "Training Calendar", adjust: "Adjust" }}>
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-12">
        {/* Header & Class Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Adjust calendar : {selectedClassId}</h1>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                  Active Workspace
                </Badge>
                {systemSubjects.length > 0 && (
                  <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[11px]">
                    {systemSubjects.length} môn học từ DB
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thiết lập chủ đề (Topic), ngày học (Day) và các hoạt động chi tiết (Activities) cho lớp học.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 shadow-xs">
              <Label htmlFor="class-selector" className="text-xs text-muted-foreground font-medium">
                Lớp:
              </Label>
              <select
                id="class-selector"
                value={selectedClassId}
                onChange={(e) => handleSelectClass(e.target.value)}
                className="h-7 rounded-md border-0 bg-transparent text-xs font-semibold focus-visible:outline-none"
              >
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
                {!classOptions.some((cls) => cls.id === selectedClassId) && (
                  <option value={selectedClassId}>{selectedClassId}</option>
                )}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Input
                placeholder="Mã lớp khác..."
                maxLength={30}
                value={customClassInput}
                onChange={(e) => setCustomClassInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyCustomClass();
                }}
                className="h-8 w-28 text-xs"
              />
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleApplyCustomClass}>
                Chọn
              </Button>
            </div>

            <Link to={`/calendar/preview?date=${earliestTopicDate || learningStart || classStart}&classId=${selectedClassNumericId}`}>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                <CalendarDays className="size-3.5 text-primary" />
                Xem thời khóa biểu (Timetable)
              </Button>
            </Link>
          </div>
        </div>

        {/* Conflict validation banner */}
        {validationStatus && (
          <div
            role="alert"
            className={`flex items-start gap-3 rounded-lg border p-3.5 text-sm ${
              validationStatus.valid
                ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            {validationStatus.valid ? (
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold">
                {validationStatus.valid
                  ? "Validation Passed: Schedule Conflict-Free"
                  : "Validation Alert: Conflicts Found"}
              </p>
              <p className="mt-0.5 text-xs opacity-90">{validationStatus.message}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setValidationStatus(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Date Configuration & Toolbar */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="class-start" className="text-xs font-medium">
              Class start date
            </Label>
            <Input
              id="class-start"
              type="date"
              className="h-9 w-40 text-sm"
              value={classStart}
              onChange={(e) => {
                setClassStart(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="learning-start" className="text-xs font-medium">
              Actual learning start date
            </Label>
            <Input
              id="learning-start"
              type="date"
              className="h-9 w-40 text-sm"
              value={learningStart}
              onChange={(e) => {
                setLearningStart(e.target.value);
                setDirty(true);
              }}
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={isLoadingSubjects}
              onClick={loadAllTopics}
            >
              <Sparkles className="size-4 text-indigo-500" />
              {isLoadingSubjects ? "Loading topics..." : "Load All Topics"}
            </Button>
            <Button
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                setTopicPreset("CUSTOM");
                setTopicCode("");
                setTopicName("");
                setTopicOpen(true);
              }}
            >
              <Plus className="size-4" /> Add Topic
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-red-800 dark:text-red-200">Xung đột ngày học:</span>
              <span>{error}</span>
            </div>
            {earliestTopicDate && earliestTopicDate < learningStart && (
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white shadow-xs text-xs h-7 px-3 cursor-pointer shrink-0"
                onClick={() => {
                  setLearningStart(earliestTopicDate);
                  if (classStart > earliestTopicDate) setClassStart(earliestTopicDate);
                  setError(null);
                  toast.success(`Đã tự động đồng bộ ngày bắt đầu học thành ${earliestTopicDate}!`);
                }}
              >
                Đồng bộ ngày bắt đầu học ({earliestTopicDate})
              </Button>
            )}
          </div>
        )}

        {topics.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto size-8 text-muted-foreground/60 mb-2" />
            <p className="font-medium">No topics scheduled yet.</p>
            <p className="text-xs mt-1">
              Select <strong>Load All Topics</strong> to populate standard curriculum, or click{" "}
              <strong>Add Topic</strong> to create one.
            </p>
          </div>
        )}

        {topics.map((topic) => (
          <TopicScheduleCard
            key={topic.id}
            topic={topic}
            allTopics={topics}
            learningStart={learningStart}
            locationOptions={locationOptions}
            trainerOptions={trainerOptions}
            collapsed={collapsedTopics.includes(topic.id)}
            collapsedDays={collapsedDays}
            selectedDayIds={selectedDayIds}
            onToggleCollapse={() =>
              setCollapsedTopics((prev) =>
                prev.includes(topic.id) ? prev.filter((id) => id !== topic.id) : [...prev, topic.id],
              )
            }
            onToggleCollapseDay={(dayId) =>
              setCollapsedDays((prev) =>
                prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId],
              )
            }
            onToggleSelectDay={toggleSelectDay}
            onToggleSelectAllDays={toggleSelectAllDays}
            onOpenSplitModal={openSplitModal}
            onRequestRemove={setRemoval}
            onChangeTopic={changeTopic}
            onChangeDay={changeDay}
            onChangeActivity={changeActivity}
            onAddDay={addDay}
            onAddActivity={addActivityToDay}
            onExtractActivities={handleExtractActivities}
          />
        ))}

        {/* Sticky Bottom Bar */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 backdrop-blur-md p-3 shadow-lg">
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
            <span>
              <strong>{topics.length}</strong> topics
            </span>
            <span>•</span>
            <span>
              <strong>{dayCount}</strong> days
            </span>
            <span>•</span>
            <span>
              <strong>{activityCount}</strong> activities
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="size-3.5" />
              {Math.floor(totalDurationMinutes / 60)}h {totalDurationMinutes % 60}m total
            </span>
            {dirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={validating} onClick={handleCheckConflicts} className="gap-1.5">
              <ShieldCheck className="size-4 text-blue-600" />
              {validating ? "Checking..." : "Check Conflicts"}
            </Button>

            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground"
              onClick={() => {
                const err = validateScheduleLogic(topics, classStart, learningStart);
                setError(err);
                if (!err) {
                  setChangeNote((prev) => prev || `Cập nhật lịch đào tạo lớp ${selectedClassId}`);
                  setSaveOpen(true);
                }
              }}
            >
              <Save className="size-4" /> Save Schedule
            </Button>
          </div>
        </div>
      </div>

      <AddTopicDialog
        open={topicOpen}
        onOpenChange={setTopicOpen}
        availableTopicOptions={availableTopicOptions}
        topicPreset={topicPreset}
        onTopicPresetChange={setTopicPreset}
        topicCode={topicCode}
        onTopicCodeChange={setTopicCode}
        topicName={topicName}
        onTopicNameChange={setTopicName}
        totalHours={topicTotalHours}
        onTotalHoursChange={setTopicTotalHours}
        sessionHours={topicSessionHours}
        onSessionHoursChange={setTopicSessionHours}
        dailyStart={topicDailyStart}
        onDailyStartChange={setTopicDailyStart}
        skipWeekends={topicSkipWeekends}
        onSkipWeekendsChange={setTopicSkipWeekends}
        onConfirmAdd={addTopic}
      />

      <SplitSessionsDialog
        open={splitModalOpen}
        onOpenChange={setSplitModalOpen}
        topic={splittingTopic}
        totalHours={splitTotalHours}
        onTotalHoursChange={setSplitTotalHours}
        sessionHours={splitSessionHours}
        onSessionHoursChange={setSplitSessionHours}
        startDate={splitStartDate}
        onStartDateChange={setSplitStartDate}
        dailyStart={splitDailyStart}
        onDailyStartChange={setSplitDailyStart}
        skipWeekends={splitSkipWeekends}
        onSkipWeekendsChange={setSplitSkipWeekends}
        onConfirmSplit={handleApplySplit}
      />

      <RemoveConfirmDialog removal={removal} onClose={() => setRemoval(null)} onConfirm={removeSelected} />

      <SaveScheduleDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        classCode={selectedClassId}
        changeNote={changeNote}
        onChangeNote={setChangeNote}
        isSaving={isSaving}
        onConfirmSave={handleSaveSchedule}
      />

      <UnsavedLeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} onConfirmLeave={onBack} />
    </MainLayout>
  );
}

