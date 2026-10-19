import { bulkSessionGenerationApi, calendarVersionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BulkPreviewRequestDTO,
  BulkPreviewResponseDTO,
  CalendarSummary,
  PreviewSessionItemDTO,
  ScheduleGenerationContextResponse,
} from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DoorOpen,
  Info,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const DEMO_CLASSES = [
  { id: 101, code: "HCM26-FSJ-01", name: "Fullstack Java Bootcamp" },
  { id: 102, code: "HN26-QAA-02", name: "QA & Automation Bootcamp" },
  { id: 103, code: "DN26-DATA-01", name: "Data Engineering Bootcamp" },
];

const WEEK_DAYS = [
  { key: "MONDAY", label: "Mon", fullName: "Monday" },
  { key: "TUESDAY", label: "Tue", fullName: "Tuesday" },
  { key: "WEDNESDAY", label: "Wed", fullName: "Wednesday" },
  { key: "THURSDAY", label: "Thu", fullName: "Thursday" },
  { key: "FRIDAY", label: "Fri", fullName: "Friday" },
  { key: "SATURDAY", label: "Sat", fullName: "Saturday" },
  { key: "SUNDAY", label: "Sun", fullName: "Sunday" },
];

const SLOT_CONFIGS = {
  MORNING: { label: "Morning (08:00 - 12:00)", start: "08:00:00", end: "12:00:00", hours: 4 },
  AFTERNOON: { label: "Afternoon (13:30 - 17:30)", start: "13:30:00", end: "17:30:00", hours: 4 },
  EVENING: { label: "Evening (18:00 - 21:00)", start: "18:00:00", end: "21:00:00", hours: 3 },
  CUSTOM: { label: "Custom Slot Time", start: "08:30:00", end: "11:30:00", hours: 3 },
};

// Calculate next Monday as default start date
const getNextMonday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + ((day === 0 ? 1 : 8) - day);
  const nextMon = new Date(d.setDate(diff));
  return nextMon.toISOString().split("T")[0];
};

export function BulkSessionGenerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramCalendarId = searchParams.get("calendarId");
  const paramVersionId = searchParams.get("versionId");
  const paramClassId = searchParams.get("classId");

  // Configuration state
  const [selectedClassId, setSelectedClassId] = useState<number>(
    paramClassId ? Number(paramClassId) : 101
  );
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(
    paramCalendarId ? Number(paramCalendarId) : null
  );
  const [calendarVersionId, setCalendarVersionId] = useState<number>(
    paramVersionId ? Number(paramVersionId) : 1
  );
  const [startDate, setStartDate] = useState<string>(getNextMonday());
  const [selectedDays, setSelectedDays] = useState<string[]>(["MONDAY", "WEDNESDAY", "FRIDAY"]);
  const [slotType, setSlotType] = useState<"MORNING" | "AFTERNOON" | "EVENING" | "CUSTOM">("MORNING");
  const [customStartTime, setCustomStartTime] = useState<string>("08:30:00");
  const [customEndTime, setCustomEndTime] = useState<string>("11:30:00");
  const [defaultTrainerId, setDefaultTrainerId] = useState<number | undefined>(1);
  const [defaultRoomId, setDefaultRoomId] = useState<string>("Phòng A-301");
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);

  // Preview data state
  const [previewData, setPreviewData] = useState<BulkPreviewResponseDTO | null>(null);
  const [editableSessions, setEditableSessions] = useState<PreviewSessionItemDTO[]>([]);

  // 1. Fetch Real Calendars
  const { data: calendars = [], isLoading: isCalendarsLoading } = useQuery<CalendarSummary[]>({
    queryKey: ["calendarsList"],
    queryFn: () => calendarVersionApi.list(),
  });

  // Auto-select initial calendar
  useEffect(() => {
    if (calendars.length > 0) {
      if (paramCalendarId && calendars.some((c) => c.id === Number(paramCalendarId))) {
        setSelectedCalendarId(Number(paramCalendarId));
      } else if (selectedCalendarId === null) {
        setSelectedCalendarId(calendars[0].id);
      }
    }
  }, [calendars, paramCalendarId, selectedCalendarId]);

  // 2. Fetch Real Versions for Selected Calendar
  const { data: versionsPage, isLoading: isVersionsLoading } = useQuery({
    queryKey: ["calendarVersions", selectedCalendarId],
    enabled: selectedCalendarId !== null,
    queryFn: () => calendarVersionApi.getVersions(selectedCalendarId!, 0, 50, {}),
  });

  const availableVersions = versionsPage?.content || [];

  // Auto-select initial version
  useEffect(() => {
    if (availableVersions.length > 0) {
      if (paramVersionId && availableVersions.some((v) => v.id === Number(paramVersionId))) {
        setCalendarVersionId(Number(paramVersionId));
      } else if (!availableVersions.some((v) => v.id === calendarVersionId)) {
        const draftVer = availableVersions.find((v) => v.status === "DRAFT");
        if (draftVer && draftVer.id != null) {
          setCalendarVersionId(draftVer.id);
        } else if (availableVersions[0].id != null) {
          setCalendarVersionId(availableVersions[0].id);
        }
      }
    }
  }, [availableVersions, paramVersionId, calendarVersionId]);

  // 3. Fetch Curriculum & Scheduling Context
  const { data: context, isLoading: isContextLoading } = useQuery<ScheduleGenerationContextResponse>({
    queryKey: ["scheduleGenerationContext", selectedClassId],
    queryFn: () => bulkSessionGenerationApi.getContext(selectedClassId),
  });

  // Apply default trainer & room once context loads
  useMemo(() => {
    if (context) {
      if (context.availableTrainers?.length > 0 && !defaultTrainerId) {
        setDefaultTrainerId(context.availableTrainers[0].id);
      }
      if (context.availableRooms?.length > 0 && !defaultRoomId) {
        setDefaultRoomId(context.availableRooms[0].roomId);
      }
    }
  }, [context, defaultTrainerId, defaultRoomId]);

  // 4. Generate Preview Mutation (In-Memory Engine)
  const previewMutation = useMutation({
    mutationFn: (req: BulkPreviewRequestDTO) =>
      bulkSessionGenerationApi.generatePreview(selectedClassId, req),
    onSuccess: (data) => {
      setPreviewData(data);
      setEditableSessions(data.sessions || []);
      toast.success(
        `Generated preview for ${data.totalSessions} session(s). Skipped ${data.skippedHolidaysCount ?? 0} holiday(s).`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to generate schedule preview.";
      toast.error(msg);
    },
  });

  // 5. Atomic Bulk Save to DRAFT Mutation (All-or-Nothing + Idempotency)
  const saveMutation = useMutation({
    mutationFn: async ({
      versionId,
      sessions,
    }: {
      versionId: number;
      sessions: PreviewSessionItemDTO[];
    }) => {
      const idempotencyKey = crypto.randomUUID();
      return bulkSessionGenerationApi.saveBulkSessions(
        versionId,
        { sessions },
        idempotencyKey
      );
    },
    onSuccess: (res) => {
      const verObj = availableVersions.find((v) => v.id === calendarVersionId);
      const verLabel = verObj ? `v${verObj.versionNumber}` : `#${calendarVersionId}`;

      toast.success(
        `Successfully saved ${res.createdCount} session(s) into Calendar Version ${verLabel} (DRAFT)!`,
        {
          action: {
            label: "View in Calendar",
            onClick: () =>
              navigate(
                `/calendars?calendarId=${selectedCalendarId}&versionId=${calendarVersionId}`
              ),
          },
          duration: 6000,
        }
      );

      navigate(
        `/calendars?calendarId=${selectedCalendarId}&versionId=${calendarVersionId}`
      );
    },
    onError: (err: any) => {
      const res = err?.response?.data;
      if (err?.response?.status === 409) {
        toast.error(
          res?.message || "Conflict: Cannot save sessions to an ACTIVE calendar version."
        );
      } else {
        toast.error(res?.message || "Bulk save operation failed.");
      }
    },
  });

  // Preset handlers
  const applyDaysPreset = (preset: "246" | "357" | "allweek") => {
    if (preset === "246") {
      setSelectedDays(["MONDAY", "WEDNESDAY", "FRIDAY"]);
    } else if (preset === "357") {
      setSelectedDays(["TUESDAY", "THURSDAY", "SATURDAY"]);
    } else {
      setSelectedDays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
    }
  };

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  // Trigger preview generation
  const handleGeneratePreview = () => {
    if (selectedDays.length === 0) {
      toast.error("Please select at least one day of the week.");
      return;
    }
    if (!startDate) {
      toast.error("Please select a course start date.");
      return;
    }

    const slotStart =
      slotType === "CUSTOM" ? customStartTime : SLOT_CONFIGS[slotType].start;
    const slotEnd =
      slotType === "CUSTOM" ? customEndTime : SLOT_CONFIGS[slotType].end;
    const slotHours =
      slotType === "CUSTOM" ? 3 : SLOT_CONFIGS[slotType].hours;

    const payload: BulkPreviewRequestDTO = {
      startDate,
      daysOfWeek: selectedDays,
      slotTime: {
        slotName: slotType,
        startTime: slotStart,
        endTime: slotEnd,
        hoursPerSession: slotHours,
      },
      defaultRoomId,
      skipHolidays,
      checkConflicts: true,
    };

    previewMutation.mutate(payload);
  };

  // Interactive table row adjustments
  const handleUpdateSessionTrainer = (tempId: string, trainerId: number) => {
    const trainer = context?.availableTrainers?.find((t) => t.id === trainerId);
    setEditableSessions((prev) =>
      prev.map((s) =>
        s.tempId === tempId
          ? {
              ...s,
              trainerId,
              trainerName: trainer ? trainer.name : s.trainerName,
            }
          : s
      )
    );
  };

  const handleUpdateSessionRoom = (tempId: string, roomId: string) => {
    setEditableSessions((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, roomId } : s))
    );
  };

  const handleDeleteSession = (tempId: string) => {
    setEditableSessions((prev) => prev.filter((s) => s.tempId !== tempId));
    toast.info("Session removed from preview.");
  };

  const handleApplyTrainerToAll = (trainerId: number) => {
    const trainer = context?.availableTrainers?.find((t) => t.id === trainerId);
    if (!trainer) return;
    setEditableSessions((prev) =>
      prev.map((s) => ({
        ...s,
        trainerId,
        trainerName: trainer.name,
      }))
    );
    toast.success(`Assigned Trainer ${trainer.name} to all sessions.`);
  };

  const handleApplyRoomToAll = (roomId: string) => {
    setEditableSessions((prev) =>
      prev.map((s) => ({
        ...s,
        roomId,
      }))
    );
    toast.success(`Assigned Classroom ${roomId} to all sessions.`);
  };

  // Confirm save
  const handleSaveToDraft = () => {
    if (editableSessions.length === 0) {
      toast.error("No sessions available to save.");
      return;
    }
    saveMutation.mutate({
      versionId: calendarVersionId,
      sessions: editableSessions,
    });
  };

  return (
    <MainLayout
      pathName={{
        sessions: "Schedules",
        "bulk-generate": "Bulk Session Generator",
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/sessions")}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Badge variant="outline" className="text-primary border-primary/30">
                F16 - Bulk Generation
              </Badge>
              <Badge variant="secondary">Safety Invariant: DRAFT Only</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bulk Session Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              Automatically distribute curriculum topics into scheduled sessions, skip configured holidays, and support interactive preview adjustments before saving to DRAFT.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sessions/create")}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Create Single Session
            </Button>
          </div>
        </div>

        {/* System Invariant Alert */}
        <Alert className="border-sky-200 bg-sky-50 text-sky-900">
          <Info className="h-4 w-4 text-sky-600" />
          <AlertTitle className="text-sm font-semibold">System Safety Rules (BR-UNI-20 & BR-02):</AlertTitle>
          <AlertDescription className="text-xs text-sky-800 space-y-1 mt-1">
            <p>
              • All generated sessions will be saved atomically to Target Calendar Version (DRAFT #{calendarVersionId}) via an <strong>All-or-Nothing</strong> transaction.
            </p>
            <p>
              • This feature does not activate versions to ACTIVE (lifecycle transitions are managed via Calendar Version Lifecycle).
            </p>
          </AlertDescription>
        </Alert>

        {/* Configuration Block */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columns 1 & 2: Form Parameters */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generation Parameters
              </CardTitle>
              <CardDescription>
                Configure course start date, weekly schedule pattern, and time slots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Target Class, Academic Calendar & Target Version */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="select-class">Target Class <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedClassId.toString()}
                    onValueChange={(val) => setSelectedClassId(Number(val))}
                  >
                    <SelectTrigger id="select-class" className="w-full">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_CLASSES.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.code} - {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="select-calendar">Academic Calendar <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedCalendarId ? selectedCalendarId.toString() : ""}
                    onValueChange={(val) => setSelectedCalendarId(Number(val))}
                    disabled={isCalendarsLoading || calendars.length === 0}
                  >
                    <SelectTrigger id="select-calendar" className="w-full">
                      <SelectValue placeholder={isCalendarsLoading ? "Loading calendars..." : "Select calendar"} />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id.toString()}>
                          {cal.name} {cal.activeVersionNumber ? `(v${cal.activeVersionNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="select-version">Calendar Version <span className="text-red-500">*</span></Label>
                    {selectedCalendarId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/calendars?calendarId=${selectedCalendarId}`)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                  <Select
                    value={calendarVersionId.toString()}
                    onValueChange={(val) => setCalendarVersionId(Number(val))}
                    disabled={isVersionsLoading}
                  >
                    <SelectTrigger id="select-version" className="w-full">
                      <SelectValue placeholder={isVersionsLoading ? "Loading..." : "Select version"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVersions.map((ver) => (
                        <SelectItem key={ver.id} value={ver.id ? ver.id.toString() : "1"}>
                          v{ver.versionNumber} - {ver.name || "Draft"} ({ver.status})
                        </SelectItem>
                      ))}
                      {availableVersions.length === 0 && (
                        <SelectItem value="1">
                          v1 - Default Draft (DRAFT)
                        </SelectItem>
                      )}
                      <SelectItem value="999">
                        v9.9 - Safety Guard Test (ACTIVE)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Start Date & Slot Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="start-date">Course Start Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="slot-type">Time Slot <span className="text-red-500">*</span></Label>
                  <Select
                    value={slotType}
                    onValueChange={(v: any) => setSlotType(v)}
                  >
                    <SelectTrigger id="slot-type" className="w-full">
                      <SelectValue placeholder="Select slot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MORNING">{SLOT_CONFIGS.MORNING.label}</SelectItem>
                      <SelectItem value="AFTERNOON">{SLOT_CONFIGS.AFTERNOON.label}</SelectItem>
                      <SelectItem value="EVENING">{SLOT_CONFIGS.EVENING.label}</SelectItem>
                      <SelectItem value="CUSTOM">{SLOT_CONFIGS.CUSTOM.label}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Slot Time if CUSTOM selected */}
              {slotType === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="custom-start">Start Time</Label>
                    <Input
                      id="custom-start"
                      type="time"
                      value={customStartTime.substring(0, 5)}
                      onChange={(e) => setCustomStartTime(`${e.target.value}:00`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-end">End Time</Label>
                    <Input
                      id="custom-end"
                      type="time"
                      value={customEndTime.substring(0, 5)}
                      onChange={(e) => setCustomEndTime(`${e.target.value}:00`)}
                    />
                  </div>
                </div>
              )}

              {/* Weekly Days Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Weekly Pattern <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyDaysPreset("246")}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                    >
                      Mon-Wed-Fri
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDaysPreset("357")}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                    >
                      Tue-Thu-Sat
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDaysPreset("allweek")}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                    >
                      Mon to Fri
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background hover:bg-accent text-muted-foreground border-border"
                        }`}
                      >
                        <span className="font-bold text-sm">{day.label}</span>
                        <span className="text-[10px] opacity-80">{day.fullName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Trainer & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="default-trainer">Default Assigned Trainer</Label>
                  <Select
                    value={defaultTrainerId?.toString()}
                    onValueChange={(val) => setDefaultTrainerId(Number(val))}
                  >
                    <SelectTrigger id="default-trainer" className="w-full">
                      <SelectValue placeholder="Select trainer" />
                    </SelectTrigger>
                    <SelectContent>
                      {context?.availableTrainers?.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name} ({t.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="default-room">Default Classroom</Label>
                  <Select
                    value={defaultRoomId}
                    onValueChange={(val) => setDefaultRoomId(val)}
                  >
                    <SelectTrigger id="default-room" className="w-full">
                      <SelectValue placeholder="Select classroom" />
                    </SelectTrigger>
                    <SelectContent>
                      {context?.availableRooms?.map((r) => (
                        <SelectItem key={r.roomId} value={r.roomId}>
                          {r.roomId} - {r.roomName} ({r.capacity} seats)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Skip Holidays Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <Label htmlFor="skip-holidays" className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarCheck className="h-4 w-4 text-emerald-600" />
                    Auto Skip Configured Holidays (RTM-BSG-02)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sessions falling on configured holidays will automatically be shifted to the next scheduled day.
                  </p>
                </div>
                <Switch
                  id="skip-holidays"
                  checked={skipHolidays}
                  onCheckedChange={setSkipHolidays}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t p-4 bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewData(null);
                  setEditableSessions([]);
                }}
                disabled={!previewData}
              >
                Reset
              </Button>

              <Button
                size="sm"
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending || isContextLoading}
                className="gap-2"
              >
                {previewMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Preview
              </Button>
            </CardFooter>
          </Card>

          {/* Column 3: Curriculum Structure Context */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Curriculum Structure
              </CardTitle>
              <CardDescription className="text-xs">
                {context?.programName || "Loading curriculum..."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground block">Total Duration</span>
                  <span className="text-base font-bold text-foreground">
                    {context?.totalHours || 0} hrs
                  </span>
                </div>
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground block">Total Topics</span>
                  <span className="text-base font-bold text-foreground">
                    {context?.topics?.length || 0} topics
                  </span>
                </div>
              </div>

              {/* Topic Sequence (US-F16-01) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Topic Sequence:
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
                  {context?.topics?.map((topic) => (
                    <div
                      key={topic.topicId}
                      className="flex items-center justify-between p-2 rounded border bg-card/60 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
                          {topic.sequenceOrder ?? topic.orderIndex}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{topic.topicName}</p>
                          <p className="text-[10px] text-muted-foreground">{topic.topicCode}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {topic.totalHours ?? topic.durationHours}h
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configured Holidays */}
              <div className="space-y-1.5 pt-2 border-t">
                <span className="text-xs font-semibold text-muted-foreground block">
                  Configured Holidays:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {context?.holidays?.map((h) => (
                    <Badge key={h} variant="secondary" className="text-[10px]">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule Preview Table */}
        {previewData && (
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="border-b bg-muted/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Schedule Preview (Preview Sessions)
                  </CardTitle>
                  <CardDescription>
                    Review generated schedule. You can adjust the trainer or classroom for individual sessions before confirming.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveToDraft}
                    disabled={saveMutation.isPending || editableSessions.length === 0}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {saveMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save to DRAFT (All-or-Nothing)
                  </Button>
                </div>
              </div>

              {/* Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Total Sessions</span>
                  <span className="text-lg font-bold text-foreground">{editableSessions.length} sessions</span>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Start Date</span>
                  <span className="text-lg font-bold text-foreground">{previewData.startDate}</span>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Estimated End Date</span>
                  <span className="text-lg font-bold text-foreground">{previewData.estimatedEndDate}</span>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Holidays Skipped</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {previewData.skippedHolidaysCount} days
                  </span>
                </div>
              </div>

              {/* Conflict Warnings */}
              {previewData.conflictCount > 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Detected {previewData.conflictCount} potential schedule conflict(s)!</AlertTitle>
                  <AlertDescription className="text-xs">
                    Please reassign the trainer or classroom for flagged sessions below before saving.
                  </AlertDescription>
                </Alert>
              )}

              {/* Batch Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs">
                <span className="font-semibold text-muted-foreground">Batch Actions for All Sessions:</span>
                <div className="flex items-center gap-2">
                  {defaultTrainerId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleApplyTrainerToAll(defaultTrainerId)}
                    >
                      <Users className="h-3.5 w-3.5 text-primary" />
                      Apply Default Trainer to All
                    </Button>
                  )}
                  {defaultRoomId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleApplyRoomToAll(defaultRoomId)}
                    >
                      <DoorOpen className="h-3.5 w-3.5 text-primary" />
                      Apply Default Room to All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-center">#</TableHead>
                      <TableHead className="w-32">Date & Day</TableHead>
                      <TableHead className="w-36">Time Slot</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead className="w-56">Trainer (Editable)</TableHead>
                      <TableHead className="w-44">Classroom (Editable)</TableHead>
                      <TableHead className="w-28 text-center">Status</TableHead>
                      <TableHead className="w-14 text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableSessions.map((item, index) => {
                      const startTimeDisplay = item.startTime?.includes("T")
                        ? item.startTime.split("T")[1]?.substring(0, 5)
                        : item.startTime;
                      const endTimeDisplay = item.endTime?.includes("T")
                        ? item.endTime.split("T")[1]?.substring(0, 5)
                        : item.endTime;

                      const isConflicted = item.hasConflict || item.status === "CONFLICT";
                      const dayOfWeekDisplay =
                        item.dayOfWeek ||
                        (item.date
                          ? [
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ][new Date(item.date).getDay()]
                          : "");

                      return (
                        <TableRow
                          key={item.tempId}
                          className={isConflicted ? "bg-red-50/50 hover:bg-red-50" : ""}
                        >
                          <TableCell className="text-center font-bold text-muted-foreground">
                            #{item.sessionNumber || index + 1}
                          </TableCell>

                          <TableCell>
                            <div className="text-xs">
                              <span className="font-semibold block">{item.date}</span>
                              <span className="text-muted-foreground">{dayOfWeekDisplay}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="gap-1 font-mono text-xs">
                              <Clock className="h-3 w-3" />
                              {startTimeDisplay} - {endTimeDisplay}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="text-xs">
                              <span className="font-medium text-foreground block">{item.topicName}</span>
                              {item.isFractional && (
                                <span className="text-[10px] text-amber-600 font-medium">
                                  (Fractional Session)
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Editable Trainer per row */}
                          <TableCell>
                            <Select
                              value={item.trainerId?.toString()}
                              onValueChange={(val) =>
                                handleUpdateSessionTrainer(item.tempId, Number(val))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {context?.availableTrainers?.map((t) => (
                                  <SelectItem key={t.id} value={t.id.toString()}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Editable Room per row */}
                          <TableCell>
                            <Select
                              value={item.roomId}
                              onValueChange={(val) =>
                                handleUpdateSessionRoom(item.tempId, val)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {context?.availableRooms?.map((r) => (
                                  <SelectItem key={r.roomId} value={r.roomId}>
                                    {r.roomId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center">
                            {isConflicted ? (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Conflict
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                                Valid
                              </Badge>
                            )}
                          </TableCell>

                          {/* Action */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteSession(item.tempId)}
                              title="Delete session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-4 bg-muted/10">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{editableSessions.length} session(s) ready to persist.</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewData(null)}
                >
                  Close Preview
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveToDraft}
                  disabled={saveMutation.isPending || editableSessions.length === 0}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saveMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save to DRAFT (All-or-Nothing)
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

export default BulkSessionGenerationPage;
