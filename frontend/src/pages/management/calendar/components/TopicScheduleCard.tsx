import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Menu,
  Plus,
  PlusCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Activity, RemovalTarget, TrainingDay, TrainingTopic } from "../calendar.types";
import {
  CONTRIBUTION_OPTIONS,
  DEFAULT_ROOM_NAME,
  DEFAULT_TRAINER_NAME,
  DURATION_PRESET_CHOICES,
  FORMAT_OPTIONS,
  SECTION_OPTIONS,
  TOPIC_SECTION_OPTIONS,
  calculateEndTime,
  formatFamsDate,
  formatFamsDateRange,
  formatSectionLabel,
  getDayConflict,
  getFamsDayOfWeek,
  getSectionsForDuration,
  getTopicConflict,
  parseDurationHours,
} from "../calendar.utils";

type TopicScheduleCardProps = {
  topic: TrainingTopic;
  allTopics: TrainingTopic[];
  learningStart: string;
  locationOptions: string[];
  trainerOptions: string[];
  isReadOnly?: boolean;
  collapsed: boolean;
  collapsedDays: string[];
  selectedDayIds: string[];
  onToggleCollapse: () => void;
  onToggleCollapseDay: (dayId: string) => void;
  onToggleSelectDay: (dayId: string) => void;
  onToggleSelectAllDays: (days: TrainingDay[]) => void;
  onOpenSplitModal: (topic: TrainingTopic) => void;
  onRequestRemove: (target: RemovalTarget) => void;
  onChangeTopic: (id: string, update: Partial<TrainingTopic>) => void;
  onChangeDay: (topicId: string, dayId: string, update: Partial<TrainingDay>) => void;
  onChangeActivity: (topicId: string, dayId: string, activityId: string, update: Partial<Activity>) => void;
  onAddDay: (topic: TrainingTopic) => void;
  onAddActivity: (topicId: string, dayId: string) => void;
  onExtractActivities: (topicId: string, dayId?: string) => void;
};

export function TopicScheduleCard({
  topic,
  allTopics,
  learningStart,
  locationOptions,
  trainerOptions,
  isReadOnly = false,
  collapsed,
  collapsedDays,
  selectedDayIds,
  onToggleCollapse,
  onToggleCollapseDay,
  onToggleSelectDay,
  onToggleSelectAllDays,
  onOpenSplitModal,
  onRequestRemove,
  onChangeTopic,
  onChangeDay,
  onChangeActivity,
  onAddDay,
  onAddActivity,
  onExtractActivities,
}: TopicScheduleCardProps) {
  const topicConflict = getTopicConflict(topic, allTopics);
  const allDaysSelected = topic.days.length > 0 && topic.days.every((d) => selectedDayIds.includes(d.id));

  return (
    <section
      className={`rounded-xl border bg-card shadow-sm transition-all overflow-hidden ${
        topicConflict ? "border-amber-400/70" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <Menu className="size-4 text-gray-400 shrink-0 cursor-grab" />
          <span className="font-bold text-sm text-gray-800 truncate">
            {topic.code.startsWith("[") ? topic.code : `[${topic.code}]`} {topic.name}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-gray-700">
            {formatFamsDateRange(topic.days)}
          </span>
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 hidden md:inline-flex"
              title="Tự động chia lại các buổi học theo thời lượng"
              onClick={() => onOpenSplitModal(topic)}
            >
              <Sparkles className="size-3 text-indigo-500" />
              Chia theo Duration
            </Button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              title={`Remove topic ${topic.code}`}
              onClick={() => onRequestRemove({ kind: "topic", topicId: topic.id })}
              className="text-red-500 hover:text-red-700 transition-colors p-1"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-gray-500 hover:text-gray-800 transition-colors p-1"
            title={collapsed ? "Expand topic" : "Collapse topic"}
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
      </div>

      {/* Top 5 topic configuration controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-3.5 bg-white border-b border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Slot time:</label>
          <select
            value={topic.location || locationOptions[0] || DEFAULT_ROOM_NAME}
            disabled={isReadOnly}
            onChange={(e) => onChangeTopic(topic.id, { location: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium truncate"
          >
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Start Section:</label>
          <select
            value={topic.defaultSection || "Section 1"}
            disabled={isReadOnly}
            onChange={(e) => onChangeTopic(topic.id, { defaultSection: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {TOPIC_SECTION_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Prerequisite Module:</label>
          <select
            value={topic.prerequisite || ""}
            disabled={isReadOnly}
            onChange={(e) => onChangeTopic(topic.id, { prerequisite: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value=""> </option>
            {allTopics
              .filter((item) => item.id !== topic.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.code}] {item.name}
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Trainers:</label>
          <select
            value={topic.trainer || DEFAULT_TRAINER_NAME}
            disabled={isReadOnly}
            onChange={(e) => onChangeTopic(topic.id, { trainer: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {trainerOptions.map((pic) => (
              <option key={pic} value={pic}>
                {pic}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Mentors:</label>
          <select
            value={topic.mentor || ""}
            disabled={isReadOnly}
            onChange={(e) => onChangeTopic(topic.id, { mentor: e.target.value })}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value=""> </option>
            {trainerOptions.map((pic) => (
              <option key={pic} value={pic}>
                {pic}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!collapsed && (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-gray-700 font-semibold border-b border-gray-200 text-xs">
                  <th className="w-16 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allDaysSelected}
                      onChange={() => onToggleSelectAllDays(topic.days)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      title="Select all days"
                    />
                  </th>
                  <th className="w-20 px-3 py-3 text-center">Day No</th>
                  <th className="px-4 py-3 text-left">
                    <span>Name</span>
                    <span className="text-red-500 font-bold ml-0.5">*</span>
                  </th>
                  <th className="w-36 px-4 py-3 text-left">Date</th>
                  <th className="w-32 px-4 py-3 text-left">Day Of Week</th>
                  <th className="w-28 px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topic.days.map((day, dayIndex) => {
                  const dayCollapsed = collapsedDays.includes(day.id);
                  const isDaySelected = selectedDayIds.includes(day.id);
                  const dayConflict = getDayConflict(topic, day, learningStart);

                  return (
                    <Fragment key={day.id}>
                      <tr
                        className={`border-b border-gray-200 hover:bg-gray-50/60 transition-colors ${
                          dayConflict ? "bg-amber-50/40" : isDaySelected ? "bg-indigo-50/30" : "bg-white"
                        }`}
                      >
                        <td className="w-16 px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Menu className="size-4 text-gray-400 shrink-0 cursor-grab" />
                            <input
                              type="checkbox"
                              checked={isDaySelected}
                              onChange={() => onToggleSelectDay(day.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </div>
                        </td>
                        <td className="w-20 px-3 py-3 text-center font-medium text-gray-700">
                          {day.dayNo || dayIndex + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            className="h-9 w-full max-w-xl rounded-lg border-gray-300 text-sm font-normal text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500"
                            value={day.name}
                            disabled={isReadOnly}
                            onChange={(e) => onChangeDay(topic.id, day.id, { name: e.target.value })}
                            maxLength={100}
                            placeholder="Day title"
                          />
                        </td>
                        <td className="w-36 px-4 py-3">
                          <div className="relative inline-flex items-center">
                            <input
                              type="date"
                              value={day.date}
                              disabled={isReadOnly}
                              onChange={(e) => onChangeDay(topic.id, day.id, { date: e.target.value })}
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm font-medium text-gray-800 cursor-pointer hover:text-indigo-600">
                              {formatFamsDate(day.date)}
                            </span>
                          </div>
                        </td>
                        <td className="w-32 px-4 py-3 text-sm text-gray-700 font-normal">
                          {getFamsDayOfWeek(day.date)}
                        </td>
                        <td className="w-28 px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              title="Add activity"
                              className="text-indigo-600 hover:text-indigo-800 transition-colors p-0.5"
                              onClick={() => onAddActivity(topic.id, day.id)}
                            >
                              <PlusCircle className="size-5" />
                            </button>
                            <button
                              type="button"
                              title="Delete day"
                              className="text-red-500 hover:text-red-700 transition-colors p-0.5"
                              onClick={() =>
                                onRequestRemove({ kind: "day", topicId: topic.id, dayId: day.id })
                              }
                            >
                              <Trash2 className="size-4 text-red-500" />
                            </button>
                            <button
                              type="button"
                              title={dayCollapsed ? "Expand activities" : "Collapse activities"}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-500 hover:text-gray-800"
                              onClick={() => onToggleCollapseDay(day.id)}
                            >
                              {dayCollapsed ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronUp className="size-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {!dayCollapsed && (
                        <tr className="bg-gray-50/40">
                          <td colSpan={6} className="px-6 py-3 border-b border-gray-200">
                            <div className="space-y-3">
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-[#F8F9FA] text-gray-700 font-semibold border-b border-gray-200 text-xs">
                                      <th className="px-3 py-2.5 text-left">
                                        <span>Name</span>
                                        <span className="text-red-500 font-bold ml-0.5">*</span>
                                      </th>
                                      <th className="w-36 px-3 py-2.5 text-left">PIC</th>
                                      <th className="w-36 px-3 py-2.5 text-left">Contribution Type</th>
                                      <th className="w-32 px-2 py-2 text-center leading-tight">
                                        <div>Training</div>
                                        <div>format</div>
                                      </th>
                                      <th className="w-24 px-3 py-2.5 text-center">
                                        <span>Duration</span>
                                        <span className="text-red-500 font-bold ml-0.5">*</span>
                                      </th>
                                      <th className="w-52 px-3 py-2.5 text-left">
                                        <span>Section</span>
                                        <span className="text-red-500 font-bold ml-0.5">*</span>
                                      </th>
                                      <th className="w-20 px-3 py-2.5 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {day.activities.map((act, actIndex) => {
                                      const durNum = parseDurationHours(act.duration || "2h");
                                      const availableSections = getSectionsForDuration(durNum);

                                      return (
                                        <tr key={act.id} className="hover:bg-gray-50/70 transition-colors">
                                          <td className="px-3 py-2">
                                            <Input
                                              value={act.name}
                                              disabled={isReadOnly}
                                              onChange={(e) =>
                                                onChangeActivity(topic.id, day.id, act.id, { name: e.target.value })
                                              }
                                              className="h-9 w-full rounded-lg border-gray-300 text-xs bg-white text-gray-800"
                                              maxLength={100}
                                              placeholder="Activity name"
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <select
                                              value={act.pic}
                                              disabled={isReadOnly}
                                              onChange={(e) =>
                                                onChangeActivity(topic.id, day.id, act.id, { pic: e.target.value })
                                              }
                                              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                              <option value=""> </option>
                                              {trainerOptions.map((pic) => (
                                                <option key={pic} value={pic}>
                                                  {pic}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="px-3 py-2">
                                            <select
                                              value={act.contribution}
                                              disabled={isReadOnly}
                                              onChange={(e) =>
                                                onChangeActivity(topic.id, day.id, act.id, {
                                                  contribution: e.target.value,
                                                })
                                              }
                                              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                              {CONTRIBUTION_OPTIONS.map((c) => (
                                                <option key={c} value={c}>
                                                  {c}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="px-2 py-2 text-center">
                                            <select
                                              value={act.format}
                                              disabled={isReadOnly}
                                              onChange={(e) =>
                                                onChangeActivity(topic.id, day.id, act.id, { format: e.target.value })
                                              }
                                              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 text-center focus:ring-2 focus:ring-indigo-500"
                                            >
                                              {FORMAT_OPTIONS.map((f) => (
                                                <option key={f} value={f}>
                                                  {f}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <select
                                              value={act.duration || "2h"}
                                              disabled={isReadOnly}
                                              onChange={(e) => {
                                                const newDurNum = parseDurationHours(e.target.value);
                                                const prevAct = actIndex > 0 ? day.activities[actIndex - 1] : null;
                                                let curStart = act.start || "08:00";
                                                if (prevAct?.end) {
                                                  curStart = prevAct.end;
                                                  if (curStart >= "12:00" && curStart < "13:00") {
                                                    curStart = "13:00";
                                                  }
                                                }
                                                const newEnd = calculateEndTime(curStart, newDurNum);
                                                const newSec = formatSectionLabel(actIndex + 1, curStart, newEnd);
                                                onChangeActivity(topic.id, day.id, act.id, {
                                                  duration: `${newDurNum}h`,
                                                  start: curStart,
                                                  end: newEnd,
                                                  section: newSec,
                                                });
                                                toast.info(
                                                  `Đã tự động chia: Section ${actIndex + 1} (${curStart.replace(":", "h")} - ${newEnd.replace(":", "h")}, ${newDurNum}h)`,
                                                );
                                              }}
                                              className="h-9 w-20 rounded-lg border border-gray-300 bg-white px-2 text-xs text-center font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm hover:border-indigo-400 transition-colors"
                                            >
                                              {DURATION_PRESET_CHOICES.map((d) => (
                                                <option key={d} value={d}>
                                                  {d}
                                                </option>
                                              ))}
                                              {!DURATION_PRESET_CHOICES.includes(act.duration || "") && act.duration && (
                                                <option value={act.duration}>{act.duration}</option>
                                              )}
                                            </select>
                                          </td>
                                          <td className="px-3 py-2">
                                            <select
                                              value={act.section || availableSections[0]?.label || "1 (08h00 - 10h00)"}
                                              disabled={isReadOnly}
                                              onChange={(e) => {
                                                const secVal = e.target.value;
                                                const matched =
                                                  availableSections.find((s) => s.id === secVal || s.label === secVal) ||
                                                  SECTION_OPTIONS.find((s) => s.id === secVal || s.label === secVal);
                                                if (matched) {
                                                  onChangeActivity(topic.id, day.id, act.id, {
                                                    section: matched.label,
                                                    start: matched.start,
                                                    end: matched.end,
                                                    duration: matched.duration || act.duration,
                                                  });
                                                } else {
                                                  onChangeActivity(topic.id, day.id, act.id, { section: secVal });
                                                }
                                              }}
                                              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium hover:border-indigo-400 transition-colors"
                                            >
                                              <optgroup label={`Ca phù hợp ${durNum}h`}>
                                                {availableSections
                                                  .filter((s) => s.duration === `${durNum}h` || parseDurationHours(s.duration) === durNum)
                                                  .map((s) => (
                                                    <option key={s.id} value={s.label}>
                                                      {s.label}
                                                    </option>
                                                  ))}
                                              </optgroup>
                                              <optgroup label="Các ca thời lượng khác">
                                                {availableSections
                                                  .filter((s) => s.duration !== `${durNum}h` && parseDurationHours(s.duration) !== durNum)
                                                  .map((s) => (
                                                    <option key={s.id} value={s.label}>
                                                      {s.label}
                                                    </option>
                                                  ))}
                                              </optgroup>
                                            </select>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <button
                                                type="button"
                                                title="Add activity"
                                                className="text-indigo-600 hover:text-indigo-800 transition-colors p-0.5"
                                                onClick={() => onAddActivity(topic.id, day.id)}
                                              >
                                                <PlusCircle className="size-4" />
                                              </button>
                                              <button
                                                type="button"
                                                title="Delete activity"
                                                className="text-red-500 hover:text-red-700 transition-colors p-0.5"
                                                onClick={() =>
                                                  onRequestRemove({
                                                    kind: "activity",
                                                    topicId: topic.id,
                                                    dayId: day.id,
                                                    activityId: act.id,
                                                  })
                                                }
                                              >
                                                <Trash2 className="size-3.5 text-red-500" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2 text-gray-400">
                                  <button type="button" className="p-1 hover:text-gray-700 transition-colors" title="Scroll left">
                                    <ChevronLeft className="size-4" />
                                  </button>
                                  <button type="button" className="p-1 hover:text-gray-700 transition-colors" title="Scroll right">
                                    <ChevronRight className="size-4" />
                                  </button>
                                </div>
                                <Button
                                  type="button"
                                  className="bg-[#4338CA] hover:bg-[#3730A3] text-white font-medium px-5 py-2 rounded-lg text-sm shadow-sm transition-all"
                                  onClick={() => onExtractActivities(topic.id, day.id)}
                                >
                                  Extract Activities
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isReadOnly && (
            <div className="flex items-center justify-end p-3 border-t border-gray-100 bg-gray-50/40">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 text-gray-700 hover:text-indigo-600 hover:border-indigo-300"
                onClick={() => onAddDay(topic)}
              >
                <Plus className="size-3.5" /> Thêm ngày đào tạo (Add Day)
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

