package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/external")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "External API", description = "APIs for fetching and managing data from the external system (hệ thống tổng)")
public class ExternalApiController {

    private static final String ALL_STATUSES = "all";

    ExternalApiService externalApiService;
    CalendarExcelExporter calendarExcelExporter;

    @GetMapping("/classes/{id}/calendars/{calendarId}/export")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_READ')")
    public ResponseEntity<byte[]> exportCalendar(@PathVariable Long id, @PathVariable Long calendarId) throws java.io.IOException {
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=training-calendar-" + calendarId + ".xlsx")
                .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(calendarExcelExporter.export(id, calendarId));
    }

    @GetMapping("/classes")
    @Operation(summary = "Fetch classes from external system",
            description = "status defaults to 'active'; pass status=all to list classes of every status")
    public ResponseEntity<List<ExternalClassDTO>> getClasses(
            @RequestParam(required = false, defaultValue = "active") String status) {
        return ResponseEntity.ok(externalApiService.fetchClasses(toUpstreamStatus(status)));
    }

    @GetMapping("/classes/{id}")
    @Operation(summary = "Fetch a single class by ID from external system")
    public ResponseEntity<ExternalClassDTO> getClassById(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassById(id));
    }

    @PostMapping("/classes")
    @Operation(summary = "Create a new class in the external system")
    public ResponseEntity<ExternalClassDTO> createClass(@RequestBody ExternalClassDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.createClass(dto));
    }

    @PutMapping("/classes/{id}")
    @Operation(summary = "Update an existing class in the external system")
    public ResponseEntity<ExternalClassDTO> updateClass(@PathVariable Long id, @RequestBody ExternalClassDTO dto) {
        return ResponseEntity.ok(externalApiService.updateClass(id, dto));
    }

    @DeleteMapping("/classes/{id}")
    @Operation(summary = "Delete a class in the external system")
    public ResponseEntity<Void> deleteClass(@PathVariable Long id) {
        externalApiService.deleteClass(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/classes/batch")
    @Operation(summary = "Batch import classes into the external system")
    public ResponseEntity<Map<String, Object>> batchImportClasses(@RequestBody List<ExternalClassDTO> dtoList) {
        return ResponseEntity.ok(externalApiService.batchImportClasses(dtoList));
    }

    @GetMapping("/trainers")
    @Operation(summary = "Fetch trainers from external system",
            description = "status defaults to 'active'; pass status=all to list trainers of every status")
    public ResponseEntity<List<ExternalTrainerDTO>> getTrainers(
            @RequestParam(required = false, defaultValue = "active") String status) {
        return ResponseEntity.ok(externalApiService.fetchTrainers(toUpstreamStatus(status)));
    }

    @GetMapping("/rooms")
    @Operation(summary = "Fetch rooms from external system")
    public ResponseEntity<List<ExternalRoomDTO>> getRooms() {
        return ResponseEntity.ok(externalApiService.fetchRooms());
    }

    // ======================== TRAINEES ========================

    @GetMapping("/classes/{id}/trainees")
    @Operation(summary = "Fetch trainees enrolled in a class")
    public ResponseEntity<Object> getClassTrainees(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassTrainees(id));
    }

    @GetMapping("/trainees")
    @Operation(summary = "Fetch all trainees (pool)")
    public ResponseEntity<Object> getAllTrainees() {
        return ResponseEntity.ok(externalApiService.fetchAllTrainees());
    }

    @PostMapping("/classes/{id}/trainees")
    @Operation(summary = "Add trainee to class")
    public ResponseEntity<Object> addTraineeToClass(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.addTraineeToClass(id, body));
    }

    @PutMapping("/classes/{classId}/trainees/{traineeId}")
    @Operation(summary = "Update trainee details in a class")
    public ResponseEntity<Object> updateClassTrainee(
            @PathVariable Long classId,
            @PathVariable Long traineeId,
            @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.updateClassTrainee(classId, traineeId, body));
    }

    @PutMapping("/classes/{classId}/trainees/batch")
    @Operation(summary = "Batch save staged trainee changes (create, update, delete) for a class")
    public ResponseEntity<Object> batchSaveClassTrainees(
            @PathVariable Long classId,
            @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.batchSaveClassTrainees(classId, body));
    }

    @DeleteMapping("/classes/{classId}/trainees/{traineeId}")
    @Operation(summary = "Remove trainee from class")
    public ResponseEntity<Object> removeTraineeFromClass(
            @PathVariable Long classId,
            @PathVariable Long traineeId,
            @RequestBody(required = false) Object body) {
        return ResponseEntity.ok(externalApiService.removeTraineeFromClass(classId, traineeId, body));
    }

    // ======================== STATUS LIFECYCLE ========================

    @GetMapping("/classes/{id}/status")
    @Operation(summary = "Fetch status transition info for class")
    public ResponseEntity<Object> getClassStatusInfo(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassStatusInfo(id));
    }

    @PatchMapping("/classes/{id}/status")
    @Operation(summary = "Transition class status")
    public ResponseEntity<Object> transitionClassStatus(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.transitionClassStatus(id, body));
    }

    // ======================== SESSIONS ========================

    @GetMapping("/classes/{id}/sessions")
    @Operation(summary = "Fetch sessions for class")
    public ResponseEntity<Object> getClassSessions(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassSessions(id));
    }

    @PostMapping("/classes/{id}/sessions")
    @Operation(summary = "Create session for class")
    public ResponseEntity<Object> createClassSession(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.createClassSession(id, body));
    }

    @DeleteMapping("/classes/{classId}/sessions/{sessionId}")
    @Operation(summary = "Delete session")
    public ResponseEntity<Void> deleteClassSession(@PathVariable Long classId, @PathVariable Long sessionId) {
        externalApiService.deleteClassSession(classId, sessionId);
        return ResponseEntity.noContent().build();
    }

    // ======================== ATTENDANCE ========================

    @GetMapping("/classes/{classId}/sessions/{sessionId}/attendance")
    @Operation(summary = "Fetch attendance for session")
    public ResponseEntity<Object> getSessionAttendance(@PathVariable Long classId, @PathVariable Long sessionId) {
        return ResponseEntity.ok(externalApiService.fetchSessionAttendance(classId, sessionId));
    }

    @PutMapping("/classes/{classId}/sessions/{sessionId}/attendance")
    @Operation(summary = "Save attendance for session")
    public ResponseEntity<Object> saveSessionAttendance(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.saveSessionAttendance(classId, sessionId, body));
    }

    @GetMapping("/classes/{id}/calendars")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_READ')")
    @Operation(summary = "Fetch calendar version history for a class")
    public ResponseEntity<Object> getClassCalendars(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassCalendars(id));
    }

    @PostMapping("/classes/{id}/calendars/{calendarId}/versions")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_UPDATE')")
    public ResponseEntity<Object> createCalendarVersion(@PathVariable Long id, @PathVariable Long calendarId, @RequestBody Object body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.createCalendarVersion(id, calendarId, body));
    }

    @PutMapping("/classes/{id}/calendars")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_UPDATE')")
    public ResponseEntity<Object> saveClassCalendars(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.saveClassCalendars(id, body));
    }

    // ======================== BUDGET ========================

    @GetMapping("/classes/{id}/budget")
    @Operation(summary = "Fetch budget for class")
    public ResponseEntity<Object> getClassBudget(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassBudget(id));
    }

    // ======================== OPERATION & MILESTONES ========================

    @GetMapping("/classes/{id}/operation")
    @Operation(summary = "Fetch operating info and milestones for class")
    public ResponseEntity<Object> getClassOperation(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassOperation(id));
    }

    @PutMapping("/classes/{id}/operation")
    @Operation(summary = "Update operating info and milestones for class")
    public ResponseEntity<Object> saveClassOperation(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.saveClassOperation(id, body));
    }

    // ======================== TOPIC ASSESSMENTS ========================

    @GetMapping("/classes/{id}/topic-assessments")
    @Operation(summary = "Fetch topic assessment configuration")
    public ResponseEntity<Object> getTopicAssessments(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchTopicAssessments(id));
    }

    @PutMapping("/classes/{id}/topic-assessments")
    @Operation(summary = "Update or confirm topic assessment configuration")
    public ResponseEntity<Object> saveTopicAssessments(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.ok(externalApiService.saveTopicAssessments(id, body));
    }

    // ======================== ACTIVITIES ========================

    @GetMapping("/classes/{id}/activities")
    @Operation(summary = "Fetch activities for class")
    public ResponseEntity<Object> getClassActivities(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassActivities(id));
    }

    @PostMapping("/classes/{id}/activities")
    @Operation(summary = "Add activity/comment for class")
    public ResponseEntity<Object> addClassActivity(@PathVariable Long id, @RequestBody Object body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.addClassActivity(id, body));
    }

    // ======================== AUDIT ========================

    @GetMapping("/audits")
    @Operation(summary = "Fetch all audits")
    public ResponseEntity<Object> getAllAudits() {
        return ResponseEntity.ok(externalApiService.fetchAllAudits());
    }

    @GetMapping("/classes/{id}/audits")
    @Operation(summary = "Fetch audits for class")
    public ResponseEntity<Object> getClassAudits(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassAudits(id));
    }

    @PostMapping("/audits")
    @Operation(summary = "Create an audit")
    public ResponseEntity<Object> createAudit(@RequestBody Object body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.createAudit(body));
    }

    // ======================== ANALYTICS ========================

    @GetMapping("/analytics")
    @Operation(summary = "Fetch training analytics")
    public ResponseEntity<Object> getAnalytics() {
        return ResponseEntity.ok(externalApiService.fetchAnalytics());
    }

    /** "all" is our own marker for "no status filter"; the upstream system is simply not given a status. */
    private static String toUpstreamStatus(String status) {
        return status == null || ALL_STATUSES.equalsIgnoreCase(status.trim()) ? null : status;
    }
}
