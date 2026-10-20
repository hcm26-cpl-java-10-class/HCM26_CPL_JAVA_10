package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/calendar-versions")
@RequiredArgsConstructor
@Tag(name = "Calendar versions")
public class CalendarVersionCrudController extends BaseCrudController<Long, CalendarVersionDTO, CalendarVersionCrudFilter> {
    private final CalendarVersionCrudService service;
    @Override protected BaseCrudService<Long, CalendarVersionDTO, CalendarVersionCrudFilter> getService() { return service; }

    @PostMapping("/{id}/activate")
    @Operation(summary = "Activate this version, replacing the calendar's previous active version")
    public CalendarVersionDTO activate(@PathVariable Long id) { return service.activate(id); }

    @PostMapping("/{id}/clone")
    @Operation(summary = "Copy a version and its sessions into a new draft with new session IDs")
    public ResponseEntity<CalendarVersionDTO> cloneVersion(@PathVariable Long id) {
        return ResponseEntity.status(201).body(service.cloneVersion(id));
    }
}
