package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.external_api.CalendarExcelExporter;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/classes/{classId}/calendars")
public class TrainingCalendarController {
    private final TrainingCalendarService service;
    private final CalendarExcelExporter exporter;
    @GetMapping @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('SESSION_READ')")
    public Object list(@PathVariable Long classId) { return service.list(classId); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('SESSION_UPDATE')")
    public Object create(@PathVariable Long classId, @RequestBody JsonNode body) { return service.create(classId, null, body); }
    @PostMapping("/{calendarId}/versions") @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('SESSION_UPDATE')")
    public Object version(@PathVariable Long classId, @PathVariable Long calendarId, @RequestBody JsonNode body) {
        return service.create(classId, calendarId, body);
    }
    @PutMapping @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('SESSION_UPDATE')")
    public void update(@PathVariable Long classId, @RequestBody JsonNode body) { service.update(classId, body); }
    @GetMapping("/{calendarId}/export") @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('SESSION_READ')")
    public ResponseEntity<byte[]> export(@PathVariable Long classId, @PathVariable Long calendarId) throws java.io.IOException {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=training-calendar-" + calendarId + ".xlsx")
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(exporter.build(service.list(classId).stream().filter(n -> n.path("id").asLong() == calendarId).findFirst()
                .orElseThrow(() -> new com.example.starter_project_2025.exception.ResourceNotFoundException("Calendar version not found for this class"))));
    }
}
