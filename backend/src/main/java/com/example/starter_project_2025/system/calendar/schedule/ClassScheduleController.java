package com.example.starter_project_2025.system.calendar.schedule;

import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ClassScheduleResponse;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.GenerateScheduleRequest;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.SaveClassScheduleRequest;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ScheduleEntryDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes/{classId}/schedule")
@Tag(name = "Class Auto-Schedule", description = "APIs for generating, reading, and atomically saving class schedules")
public class ClassScheduleController {

    private final ClassScheduleService scheduleService;

    @GetMapping
    @PreAuthorize("hasAuthority('SESSION_READ')")
    @Operation(summary = "Get saved schedule, resolved program courses, and slot configuration for a class")
    public ClassScheduleResponse getClassSchedule(@PathVariable Long classId) {
        return scheduleService.getClassSchedule(classId);
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('SESSION_READ')")
    @Operation(summary = "Generate schedule entries from the class's Training Program without persisting to DB")
    public List<ScheduleEntryDTO> generateClassSchedule(
            @PathVariable Long classId,
            @RequestBody(required = false) GenerateScheduleRequest request
    ) {
        List<String> holidays = request == null ? null : request.holidays();
        String actualStartDate = request == null ? null : request.actualStartDate();
        return scheduleService.generateSchedule(classId, holidays, actualStartDate);
    }

    @PutMapping
    @PreAuthorize("hasAuthority('CLASS_READ') and (hasAuthority('SESSION_UPDATE') or hasAuthority('SESSION_CREATE'))")
    @Operation(summary = "Atomically replace the saved schedule for a class with server-side uniqueness validation")
    public ClassScheduleResponse saveClassSchedule(
            @PathVariable Long classId,
            @RequestBody SaveClassScheduleRequest request
    ) {
        return scheduleService.saveClassSchedule(classId, request);
    }
}
