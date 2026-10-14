package com.example.starter_project_2025.system.demo.calendar;
import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
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
public class CalendarController extends BaseCrudController<Long, CalendarDTO, CalendarFilter> {
    private final CalendarService service;
    @Override protected BaseCrudService<Long, CalendarDTO, CalendarFilter> getService() { return service; }

    @GetMapping("/{id}/events")
    @Operation(summary = "Read sessions from the active version, overlapping the optional [from, to) interval")
    public List<SessionDTO> events(@PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return service.events(id, from, to);
    }
}
