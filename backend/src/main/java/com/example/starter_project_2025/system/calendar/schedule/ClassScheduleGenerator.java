package com.example.starter_project_2025.system.calendar.schedule;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.CourseScheduleDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ScheduleConfigDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ScheduleEntryDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.SlotDef;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pure schedule generator & chronological order calculator (stateless, side-effect free).
 */
public final class ClassScheduleGenerator {

    private ClassScheduleGenerator() {}

    public static boolean isWorkingDay(LocalDate date, ScheduleConfigDTO config) {
        int isoDay = date.getDayOfWeek().getValue(); // 1 (Monday) .. 7 (Sunday)
        Set<Integer> working = config.workingDays() == null || config.workingDays().isEmpty()
                ? Set.of(1, 2, 3, 4, 5)
                : new HashSet<>(config.workingDays());
        if (!working.contains(isoDay)) {
            return false;
        }
        if (config.holidays() != null && config.holidays().contains(date.toString())) {
            return false;
        }
        return true;
    }

    public static LocalDate nextWorkingDay(LocalDate from, ScheduleConfigDTO config) {
        LocalDate cursor = from;
        int guard = 0;
        while (!isWorkingDay(cursor, config)) {
            cursor = cursor.plusDays(1);
            if (++guard > 370) {
                throw new BadRequestException("No valid working day found in the schedule configuration (check workingDays/holidays).");
            }
        }
        return cursor;
    }

    public static List<ScheduleEntryDTO> generate(
            Long classId,
            LocalDate classStartDate,
            List<CourseScheduleDTO> orderedCourses,
            ScheduleConfigDTO config
    ) {
        if (classStartDate == null) {
            throw new BadRequestException("Class is missing a start date (startDate). Please set it before generating.");
        }
        if (orderedCourses == null || orderedCourses.isEmpty()) {
            throw new BadRequestException("Training program has no courses.");
        }
        if (config == null || config.slotHours() <= 0 || config.slots() == null || config.slots().isEmpty()) {
            throw new BadRequestException("Invalid schedule slot configuration (ScheduleConfig).");
        }

        List<SlotDef> sortedSlots = config.slots().stream()
                .sorted(Comparator.comparingInt(SlotDef::slot))
                .toList();

        for (CourseScheduleDTO course : orderedCourses) {
            if (course == null || course.durationHours() == null || course.durationHours() <= 0) {
                String label = course != null && course.code() != null ? course.code() : "Unknown";
                throw new BadRequestException("Course " + label + " is missing durationHours or <= 0, cannot generate schedule.");
            }
        }

        List<CourseScheduleDTO> courses = orderedCourses.stream()
                .sorted(Comparator.comparingInt(CourseScheduleDTO::orderIndex))
                .toList();

        List<ScheduleEntryDTO> result = new ArrayList<>();
        LocalDate currentDate = nextWorkingDay(classStartDate, config);
        int slotIdx = 0;

        for (CourseScheduleDTO course : courses) {
            int slotsNeeded = (int) Math.ceil((double) course.durationHours() / config.slotHours());
            for (int order = 1; order <= slotsNeeded; order++) {
                SlotDef slotDef = sortedSlots.get(slotIdx);
                String dateStr = currentDate.toString();
                String entryId = "gen-" + classId + "-" + course.id() + "-" + dateStr + "-s" + slotDef.slot();
                result.add(new ScheduleEntryDTO(
                        entryId,
                        classId,
                        course.id(),
                        course.code(),
                        course.name(),
                        dateStr,
                        null,
                        slotDef.slot(),
                        slotDef.start(),
                        slotDef.end(),
                        order,
                        false,
                        null
                ));

                slotIdx++;
                if (slotIdx >= sortedSlots.size()) {
                    slotIdx = 0;
                    currentDate = nextWorkingDay(currentDate.plusDays(1), config);
                }
            }
        }

        return result;
    }

    public static List<ScheduleEntryDTO> recomputeOrder(List<ScheduleEntryDTO> entries) {
        if (entries == null || entries.isEmpty()) {
            return List.of();
        }
        List<ScheduleEntryDTO> sorted = entries.stream()
                .sorted(Comparator.comparing(ScheduleEntryDTO::date)
                        .thenComparingInt(ScheduleEntryDTO::slot))
                .toList();

        Map<Long, Integer> counters = new HashMap<>();
        List<ScheduleEntryDTO> updated = new ArrayList<>(sorted.size());
        for (ScheduleEntryDTO item : sorted) {
            int nextOrder = counters.merge(item.courseId(), 1, Integer::sum);
            updated.add(new ScheduleEntryDTO(
                    item.id(),
                    item.classId(),
                    item.courseId(),
                    item.courseCode(),
                    item.courseName(),
                    item.date(),
                    item.actualDate(),
                    item.slot(),
                    item.startTime(),
                    item.endTime(),
                    nextOrder,
                    item.isManual(),
                    item.note()
            ));
        }
        return updated;
    }
}
