package com.example.starter_project_2025.system.calendar.schedule;

import java.time.LocalDate;
import java.util.List;

public final class ClassScheduleModels {

    private ClassScheduleModels() {}

    public record SlotDef(
            int slot,
            String start,
            String end
    ) {}

    public record ScheduleConfigDTO(
            int slotHours,
            List<SlotDef> slots,
            List<Integer> workingDays,
            List<String> holidays
    ) {}

    public record CourseScheduleDTO(
            Long id,
            String code,
            String name,
            String version,
            Integer durationHours,
            int orderIndex,
            int slotsNeeded
    ) {}

    public record ProgramScheduleDTO(
            Long id,
            String code,
            String name,
            String version,
            Integer totalDurationHours,
            List<CourseScheduleDTO> courses
    ) {}

    public record ClassScheduleInfoDTO(
            Long id,
            String code,
            String name,
            LocalDate startDate,
            LocalDate endDate,
            String actualStartDate,
            String actualEndDate,
            String status,
            String programCode,
            String masterTrainer,
            String location
    ) {}

    public record ScheduleEntryDTO(
            String id,
            Long classId,
            Long courseId,
            String courseCode,
            String courseName,
            String date,
            String actualDate,
            int slot,
            String startTime,
            String endTime,
            int order,
            boolean isManual,
            String note
    ) {}

    public record ClassScheduleResponse(
            ClassScheduleInfoDTO classInfo,
            ProgramScheduleDTO program,
            ScheduleConfigDTO config,
            boolean hasSchedule,
            boolean outdated,
            String outdatedReason,
            List<ScheduleEntryDTO> entries
    ) {}

    public record GenerateScheduleRequest(
            List<String> holidays,
            String actualStartDate
    ) {}

    public record SaveScheduleEntryInput(
            String id,
            Long courseId,
            String date,
            String actualDate,
            Integer slot,
            Boolean isManual,
            String note
    ) {}

    public record SaveClassScheduleRequest(
            List<SaveScheduleEntryInput> entries,
            String actualStartDate,
            String actualEndDate
    ) {}
}
