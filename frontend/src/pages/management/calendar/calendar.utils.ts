import type { SharedClass, SharedTrainer } from "@/api/features/class-setup.api";
import type { CalendarCandidateSession, SessionDTO, TopicItem } from "@/types";
import type {
  Activity,
  DurationSectionOption,
  TrainingDay,
  TrainingTopic,
} from "./calendar.types";

export const DEFAULT_TRAINER_NAME = "Nguyễn Ngọc Tân (Trainer)";
export const DEFAULT_ROOM_NAME = "Phòng Lab 201 (F-Town 2)";

export const PRESET_CLASSES = [
  { id: "LOCAL_JAVA_01", name: "[LOCAL_JAVA_01] Lớp Chuyên sâu Java Backend (K26)", startDate: "2026-10-01" },
  { id: "LOCAL_JAVA_02", name: "[LOCAL_JAVA_02] Lớp Lập trình Fullstack Java Web (K26)", startDate: "2026-11-15" },
];

export const LOCATION_OPTIONS = [
  "Phòng Lab 201 (F-Town 2)",
  "Phòng 304 (Innovation Hall)",
  "Phòng Lab 405 (F-Town 1)",
  "Phòng Online Zoom A",
];

export const TOPIC_SECTION_OPTIONS = [
  "Section 1",
  "Section 2",
  "Section 3",
  "Section 1 & 2 (Full day)",
];

export const PIC_OPTIONS = [
  "Nguyễn Ngọc Tân (Trainer)",
  "Nguyễn Mạnh Hoàng (Trainer)",
  "Nguyễn Văn Thắng (Trainer)",
  "Nguyễn Tuấn Danh (Trainer)",
  "Huỳnh Tấn Phát (Trainer)",
];

export const CONTRIBUTION_OPTIONS = [
  "Lecture",
  "Assignment",
  "Practice",
  "Assessment",
  "Review",
];

export const FORMAT_OPTIONS = [
  "Self Learning",
  "Offline",
  "Online",
];

export const DURATION_PRESET_CHOICES = ["1h", "1.5h", "2h", "2.5h", "3h", "3.5h", "4h"];

export const SECTION_OPTIONS: DurationSectionOption[] = [
  { id: "1 (08h00 - 12h00)", label: "1 (08h00 - 12h00)", start: "08:00", end: "12:00", duration: "4h" },
  { id: "2 (13h00 - 17h00)", label: "2 (13h00 - 17h00)", start: "13:00", end: "17:00", duration: "4h" },
  { id: "3 (18h00 - 21h00)", label: "3 (18h00 - 21h00)", start: "18:00", end: "21:00", duration: "3h" },
  { id: "1 (08h00 - 10h00)", label: "1 (08h00 - 10h00)", start: "08:00", end: "10:00", duration: "2h" },
  { id: "2 (10h00 - 12h00)", label: "2 (10h00 - 12h00)", start: "10:00", end: "12:00", duration: "2h" },
  { id: "3 (13h00 - 15h00)", label: "3 (13h00 - 15h00)", start: "13:00", end: "15:00", duration: "2h" },
  { id: "4 (15h00 - 17h00)", label: "4 (15h00 - 17h00)", start: "15:00", end: "17:00", duration: "2h" },
];

export const uid = () => crypto.randomUUID();

export function calculateEndTime(startTime: string, durationHours: number): string {
  const [h, m] = (startTime || "08:00").split(":").map(Number);
  const totalMinutes = (h || 8) * 60 + (m || 0) + Math.round(durationHours * 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function parseDurationHours(durationStr: string | number | undefined): number {
  if (typeof durationStr === "number") return durationStr > 0 ? durationStr : 2;
  if (!durationStr) return 2;
  const match = durationStr.toString().trim().replace(",", ".").match(/[\d.]+/);
  const val = match ? parseFloat(match[0]) : 2;
  return Number.isNaN(val) || val <= 0 ? 2 : val;
}

export function formatSectionLabel(index: number, start: string, end: string): string {
  const fmt = (t: string) => {
    const [h, m] = (t || "08:00").split(":");
    return `${(h || "08").padStart(2, "0")}h${(m || "00").padStart(2, "0")}`;
  };
  return `${index} (${fmt(start)} - ${fmt(end)})`;
}

export function getSectionsForDuration(durationHours: number): DurationSectionOption[] {
  const dur = Math.max(0.5, durationHours || 2);
  const durLabel = `${dur}h`;
  const result: DurationSectionOption[] = [];

  let curStart = "08:00";
  let idx = 1;
  while (curStart < "12:00") {
    const curEnd = calculateEndTime(curStart, dur);
    if (curEnd > "12:30") break;
    const label = formatSectionLabel(idx++, curStart, curEnd);
    result.push({ id: label, label, start: curStart, end: curEnd, duration: durLabel });
    curStart = curEnd;
  }

  curStart = "13:00";
  while (curStart < "17:30") {
    const curEnd = calculateEndTime(curStart, dur);
    if (curEnd > "18:00") break;
    const label = formatSectionLabel(idx++, curStart, curEnd);
    result.push({ id: label, label, start: curStart, end: curEnd, duration: durLabel });
    curStart = curEnd;
  }

  curStart = "18:00";
  const endEve = calculateEndTime(curStart, dur);
  if (endEve <= "22:00") {
    const label = formatSectionLabel(idx, curStart, endEve);
    result.push({ id: label, label, start: curStart, end: endEve, duration: durLabel });
  }

  for (const s of SECTION_OPTIONS) {
    if (!result.some((r) => r.start === s.start && r.end === s.end)) {
      result.push(s);
    }
  }

  return result;
}

/** Advance a YYYY-MM-DD string by 1 day, optionally skipping Saturday & Sunday. */
export function advanceDate(dateStr: string, skipWeekends = true): string {
  const d = new Date(dateStr || "2026-10-01");
  if (Number.isNaN(d.getTime())) return "2026-10-01";
  d.setDate(d.getDate() + 1);
  if (skipWeekends) {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
  }
  return d.toISOString().substring(0, 10);
}

/** Build the default morning + afternoon activity pair for one training day. */
export function buildDefaultDayPair({
  primaryTitle,
  trainer,
  durHours,
  startTime = "08:00",
  primaryFormat = "Self Learning",
  includeAfternoon = true,
}: {
  primaryTitle: string;
  trainer: string;
  durHours: number;
  startTime?: string;
  primaryFormat?: string;
  includeAfternoon?: boolean;
}): Activity[] {
  const durLabel = `${durHours}h`;
  const start1 = startTime || "08:00";
  const end1 = calculateEndTime(start1, durHours);
  const activities: Activity[] = [
    {
      id: uid(),
      name: primaryTitle,
      pic: trainer || DEFAULT_TRAINER_NAME,
      contribution: "Lecture",
      format: primaryFormat,
      duration: durLabel,
      section: formatSectionLabel(1, start1, end1),
      start: start1,
      end: end1,
    },
  ];

  if (includeAfternoon) {
    const start2 = durHours >= 4 || end1 >= "12:00" ? "13:00" : end1;
    const end2 = calculateEndTime(start2, durHours);
    activities.push({
      id: uid(),
      name: "Assignment",
      pic: "",
      contribution: "Assignment",
      format: "Offline",
      duration: durLabel,
      section: formatSectionLabel(2, start2, end2),
      start: start2,
      end: end2,
    });
  }

  return activities;
}

export function generateDaysFromDuration({
  topicName,
  totalHours,
  sessionHours = 2,
  startDateStr,
  startTime = "08:00",
  trainer = DEFAULT_TRAINER_NAME,
  format = "Self Learning",
  skipWeekends = true,
}: {
  topicName: string;
  totalHours: number;
  sessionHours?: number;
  startDateStr: string;
  startTime?: string;
  trainer?: string;
  format?: string;
  skipWeekends?: boolean;
}): TrainingDay[] {
  const safeTotalHours = Math.max(1, totalHours || 8);
  const dur = Math.max(0.5, sessionHours || 2);
  const sessionsPerDay = dur <= 4 ? 2 : 1;
  const totalSessions = Math.ceil(safeTotalHours / dur);
  const totalDays = Math.ceil(totalSessions / sessionsPerDay);

  const days: TrainingDay[] = [];
  const currentDate = new Date(startDateStr);
  if (Number.isNaN(currentDate.getTime())) {
    currentDate.setTime(new Date("2026-10-01").getTime());
  }

  let sessionCount = 0;
  for (let d = 1; d <= totalDays && sessionCount < totalSessions; d++) {
    if (skipWeekends) {
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const dateStr = currentDate.toISOString().substring(0, 10);
    const hasSecondSession = sessionCount + 1 < totalSessions && sessionsPerDay > 1;
    sessionCount += hasSecondSession ? 2 : 1;

    days.push({
      id: uid(),
      dayNo: d,
      name: topicName,
      date: dateStr,
      activities: buildDefaultDayPair({
        primaryTitle: topicName,
        trainer,
        durHours: dur,
        startTime,
        primaryFormat: format,
        includeAfternoon: hasSecondSession,
      }),
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

export function newActivity(
  start = "08:00",
  end = "12:00",
  pic = DEFAULT_TRAINER_NAME,
  name = "New training activity",
  contribution = "Lecture",
  format = "Self Learning",
  section = "1 (08h00 - 12h00)",
  duration = "4h",
): Activity {
  return { id: uid(), name, pic, contribution, format, duration, section, start, end };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatFamsDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const mName = MONTH_NAMES[parseInt(parts[1], 10) - 1] || parts[1];
  return `${parts[2]}-${mName}-${parts[0]}`;
}

export function getFamsDayOfWeek(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date(y, m - 1, d).getDay()] || "—";
}

export function formatFamsDateRange(days: TrainingDay[]): string {
  if (!days || days.length === 0) return "";
  const validDates = days.map((d) => d.date).filter(Boolean).sort();
  if (validDates.length === 0) return "";
  const fmtShort = (ds: string) => {
    const p = ds.split("-");
    return p.length === 3 ? `${p[2]}-${MONTH_NAMES[parseInt(p[1], 10) - 1] || p[1]}` : ds;
  };
  const first = validDates[0];
  const last = validDates[validDates.length - 1];
  return first === last ? fmtShort(first) : `${fmtShort(first)} - ${fmtShort(last)}`;
}

export function durationMinutes(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const diff = toMin(end) - toMin(start);
  return diff > 0 ? diff : null;
}

export function parseClassIdToNumber(classId: string | number): number {
  if (typeof classId === "number") return classId;
  const match = classId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

export function isTimeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

export function getActivityConflict(
  _topic: TrainingTopic,
  day: TrainingDay,
  activity: Activity,
  currentLearningStart: string,
): string | null {
  if (activity.start >= activity.end) return "End time must be after start time";
  if (currentLearningStart && day.date && day.date < currentLearningStart) {
    return `Date is prior to learning start (${currentLearningStart})`;
  }
  for (const other of day.activities) {
    if (other.id !== activity.id && isTimeOverlapping(activity.start, activity.end, other.start, other.end)) {
      return `Overlaps with "${other.name}" (${other.start}-${other.end})`;
    }
  }
  return null;
}

export function getDayConflict(
  topic: TrainingTopic,
  day: TrainingDay,
  currentLearningStart: string,
): string | null {
  if (currentLearningStart && day.date && day.date < currentLearningStart) {
    return `Date is prior to learning start (${currentLearningStart})`;
  }
  for (const act of day.activities) {
    const err = getActivityConflict(topic, day, act, currentLearningStart);
    if (err) return err;
  }
  return null;
}

export function getTopicConflict(topic: TrainingTopic, allTopics: TrainingTopic[]): string | null {
  if (!topic.days || topic.days.length === 0) return "Requires at least 1 training day";
  if (topic.prerequisite) {
    const prereq = allTopics.find((t) => t.id === topic.prerequisite || t.code === topic.prerequisite);
    if (prereq && prereq.days.length > 0 && topic.days.length > 0) {
      const lastPrereqDate = [...prereq.days].map((d) => d.date).sort().reverse()[0];
      const firstTopicDate = [...topic.days].map((d) => d.date).sort()[0];
      if (lastPrereqDate && firstTopicDate && firstTopicDate < lastPrereqDate) {
        return `Starts (${firstTopicDate}) before prerequisite [${prereq.code}] finishes (${lastPrereqDate})`;
      }
    }
  }
  return null;
}

export function validateScheduleLogic(
  topics: TrainingTopic[],
  classStart: string,
  learningStart: string,
): string | null {
  if (!classStart || !learningStart) return "Enter both class start and actual learning start dates.";
  if (learningStart < classStart) return "Actual learning start date cannot be before class start date.";
  if (!topics.length) return "Curriculum must have at least one topic.";

  for (const topic of topics) {
    if (!topic.code.trim() || !topic.name.trim()) return "Every topic must have a valid code and name.";
    if (!topic.days.length) return `Please add at least one training day for [${topic.code}].`;
    for (const day of topic.days) {
      if (!day.name.trim() || !day.date) return `Please complete the date and day title in [${topic.code}].`;
      if (day.date < learningStart) {
        return `[${topic.code}]: Training date (${day.date}) cannot be before actual learning start (${learningStart}).`;
      }
      if (!day.activities.length) {
        return `[${topic.code} - ${day.name}]: Each training day requires at least one scheduled activity.`;
      }
      for (const act of day.activities) {
        if (!act.name.trim()) return `[${topic.code}]: Activity name is required.`;
        if (durationMinutes(act.start, act.end) === null) {
          return `[${topic.code}]: Activity end time must be after start time.`;
        }
      }
    }
  }
  return null;
}

export function groupSessionsIntoTopics(
  sessions: SessionDTO[],
  systemSubjects: TopicItem[],
  realTrainers: SharedTrainer[] = [],
): TrainingTopic[] {
  const topicMap = new Map<string, TrainingTopic>();

  for (const s of sessions) {
    if (!s.startTime) continue;
    const dateStr = s.startTime.substring(0, 10);
    const timeStart = s.startTime.substring(11, 16);
    const timeEnd = s.endTime ? s.endTime.substring(11, 16) : "09:15";

    const titleMatch = s.title?.match(/^\[(.*?)\]\s*(.*)$/);
    const code = titleMatch ? titleMatch[1] : "CORE";
    const activityName = titleMatch ? titleMatch[2] : s.title || "Study Session";
    const matchedTrainer = realTrainers.find((t) => t.id === s.trainerId);
    const trainerName = matchedTrainer?.name || DEFAULT_TRAINER_NAME;

    let topic = topicMap.get(code);
    if (!topic) {
      topic = {
        id: `topic-${code.toLowerCase()}`,
        code,
        name: systemSubjects.find((sub) => sub.code.toUpperCase() === code.toUpperCase())?.name || code,
        trainer: trainerName,
        location: s.location || DEFAULT_ROOM_NAME,
        mentor: "",
        prerequisite: "",
        slot: "1",
        days: [],
      };
      topicMap.set(code, topic);
    }

    let day = topic.days.find((d) => d.date === dateStr);
    if (!day) {
      day = {
        id: uid(),
        dayNo: topic.days.length + 1,
        name: `${code} - Day ${topic.days.length + 1}`,
        date: dateStr,
        activities: [],
      };
      topic.days.push(day);
    }

    const mins = durationMinutes(timeStart, timeEnd);
    const durLabel = mins ? `${Number((mins / 60).toFixed(2))}h` : "2h";
    day.activities.push({
      id: String(s.id || uid()),
      name: activityName,
      pic: trainerName,
      contribution: "Lecture",
      format: s.location?.toLowerCase().includes("online") ? "Online" : "Offline",
      duration: durLabel,
      section: formatSectionLabel(day.activities.length + 1, timeStart, timeEnd),
      start: timeStart,
      end: timeEnd,
    });
  }

  return Array.from(topicMap.values());
}

/**
 * Resolve topic, trainer, and room IDs once so both validation and batch persistence
 * send identical normalized session payloads to the backend.
 */
export function buildSessionPayloads({
  topics,
  classId,
  systemSubjects,
  realTrainers,
  realRooms,
}: {
  topics: TrainingTopic[];
  classId: number;
  systemSubjects: TopicItem[];
  realTrainers: SharedTrainer[];
  realRooms: Array<{ id: number; name: string }>;
}): { sessions: SessionDTO[]; candidates: CalendarCandidateSession[] } {
  const normalize = (str?: string) => (str ? str.replace(/[\[\]]/g, "").trim().toLowerCase() : "");
  const sessions: SessionDTO[] = [];
  const candidates: CalendarCandidateSession[] = [];

  topics.forEach((topic, topicIdx) => {
    let matchedSub = systemSubjects.find(
      (s) =>
        (s.code && topic.code && normalize(s.code) === normalize(topic.code)) ||
        (s.name && topic.name && normalize(s.name) === normalize(topic.name)),
    );
    if (!matchedSub && systemSubjects.length > 0) {
      matchedSub = systemSubjects[topicIdx % systemSubjects.length];
    }
    const resolvedTopicId = Number(matchedSub?.id || topicIdx + 1);

    const matchedTrainer = realTrainers.find(
      (t) =>
        (t.name && topic.trainer && t.name.toLowerCase().includes(topic.trainer.toLowerCase())) ||
        (topic.trainer && topic.trainer.toLowerCase().includes((t.name || "").toLowerCase())),
    );
    const resolvedTrainerId = Number(matchedTrainer?.id || realTrainers[0]?.id || 1);

    const defaultRoom = realRooms[0] || { id: 1, name: DEFAULT_ROOM_NAME };
    const matchedRoom =
      realRooms.find(
        (r) =>
          r.name.toLowerCase() === (topic.location || "").toLowerCase() ||
          (topic.location && r.name.toLowerCase().includes(topic.location.toLowerCase())) ||
          (topic.location && topic.location.toLowerCase().includes(r.name.toLowerCase())),
      ) || defaultRoom;

    topic.days.forEach((day) => {
      day.activities.forEach((act) => {
        const isOnline =
          act.format === "Online" || Boolean(topic.location && topic.location.toLowerCase().includes("online"));
        const finalRoomId = isOnline ? 5 : matchedRoom.id;
        const finalRoomName = isOnline ? "Online MS Teams" : matchedRoom.name;
        const meetingUrl = isOnline ? "https://teams.microsoft.com/meet/local-java-01" : undefined;
        const title = `[${topic.code || "TOPIC"}] ${act.name || topic.name}`.slice(0, 150);
        const startTime = `${day.date}T${act.start}:00`;
        const endTime = `${day.date}T${act.end}:00`;

        sessions.push({
          classId,
          topicId: resolvedTopicId,
          trainerId: resolvedTrainerId,
          roomId: finalRoomId,
          meetingUrl,
          title,
          startTime,
          endTime,
          location: finalRoomName,
          status: "SCHEDULED",
          isActive: true,
          note: `PIC: ${act.pic || topic.trainer || "Trainer"} · ${act.contribution || "Lecture"}`,
        });

        candidates.push({
          candidateKey: act.id,
          title,
          topicId: resolvedTopicId,
          trainerId: resolvedTrainerId,
          location: finalRoomName,
          startTime,
          endTime,
        });
      });
    });
  });

  return { sessions, candidates };
}

export function resolveClassOptions(realClasses: SharedClass[]) {
  if (realClasses.length > 0) {
    return realClasses.map((c) => ({
      id: c.code || String(c.id),
      name: `[${c.code}] ${c.name}`,
      startDate: c.startDate,
    }));
  }
  return PRESET_CLASSES;
}

