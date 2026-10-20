package com.example.starter_project_2025.system.schedule.calendar.crud;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/calendars")
@RequiredArgsConstructor
@Tag(name = "Training calendars", description = "One calendar per class; class dates use Asia/Ho_Chi_Minh local time")
public class CalendarCrudController extends BaseCrudController<Long, CalendarDTO, CalendarFilter> {
    private final CalendarCrudService service;

    @Override protected BaseCrudService<Long, CalendarDTO, CalendarFilter> getService() { return service; }

    // The new calendar screen uses GET /api/calendars for the summary list.
    @Override
    @GetMapping("/search")
    public ResponseEntity<Page<CalendarDTO>> getAll(
            Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute CalendarFilter filter) {
        return ResponseEntity.ok(service.getAll(pageable, search, filter));
    }

    @GetMapping("/{id}/events")
    @Operation(summary = "Read sessions from the active version, overlapping the optional [from, to) interval")
    public List<SessionDTO> events(@PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return service.events(id, from, to);
    }
}
